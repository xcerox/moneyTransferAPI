import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { isOffline, loadDynamoDbConfig } from './dynamodb.config';

export const DYNAMODB_DOCUMENT_CLIENT = Symbol('DYNAMODB_DOCUMENT_CLIENT');

export function createDynamoDbDocumentClient(): DynamoDBDocumentClient {
  const config = loadDynamoDbConfig();
  const client = new DynamoDBClient({
    region: config.region,
    endpoint: config.endpoint,
    credentials: isOffline()
      ? { accessKeyId: 'local', secretAccessKey: 'local' }
      : undefined,
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  });
}
