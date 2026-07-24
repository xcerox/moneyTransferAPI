import { PinoLogger } from 'nestjs-pino';
import { InvalidAmountError, SameAccountError } from '../domain/errors';
import { InMemoryAccountRepository } from '../persistence/in-memory-account.repository';
import { TransfersService } from './transfers.service';

function buildService(): {
  service: TransfersService;
  repo: InMemoryAccountRepository;
} {
  const repo = new InMemoryAccountRepository();
  const logger = { info: jest.fn() } as unknown as PinoLogger;
  const service = new TransfersService(repo, logger);
  return { service, repo };
}

describe('TransfersService', () => {
  it('creates a transfer on the happy path', async () => {
    const { service } = buildService();
    const transfer = await service.createTransfer({
      fromAccountId: 'acc_1',
      toAccountId: 'acc_2',
      amount: 2_500,
      idempotencyKey: 'key-1',
    });
    expect(transfer.status).toBe('COMPLETED');
    expect(transfer.amount).toBe(2_500);
  });

  it('rejects a non-integer amount', async () => {
    const { service } = buildService();
    await expect(
      service.createTransfer({
        fromAccountId: 'acc_1',
        toAccountId: 'acc_2',
        amount: 2_500.5,
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow(InvalidAmountError);
  });

  it('rejects transferring to the same account', async () => {
    const { service } = buildService();
    await expect(
      service.createTransfer({
        fromAccountId: 'acc_1',
        toAccountId: 'acc_1',
        amount: 100,
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow(SameAccountError);
  });

  it('refunds a transfer', async () => {
    const { service } = buildService();
    const transfer = await service.createTransfer({
      fromAccountId: 'acc_1',
      toAccountId: 'acc_2',
      amount: 2_500,
      idempotencyKey: 'key-1',
    });
    const refunded = await service.refundTransfer(transfer.id);
    expect(refunded.status).toBe('REFUNDED');
  });
});
