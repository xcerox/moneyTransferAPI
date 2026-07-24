import { Inject, Injectable } from '@nestjs/common';
import { Account } from '../domain/account.entity';
import { AccountNotFoundError } from '../domain/errors';
import {
  ACCOUNT_REPOSITORY,
  AccountRepository,
} from '../domain/ports/account-repository.port';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepository,
  ) {}

  async listAccounts(): Promise<Account[]> {
    return this.accounts.findAll();
  }

  async getAccount(id: string): Promise<Account> {
    const account = await this.accounts.findById(id);
    if (!account) throw new AccountNotFoundError(id);
    return account;
  }
}
