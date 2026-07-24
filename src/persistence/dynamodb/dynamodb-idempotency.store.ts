import { Inject, Injectable } from '@nestjs/common';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  IdempotencyStore,
  StoredResponse,
} from '../../common/idempotency/idempotency-store.port';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamodb.client';
import { DynamoDbConfig, loadDynamoDbConfig } from './dynamodb.config';

const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class DynamoDbIdempotencyStore implements IdempotencyStore {
  private readonly config: DynamoDbConfig = loadDynamoDbConfig();

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly client: DynamoDBDocumentClient,
  ) {}

  async get(key: string): Promise<StoredResponse | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.config.idempotencyTableName,
        Key: { idempotencyKey: key },
      }),
    );
    if (!result.Item) return null;
    return {
      requestHash: result.Item.requestHash as string,
      statusCode: result.Item.statusCode as number,
      responseBody: result.Item.responseBody,
    };
  }

  async save(key: string, value: StoredResponse): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.config.idempotencyTableName,
        Item: {
          idempotencyKey: key,
          requestHash: value.requestHash,
          statusCode: value.statusCode,
          responseBody: value.responseBody,
          expiresAt: Math.floor(Date.now() / 1000) + TTL_SECONDS,
        },
      }),
    );
  }
}
