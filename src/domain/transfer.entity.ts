import { Currency } from './currency';

export type TransferStatus = 'COMPLETED' | 'REFUNDED' | 'FAILED';

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: Currency;
  status: TransferStatus;
  idempotencyKey: string;
  createdAt: string;
  refundedAt: string | null;
  refundOfTransferId: string | null;
  failureReason: string | null;
}

export interface TransferCommand {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  idempotencyKey: string;
}
