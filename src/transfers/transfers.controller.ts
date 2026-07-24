import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferResponseDto } from './dto/transfer-response.dto';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key that makes retries safe (same key + body replays)',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async create(
    @Body() dto: CreateTransferDto,
    @Headers('Idempotency-Key') idempotencyKey: string,
  ): Promise<TransferResponseDto> {
    const transfer = await this.transfersService.createTransfer({
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount: dto.amount,
      idempotencyKey,
    });
    return TransferResponseDto.fromEntity(transfer);
  }

  @Get()
  @ApiOkResponse({ type: TransferResponseDto, isArray: true })
  async list(): Promise<TransferResponseDto[]> {
    const transfers = await this.transfersService.listTransfers();
    return transfers.map(TransferResponseDto.fromEntity);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TransferResponseDto })
  async refund(@Param('id') id: string): Promise<TransferResponseDto> {
    const transfer = await this.transfersService.refundTransfer(id);
    return TransferResponseDto.fromEntity(transfer);
  }
}
