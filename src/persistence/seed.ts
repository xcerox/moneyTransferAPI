import { Account } from '../domain/account.entity';
import { USD } from '../domain/currency';

const SEED_ACCOUNTS: ReadonlyArray<Pick<Account, 'id' | 'balance'>> = [
  { id: 'acc_1', balance: 100_000 },
  { id: 'acc_2', balance: 50_000 },
  { id: 'acc_3', balance: 0 },
];

export function seedAccounts(): Map<string, Account> {
  const now = new Date().toISOString();
  const accounts = new Map<string, Account>();
  for (const { id, balance } of SEED_ACCOUNTS) {
    accounts.set(id, {
      id,
      balance,
      currency: USD,
      createdAt: now,
      updatedAt: now,
    });
  }
  return accounts;
}
