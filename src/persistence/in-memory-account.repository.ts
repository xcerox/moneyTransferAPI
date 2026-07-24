import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { Account } from '../domain/account.entity';
import { USD } from '../domain/currency';
import {
  AccountNotFoundError,
  DomainError,
  InsufficientFundsError,
  TransferAlreadyRefundedError,
  TransferNotFoundError,
  TransferNotRefundableError,
} from '../domain/errors';
import { AccountRepository } from '../domain/ports/account-repository.port';
import {
  Transfer,
  TransferCommand,
  TransferStatus,
} from '../domain/transfer.entity';
import { generateTransferId } from '../common/id/id';
import { seedAccounts } from './seed';

@Injectable()
export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = seedAccounts();
  private readonly transfers = new Map<string, Transfer>();

  async findById(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  async findAll(): Promise<Account[]> {
    return [...this.accounts.values()];
  }

  async findAllTransfers(): Promise<Transfer[]> {
    return [...this.transfers.values()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }

  async findTransferById(id: string): Promise<Transfer | null> {
    return this.transfers.get(id) ?? null;
  }

  async transfer(command: TransferCommand): Promise<Transfer> {
    try {
      return this.executeTransfer(command);
    } catch (error) {
      if (error instanceof DomainError) {
        this.recordFailedTransfer(command, error.code);
      }
      throw error;
    }
  }

  private executeTransfer(command: TransferCommand): Transfer {
    const source = this.requireAccount(command.fromAccountId);
    const target = this.requireAccount(command.toAccountId);
    this.assertSufficientFunds(source, command.amount);
    this.applyBalanceChange(source, -command.amount);
    this.applyBalanceChange(target, command.amount);
    const transfer = this.buildTransfer(command, 'COMPLETED');
    this.transfers.set(transfer.id, transfer);
    return transfer;
  }

  private recordFailedTransfer(command: TransferCommand, reason: string): void {
    const transfer = this.buildTransfer(command, 'FAILED', reason);
    this.transfers.set(transfer.id, transfer);
  }

  async refund(transferId: string): Promise<Transfer> {
    const original = this.transfers.get(transferId);
    if (!original) throw new TransferNotFoundError(transferId);
    this.assertRefundable(original);
    const source = this.requireAccount(original.toAccountId);
    const target = this.requireAccount(original.fromAccountId);
    this.assertSufficientFunds(source, original.amount);
    this.applyBalanceChange(source, -original.amount);
    this.applyBalanceChange(target, original.amount);
    return this.markRefunded(original);
  }

  private assertRefundable(transfer: Transfer): void {
    if (transfer.status === 'REFUNDED') {
      throw new TransferAlreadyRefundedError(transfer.id);
    }
    if (transfer.status !== 'COMPLETED') {
      throw new TransferNotRefundableError(transfer.id);
    }
  }

  private requireAccount(id: string): Account {
    const account = this.accounts.get(id);
    if (!account) {
      throw new AccountNotFoundError(id, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return account;
  }

  private assertSufficientFunds(account: Account, amount: number): void {
    if (account.balance < amount) {
      throw new InsufficientFundsError(account.id);
    }
  }

  private applyBalanceChange(account: Account, delta: number): void {
    account.balance += delta;
    account.updatedAt = new Date().toISOString();
  }

  private buildTransfer(
    command: TransferCommand,
    status: TransferStatus,
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

  private markRefunded(transfer: Transfer): Transfer {
    const refunded: Transfer = {
      ...transfer,
      status: 'REFUNDED',
      refundedAt: new Date().toISOString(),
    };
    this.transfers.set(refunded.id, refunded);
    return refunded;
  }
}
