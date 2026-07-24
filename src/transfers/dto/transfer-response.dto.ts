import { ApiProperty } from '@nestjs/swagger';
import { Currency, USD } from '../../domain/currency';
import { Transfer, TransferStatus } from '../../domain/transfer.entity';

export class TransferResponseDto {
  @ApiProperty({ example: 'txf_9f2c...' })
  id!: string;

  @ApiProperty({ example: 'acc_1' })
  fromAccountId!: string;

  @ApiProperty({ example: 'acc_2' })
  toAccountId!: string;

  @ApiProperty({ example: 2_500 })
  amount!: number;

  @ApiProperty({ example: USD })
  currency!: Currency;

  @ApiProperty({
    example: 'COMPLETED',
    enum: ['COMPLETED', 'REFUNDED', 'FAILED'],
  })
  status!: TransferStatus;

  @ApiProperty({ example: '2026-01-15T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: null, nullable: true })
  refundedAt!: string | null;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Error code when status is FAILED',
  })
  failureReason!: string | null;

  static fromEntity(transfer: Transfer): TransferResponseDto {
    const dto = new TransferResponseDto();
    dto.id = transfer.id;
    dto.fromAccountId = transfer.fromAccountId;
    dto.toAccountId = transfer.toAccountId;
    dto.amount = transfer.amount;
    dto.currency = transfer.currency;
    dto.status = transfer.status;
    dto.createdAt = transfer.createdAt;
    dto.refundedAt = transfer.refundedAt;
    dto.failureReason = transfer.failureReason;
    return dto;
  }
}
