import { Account } from '../../domain/account.entity';
import { USD } from '../../domain/currency';
import { Transfer } from '../../domain/transfer.entity';

export function toAccount(item: Record<string, unknown>): Account {
  return {
    id: item.accountId as string,
    balance: item.balance as number,
    currency: USD,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}

export function toAccountItem(account: Account): Record<string, unknown> {
  return {
    accountId: account.id,
    balance: account.balance,
    currency: account.currency,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function toTransfer(item: Record<string, unknown>): Transfer {
  return {
    id: item.transferId as string,
    fromAccountId: item.fromAccountId as string,
    toAccountId: item.toAccountId as string,
    amount: item.amount as number,
    currency: USD,
    status: item.status as Transfer['status'],
    idempotencyKey: item.idempotencyKey as string,
    createdAt: item.createdAt as string,
    refundedAt: (item.refundedAt as string | undefined) ?? null,
    refundOfTransferId: (item.refundOfTransferId as string | undefined) ?? null,
    failureReason: (item.failureReason as string | undefined) ?? null,
  };
}

export function toTransferItem(transfer: Transfer): Record<string, unknown> {
  return {
    transferId: transfer.id,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    amount: transfer.amount,
    currency: transfer.currency,
    status: transfer.status,
    idempotencyKey: transfer.idempotencyKey,
    createdAt: transfer.createdAt,
    refundedAt: transfer.refundedAt,
    refundOfTransferId: transfer.refundOfTransferId,
    failureReason: transfer.failureReason,
  };
}
