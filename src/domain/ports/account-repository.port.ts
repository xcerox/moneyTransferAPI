import { Account } from '../account.entity';
import { Transfer, TransferCommand } from '../transfer.entity';

export interface AccountRepository {
  findById(id: string): Promise<Account | null>;
  findAll(): Promise<Account[]>;
  transfer(command: TransferCommand): Promise<Transfer>;
  findAllTransfers(): Promise<Transfer[]>;
  findTransferById(id: string): Promise<Transfer | null>;
  refund(transferId: string): Promise<Transfer>;
}

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
