import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, Length } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ example: 'acc_1' })
  @IsString()
  @Length(1, 64)
  fromAccountId!: string;

  @ApiProperty({ example: 'acc_2' })
  @IsString()
  @Length(1, 64)
  toAccountId!: string;

  @ApiProperty({ example: 2_500, description: 'Amount in integer minor units' })
  @IsInt()
  @IsPositive()
  amount!: number;
}
