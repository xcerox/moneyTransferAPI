import { createHash } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import {
  IdempotencyKeyConflictError,
  IdempotencyKeyRequiredError,
} from '../../domain/errors';
import {
  IDEMPOTENCY_STORE,
  IdempotencyStore,
  StoredResponse,
} from './idempotency-store.port';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const CREATED_STATUS = 201;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(IDEMPOTENCY_STORE)
    private readonly store: IdempotencyStore,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = readIdempotencyKey(request);
    const requestHash = hashRequestBody(request.body);

    return from(this.store.get(key)).pipe(
      switchMap((existing) =>
        existing
          ? of(replay(existing, requestHash))
          : this.executeAndStore(key, requestHash, next),
      ),
    );
  }

  private executeAndStore(
    key: string,
    requestHash: string,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      tap((responseBody) => {
        void this.store.save(key, {
          requestHash,
          statusCode: CREATED_STATUS,
          responseBody,
        });
      }),
    );
  }
}

function readIdempotencyKey(request: Request): string {
  const value = request.headers[IDEMPOTENCY_HEADER];
  const key = Array.isArray(value) ? value[0] : value;
  if (!key || key.trim().length === 0) {
    throw new IdempotencyKeyRequiredError();
  }
  return key;
}

function hashRequestBody(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');
}

function replay(existing: StoredResponse, requestHash: string): unknown {
  if (existing.requestHash !== requestHash) {
    throw new IdempotencyKeyConflictError();
  }
  return existing.responseBody;
}
