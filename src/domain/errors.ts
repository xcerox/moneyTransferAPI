import { HttpStatus } from '@nestjs/common';

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: HttpStatus;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidAmountError extends DomainError {
  readonly code = 'INVALID_AMOUNT';
  readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor(amount: number) {
    super(
      `Amount must be a positive integer in minor units, received ${amount}`,
    );
  }
}

export class SameAccountError extends DomainError {
  readonly code = 'SAME_ACCOUNT';
  readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor() {
    super('Source and destination accounts must be different');
  }
}

export class IdempotencyKeyRequiredError extends DomainError {
  readonly code = 'IDEMPOTENCY_KEY_REQUIRED';
  readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor() {
    super('The Idempotency-Key header is required for this operation');
  }
}

export class IdempotencyKeyConflictError extends DomainError {
  readonly code = 'IDEMPOTENCY_KEY_CONFLICT';
  readonly httpStatus = HttpStatus.CONFLICT;

  constructor() {
    super('The Idempotency-Key was already used with a different request body');
  }
}

export class AccountNotFoundError extends DomainError {
  readonly code = 'ACCOUNT_NOT_FOUND';
  readonly httpStatus: HttpStatus;

  constructor(
    accountId: string,
    httpStatus: HttpStatus = HttpStatus.NOT_FOUND,
  ) {
    super(`Account ${accountId} was not found`);
    this.httpStatus = httpStatus;
  }
}

export class InsufficientFundsError extends DomainError {
  readonly code = 'INSUFFICIENT_FUNDS';
  readonly httpStatus = HttpStatus.CONFLICT;

  constructor(accountId: string) {
    super(`Account ${accountId} has insufficient funds for this transfer`);
  }
}

export class TransferNotFoundError extends DomainError {
  readonly code = 'TRANSFER_NOT_FOUND';
  readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(transferId: string) {
    super(`Transfer ${transferId} was not found`);
  }
}

export class TransferAlreadyRefundedError extends DomainError {
  readonly code = 'TRANSFER_ALREADY_REFUNDED';
  readonly httpStatus = HttpStatus.CONFLICT;

  constructor(transferId: string) {
    super(`Transfer ${transferId} was already refunded`);
  }
}

export class TransferNotRefundableError extends DomainError {
  readonly code = 'TRANSFER_NOT_REFUNDABLE';
  readonly httpStatus = HttpStatus.CONFLICT;

  constructor(transferId: string) {
    super(`Transfer ${transferId} is not in a refundable state`);
  }
}
