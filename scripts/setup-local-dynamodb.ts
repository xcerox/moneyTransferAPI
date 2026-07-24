import {
  CreateTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const ACCOUNTS_TABLE = process.env.ACCOUNTS_TABLE_NAME ?? 'accounts';
const TRANSFERS_TABLE = process.env.TRANSFERS_TABLE_NAME ?? 'transfers';
const IDEMPOTENCY_TABLE = process.env.IDEMPOTENCY_TABLE_NAME ?? 'idempotency';

const SEED_ACCOUNTS = [
  { accountId: 'acc_1', balance: 100_000 },
  { accountId: 'acc_2', balance: 50_000 },
  { accountId: 'acc_3', balance: 0 },
];

function buildClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: 'us-east-1',
    endpoint: ENDPOINT,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
}

async function createTable(
  client: DynamoDBClient,
  tableName: string,
  keyName: string,
  existing: string[],
): Promise<void> {
  if (existing.includes(tableName)) {
    process.stdout.write(`table ${tableName} already exists\n`);
    return;
  }
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{ AttributeName: keyName, AttributeType: 'S' }],
      KeySchema: [{ AttributeName: keyName, KeyType: 'HASH' }],
    }),
  );
  process.stdout.write(`created table ${tableName}\n`);
}

async function enableTtl(
  client: DynamoDBClient,
  tableName: string,
): Promise<void> {
  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: 'expiresAt',
        },
      }),
    );
  } catch {
    process.stdout.write(`ttl already enabled on ${tableName}\n`);
  }
}

async function seedAccounts(client: DynamoDBClient): Promise<void> {
  const doc = DynamoDBDocumentClient.from(client);
  const now = new Date().toISOString();
  for (const account of SEED_ACCOUNTS) {
    await doc.send(
      new PutCommand({
        TableName: ACCOUNTS_TABLE,
        Item: { ...account, currency: 'USD', createdAt: now, updatedAt: now },
      }),
    );
  }
  process.stdout.write(`seeded ${SEED_ACCOUNTS.length} accounts\n`);
}

async function main(): Promise<void> {
  const client = buildClient();
  const listed = await client.send(new ListTablesCommand({}));
  const existing = listed.TableNames ?? [];
  await createTable(client, ACCOUNTS_TABLE, 'accountId', existing);
  await createTable(client, TRANSFERS_TABLE, 'transferId', existing);
  await createTable(client, IDEMPOTENCY_TABLE, 'idempotencyKey', existing);
  await enableTtl(client, IDEMPOTENCY_TABLE);
  await seedAccounts(client);
  process.stdout.write('local DynamoDB ready\n');
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
