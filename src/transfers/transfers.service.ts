import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { assertValidAmount } from '../common/money/money';
import { SameAccountError } from '../domain/errors';
import {
  ACCOUNT_REPOSITORY,
  AccountRepository,
} from '../domain/ports/account-repository.port';
import { Transfer, TransferCommand } from '../domain/transfer.entity';

@Injectable()
export class TransfersService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepository,
    @InjectPinoLogger(TransfersService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createTransfer(command: TransferCommand): Promise<Transfer> {
    assertValidAmount(command.amount);
    this.assertDifferentAccounts(command.fromAccountId, command.toAccountId);
    const transfer = await this.accounts.transfer(command);
    this.logger.info(
      {
        event: 'transfer.completed',
        transferId: transfer.id,
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amount: transfer.amount,
        idempotencyKey: transfer.idempotencyKey,
      },
      'transfer completed',
    );
    return transfer;
  }

  async listTransfers(): Promise<Transfer[]> {
    return this.accounts.findAllTransfers();
  }

  async refundTransfer(transferId: string): Promise<Transfer> {
    const transfer = await this.accounts.refund(transferId);
    this.logger.info(
      {
        event: 'transfer.refunded',
        transferId: transfer.id,
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amount: transfer.amount,
      },
      'transfer refunded',
    );
    return transfer;
  }

  private assertDifferentAccounts(from: string, to: string): void {
    if (from === to) throw new SameAccountError();
  }
}
