import { randomUUID } from 'node:crypto';

export function generateTransferId(): string {
  return `txf_${randomUUID()}`;
}
