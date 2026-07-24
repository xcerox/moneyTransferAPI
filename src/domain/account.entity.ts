import { Currency } from './currency';

export interface Account {
  id: string;
  balance: number;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}
