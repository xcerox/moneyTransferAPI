export interface StoredResponse {
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
}

export interface IdempotencyStore {
  get(key: string): Promise<StoredResponse | null>;
  save(key: string, value: StoredResponse): Promise<void>;
}

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');
