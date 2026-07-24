import { ApiProperty } from '@nestjs/swagger';
import { Account } from '../../domain/account.entity';
import { Currency, USD } from '../../domain/currency';

export class AccountResponseDto {
  @ApiProperty({ example: 'acc_1' })
  id!: string;

  @ApiProperty({
    example: 97_500,
    description: 'Balance in integer minor units',
  })
  balance!: number;

  @ApiProperty({ example: USD })
  currency!: Currency;

  static fromEntity(account: Account): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = account.id;
    dto.balance = account.balance;
    dto.currency = account.currency;
    return dto;
  }
}
