import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AccountsModule } from '../src/accounts/accounts.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PersistenceModule } from '../src/persistence/persistence.module';
import { TransfersModule } from '../src/transfers/transfers.module';

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
      PersistenceModule,
      AccountsModule,
      TransfersModule,
    ],
    providers: [
      {
        provide: APP_PIPE,
        useValue: new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      },
      { provide: APP_FILTER, useClass: DomainExceptionFilter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function transferBody(overrides: Record<string, unknown> = {}) {
  return {
    fromAccountId: 'acc_1',
    toAccountId: 'acc_2',
    amount: 2_500,
    ...overrides,
  };
}

describe('Transfers (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('moves money and reflects it in balances', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody())
      .expect(201);

    const from = await request(app.getHttpServer()).get('/accounts/acc_1');
    const to = await request(app.getHttpServer()).get('/accounts/acc_2');
    expect(from.body.balance).toBe(97_500);
    expect(to.body.balance).toBe(52_500);
  });

  it('returns 409 on insufficient funds', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody({ amount: 500_000 }))
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS'));
  });

  it('returns 422 when a transfer references a missing account', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody({ toAccountId: 'acc_missing' }))
      .expect(422)
      .expect((res) => expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND'));
  });

  it('returns 400 when from == to', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody({ toAccountId: 'acc_1' }))
      .expect(400)
      .expect((res) => expect(res.body.error.code).toBe('SAME_ACCOUNT'));
  });

  it('returns 400 when the Idempotency-Key header is missing', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .send(transferBody())
      .expect(400)
      .expect((res) =>
        expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED'),
      );
  });

  it('returns 400 on a non-integer amount', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody({ amount: 2_500.5 }))
      .expect(400);
  });

  it('replays the same response for a repeated idempotency key', async () => {
    const key = randomUUID();
    const first = await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', key)
      .send(transferBody());
    const second = await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', key)
      .send(transferBody());

    expect(second.body.id).toBe(first.body.id);
    const from = await request(app.getHttpServer()).get('/accounts/acc_1');
    expect(from.body.balance).toBe(97_500);
  });

  it('returns 409 when the same key is reused with a different body', async () => {
    const key = randomUUID();
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', key)
      .send(transferBody({ amount: 2_500 }));
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', key)
      .send(transferBody({ amount: 9_999 }))
      .expect(409)
      .expect((res) =>
        expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT'),
      );
  });

  it('keeps balances consistent under concurrency without overdraw', async () => {
    const server = app.getHttpServer();
    server.listen(0);
    const agent = request.agent(server);
    const requests = Array.from({ length: 60 }, () =>
      agent
        .post('/transfers')
        .set('Idempotency-Key', randomUUID())
        .send(
          transferBody({
            fromAccountId: 'acc_1',
            toAccountId: 'acc_2',
            amount: 1_000,
          }),
        ),
    );
    await Promise.all(requests);

    const from = await agent.get('/accounts/acc_1');
    const to = await agent.get('/accounts/acc_2');
    expect(from.body.balance).toBe(40_000);
    expect(to.body.balance).toBe(110_000);
    expect(from.body.balance + to.body.balance).toBe(150_000);
  });

  it('lists all transfers across accounts', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(
        transferBody({
          fromAccountId: 'acc_1',
          toAccountId: 'acc_2',
          amount: 1_000,
        }),
      );
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(
        transferBody({
          fromAccountId: 'acc_2',
          toAccountId: 'acc_3',
          amount: 500,
        }),
      );

    const history = await request(app.getHttpServer())
      .get('/transfers')
      .expect(200);
    expect(history.body).toHaveLength(2);
    expect(history.body[0]).toHaveProperty('fromAccountId');
  });

  it('records a failed transfer in the history as FAILED', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody({ amount: 500_000 }))
      .expect(409);

    const history = await request(app.getHttpServer())
      .get('/transfers')
      .expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].status).toBe('FAILED');
    expect(history.body[0].failureReason).toBe('INSUFFICIENT_FUNDS');
  });

  it('returns 409 when refunding a failed transfer', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody({ amount: 500_000 }))
      .expect(409);
    const failed = (await request(app.getHttpServer()).get('/transfers'))
      .body[0];

    await request(app.getHttpServer())
      .post(`/transfers/${failed.id}/refund`)
      .expect(409)
      .expect((res) =>
        expect(res.body.error.code).toBe('TRANSFER_NOT_REFUNDABLE'),
      );
  });

  it('refunds a transfer and restores balances', async () => {
    const created = await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody({ amount: 2_500 }));

    const refund = await request(app.getHttpServer())
      .post(`/transfers/${created.body.id}/refund`)
      .expect(200);
    expect(refund.body.status).toBe('REFUNDED');

    const from = await request(app.getHttpServer()).get('/accounts/acc_1');
    const to = await request(app.getHttpServer()).get('/accounts/acc_2');
    expect(from.body.balance).toBe(100_000);
    expect(to.body.balance).toBe(50_000);
  });

  it('returns 409 when refunding an already refunded transfer', async () => {
    const created = await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(transferBody());
    await request(app.getHttpServer()).post(
      `/transfers/${created.body.id}/refund`,
    );
    await request(app.getHttpServer())
      .post(`/transfers/${created.body.id}/refund`)
      .expect(409)
      .expect((res) =>
        expect(res.body.error.code).toBe('TRANSFER_ALREADY_REFUNDED'),
      );
  });

  it('returns 404 when refunding an unknown transfer', async () => {
    await request(app.getHttpServer())
      .post('/transfers/txf_missing/refund')
      .expect(404)
      .expect((res) => expect(res.body.error.code).toBe('TRANSFER_NOT_FOUND'));
  });
});
