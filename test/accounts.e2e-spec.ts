import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { AccountsModule } from '../src/accounts/accounts.module';
import { APP_FILTER } from '@nestjs/core';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PersistenceModule } from '../src/persistence/persistence.module';

describe('Accounts (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
        PersistenceModule,
        AccountsModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists seeded accounts', async () => {
    const res = await request(app.getHttpServer()).get('/accounts').expect(200);
    expect(res.body).toHaveLength(3);
  });

  it('returns a single account', async () => {
    const res = await request(app.getHttpServer())
      .get('/accounts/acc_1')
      .expect(200);
    expect(res.body).toEqual({
      id: 'acc_1',
      balance: 100_000,
      currency: 'USD',
    });
  });

  it('returns 404 for a missing account', async () => {
    await request(app.getHttpServer())
      .get('/accounts/acc_missing')
      .expect(404)
      .expect((res) => expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND'));
  });
});
