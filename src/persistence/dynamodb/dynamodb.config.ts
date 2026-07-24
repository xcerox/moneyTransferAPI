const DEFAULT_REGION = 'us-east-1';
const LOCAL_ENDPOINT = 'http://localhost:8000';

export interface DynamoDbConfig {
  region: string;
  endpoint: string | undefined;
  accountsTableName: string;
  transfersTableName: string;
  idempotencyTableName: string;
}

export function isOffline(): boolean {
  return process.env.IS_OFFLINE === 'true';
}

export function loadDynamoDbConfig(): DynamoDbConfig {
  return {
    region: process.env.AWS_REGION ?? DEFAULT_REGION,
    endpoint: isOffline() ? LOCAL_ENDPOINT : undefined,
    accountsTableName: process.env.ACCOUNTS_TABLE_NAME ?? 'accounts',
    transfersTableName: process.env.TRANSFERS_TABLE_NAME ?? 'transfers',
    idempotencyTableName: process.env.IDEMPOTENCY_TABLE_NAME ?? 'idempotency',
  };
}
