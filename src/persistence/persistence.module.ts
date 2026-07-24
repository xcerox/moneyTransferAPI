import { Module, Provider } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../domain/ports/account-repository.port';
import { IDEMPOTENCY_STORE } from '../common/idempotency/idempotency-store.port';
import { InMemoryIdempotencyStore } from '../common/idempotency/in-memory-idempotency.store';
import { InMemoryAccountRepository } from './in-memory-account.repository';
import {
  DYNAMODB_DOCUMENT_CLIENT,
  createDynamoDbDocumentClient,
} from './dynamodb/dynamodb.client';
import { DynamoDbAccountRepository } from './dynamodb/dynamodb-account.repository';
import { DynamoDbIdempotencyStore } from './dynamodb/dynamodb-idempotency.store';

function usesDynamoDb(): boolean {
  return process.env.REPO_DRIVER === 'dynamodb';
}

function buildProviders(): Provider[] {
  if (usesDynamoDb()) {
    return [
      {
        provide: DYNAMODB_DOCUMENT_CLIENT,
        useFactory: createDynamoDbDocumentClient,
      },
      { provide: ACCOUNT_REPOSITORY, useClass: DynamoDbAccountRepository },
      { provide: IDEMPOTENCY_STORE, useClass: DynamoDbIdempotencyStore },
    ];
  }
  return [
    { provide: ACCOUNT_REPOSITORY, useClass: InMemoryAccountRepository },
    { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
  ];
}

@Module({
  providers: buildProviders(),
  exports: [ACCOUNT_REPOSITORY, IDEMPOTENCY_STORE],
})
export class PersistenceModule {}
