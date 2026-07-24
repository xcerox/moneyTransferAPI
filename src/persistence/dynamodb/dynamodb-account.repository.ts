import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  GetCommand,
  PutCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Account } from '../../domain/account.entity';
import { USD } from '../../domain/currency';
import {
  AccountNotFoundError,
  InsufficientFundsError,
  TransferAlreadyRefundedError,
  TransferNotFoundError,
  TransferNotRefundableError,
} from '../../domain/errors';
import { AccountRepository } from '../../domain/ports/account-repository.port';
import { Transfer, TransferCommand } from '../../domain/transfer.entity';
import { generateTransferId } from '../../common/id/id';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamodb.client';
import { DynamoDbConfig, loadDynamoDbConfig } from './dynamodb.config';
import { toAccount, toTransfer, toTransferItem } from './dynamodb.mapper';

@Injectable()
export class DynamoDbAccountRepository implements AccountRepository {
  private readonly config: DynamoDbConfig = loadDynamoDbConfig();

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly client: DynamoDBDocumentClient,
  ) {}

  async findById(id: string): Promise<Account | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.config.accountsTableName,
        Key: { accountId: id },
      }),
    );
    return result.Item ? toAccount(result.Item) : null;
  }

  async findAll(): Promise<Account[]> {
    const result = await this.client.send(
      new ScanCommand({ TableName: this.config.accountsTableName }),
    );
    return (result.Items ?? []).map(toAccount);
  }

  async findAllTransfers(): Promise<Transfer[]> {
    const result = await this.client.send(
      new ScanCommand({ TableName: this.config.transfersTableName }),
    );
    return (result.Items ?? [])
      .map(toTransfer)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async findTransferById(id: string): Promise<Transfer | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.config.transfersTableName,
        Key: { transferId: id },
      }),
    );
    return result.Item ? toTransfer(result.Item) : null;
  }

  async transfer(command: TransferCommand): Promise<Transfer> {
    await this.requireAccount(command.fromAccountId);
    await this.requireAccount(command.toAccountId);
    const transfer = this.buildTransfer(command, 'COMPLETED');
    try {
      await this.client.send(this.buildTransferTransaction(command, transfer));
      return transfer;
    } catch (error) {
      return this.handleTransferFailure(command, error);
    }
  }

  async refund(transferId: string): Promise<Transfer> {
    const original = await this.findTransferById(transferId);
    if (!original) throw new TransferNotFoundError(transferId);
    this.assertRefundable(original);
    const refunded: Transfer = {
      ...original,
      status: 'REFUNDED',
      refundedAt: new Date().toISOString(),
    };
    await this.client.send(this.buildRefundTransaction(original, refunded));
    return refunded;
  }

  private async requireAccount(id: string): Promise<Account> {
    const account = await this.findById(id);
    if (!account) {
      throw new AccountNotFoundError(id, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return account;
  }

  private buildTransferTransaction(
    command: TransferCommand,
    transfer: Transfer,
  ): TransactWriteCommand {
    return new TransactWriteCommand({
      TransactItems: [
        this.debit(command.fromAccountId, command.amount),
        this.credit(command.toAccountId, command.amount),
        {
          Put: {
            TableName: this.config.transfersTableName,
            Item: toTransferItem(transfer),
          },
        },
      ],
    });
  }

  private buildRefundTransaction(
    original: Transfer,
    refunded: Transfer,
  ): TransactWriteCommand {
    return new TransactWriteCommand({
      TransactItems: [
        this.debit(original.toAccountId, original.amount),
        this.credit(original.fromAccountId, original.amount),
        {
          Update: {
            TableName: this.config.transfersTableName,
            Key: { transferId: original.id },
            ConditionExpression: '#status = :completed',
            UpdateExpression: 'SET #status = :refunded, refundedAt = :at',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':completed': 'COMPLETED',
              ':refunded': 'REFUNDED',
              ':at': refunded.refundedAt,
            },
          },
        },
      ],
    });
  }

  private debit(accountId: string, amount: number) {
    return {
      Update: {
        TableName: this.config.accountsTableName,
        Key: { accountId },
        ConditionExpression:
          'attribute_exists(accountId) AND balance >= :amount',
        UpdateExpression: 'SET balance = balance - :amount, updatedAt = :now',
        ExpressionAttributeValues: {
          ':amount': amount,
          ':now': new Date().toISOString(),
        },
      },
    };
  }

  private credit(accountId: string, amount: number) {
    return {
      Update: {
        TableName: this.config.accountsTableName,
        Key: { accountId },
        ConditionExpression: 'attribute_exists(accountId)',
        UpdateExpression: 'SET balance = balance + :amount, updatedAt = :now',
        ExpressionAttributeValues: {
          ':amount': amount,
          ':now': new Date().toISOString(),
        },
      },
    };
  }

  private async handleTransferFailure(
    command: TransferCommand,
    error: unknown,
  ): Promise<never> {
    if (isTransactionCanceled(error)) {
      const failed = this.buildTransfer(
        command,
        'FAILED',
        'INSUFFICIENT_FUNDS',
      );
      await this.client.send(
        new PutCommand({
          TableName: this.config.transfersTableName,
          Item: toTransferItem(failed),
        }),
      );
      throw new InsufficientFundsError(command.fromAccountId);
    }
    throw error;
  }

  private assertRefundable(transfer: Transfer): void {
    if (transfer.status === 'REFUNDED') {
      throw new TransferAlreadyRefundedError(transfer.id);
    }
    if (transfer.status !== 'COMPLETED') {
      throw new TransferNotRefundableError(transfer.id);
    }
  }

  private buildTransfer(
    command: TransferCommand,
    status: Transfer['status'],
    failureReason: string | null = null,
  ): Transfer {
    return {
      id: generateTransferId(),
      fromAccountId: command.fromAccountId,
      toAccountId: command.toAccountId,
      amount: command.amount,
      currency: USD,
      status,
      idempotencyKey: command.idempotencyKey,
      createdAt: new Date().toISOString(),
      refundedAt: null,
      refundOfTransferId: null,
      failureReason,
    };
  }
}

function isTransactionCanceled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'TransactionCanceledException'
  );
}
