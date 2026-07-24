import {
  AccountNotFoundError,
  InsufficientFundsError,
  TransferAlreadyRefundedError,
  TransferNotFoundError,
  TransferNotRefundableError,
} from '../domain/errors';
import { TransferCommand } from '../domain/transfer.entity';
import { InMemoryAccountRepository } from './in-memory-account.repository';

function command(overrides: Partial<TransferCommand> = {}): TransferCommand {
  return {
    fromAccountId: 'acc_1',
    toAccountId: 'acc_2',
    amount: 2_500,
    idempotencyKey: 'key-1',
    ...overrides,
  };
}

async function totalBalance(repo: InMemoryAccountRepository): Promise<number> {
  const accounts = await repo.findAll();
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

describe('InMemoryAccountRepository', () => {
  let repo: InMemoryAccountRepository;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
  });

  it('debits and credits the exact amount', async () => {
    await repo.transfer(command({ amount: 2_500 }));
    const from = await repo.findById('acc_1');
    const to = await repo.findById('acc_2');
    expect(from?.balance).toBe(97_500);
    expect(to?.balance).toBe(52_500);
  });

  it('conserves total money on a transfer', async () => {
    const before = await totalBalance(repo);
    await repo.transfer(command());
    expect(await totalBalance(repo)).toBe(before);
  });

  it('rejects insufficient funds', async () => {
    await expect(repo.transfer(command({ amount: 200_000 }))).rejects.toThrow(
      InsufficientFundsError,
    );
  });

  it('records a FAILED transfer without moving money on insufficient funds', async () => {
    await expect(repo.transfer(command({ amount: 200_000 }))).rejects.toThrow(
      InsufficientFundsError,
    );
    const transfers = await repo.findAllTransfers();
    expect(transfers).toHaveLength(1);
    expect(transfers[0].status).toBe('FAILED');
    expect(transfers[0].failureReason).toBe('INSUFFICIENT_FUNDS');
    expect((await repo.findById('acc_1'))?.balance).toBe(100_000);
    expect((await repo.findById('acc_2'))?.balance).toBe(50_000);
  });

  it('rejects a missing account', async () => {
    await expect(
      repo.transfer(command({ toAccountId: 'acc_missing' })),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('records a FAILED transfer with ACCOUNT_NOT_FOUND reason', async () => {
    await expect(
      repo.transfer(command({ toAccountId: 'acc_missing' })),
    ).rejects.toThrow(AccountNotFoundError);
    const transfers = await repo.findAllTransfers();
    expect(transfers[0].status).toBe('FAILED');
    expect(transfers[0].failureReason).toBe('ACCOUNT_NOT_FOUND');
  });

  it('refunds a completed transfer and restores balances', async () => {
    const transfer = await repo.transfer(command({ amount: 2_500 }));
    const refunded = await repo.refund(transfer.id);
    expect(refunded.status).toBe('REFUNDED');
    expect(refunded.refundedAt).not.toBeNull();
    expect((await repo.findById('acc_1'))?.balance).toBe(100_000);
    expect((await repo.findById('acc_2'))?.balance).toBe(50_000);
  });

  it('rejects refunding an unknown transfer', async () => {
    await expect(repo.refund('txf_missing')).rejects.toThrow(
      TransferNotFoundError,
    );
  });

  it('rejects refunding twice', async () => {
    const transfer = await repo.transfer(command());
    await repo.refund(transfer.id);
    await expect(repo.refund(transfer.id)).rejects.toThrow(
      TransferAlreadyRefundedError,
    );
  });

  it('rejects refunding a FAILED transfer', async () => {
    await expect(repo.transfer(command({ amount: 200_000 }))).rejects.toThrow(
      InsufficientFundsError,
    );
    const failed = (await repo.findAllTransfers())[0];
    await expect(repo.refund(failed.id)).rejects.toThrow(
      TransferNotRefundableError,
    );
  });

  it('lists all transfers across accounts, newest first', async () => {
    await repo.transfer(command({ idempotencyKey: 'a' }));
    await repo.transfer(
      command({
        fromAccountId: 'acc_2',
        toAccountId: 'acc_3',
        idempotencyKey: 'b',
      }),
    );
    const transfers = await repo.findAllTransfers();
    expect(transfers).toHaveLength(2);
  });
});
