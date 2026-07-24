import { Injectable } from '@nestjs/common';
import { IdempotencyStore, StoredResponse } from './idempotency-store.port';

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, StoredResponse>();

  async get(key: string): Promise<StoredResponse | null> {
    return this.entries.get(key) ?? null;
  }

  async save(key: string, value: StoredResponse): Promise<void> {
    this.entries.set(key, value);
  }
}
