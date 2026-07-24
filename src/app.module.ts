import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { AccountsModule } from './accounts/accounts.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { HealthController } from './health/health.controller';
import { PersistenceModule } from './persistence/persistence.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req) =>
          (req.headers['x-request-id'] as string) ?? randomUUID(),
        redact: ['req.headers.authorization'],
        transport:
          process.env.NODE_ENV === 'local'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    PersistenceModule,
    AccountsModule,
    TransfersModule,
  ],
  controllers: [HealthController],
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
})
export class AppModule {}
