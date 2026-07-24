import { InvalidAmountError } from '../../domain/errors';

const MINIMUM_TRANSFERABLE_AMOUNT = 1;

export function assertValidAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount < MINIMUM_TRANSFERABLE_AMOUNT) {
    throw new InvalidAmountError(amount);
  }
}
