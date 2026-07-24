import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { AccountResponseDto } from './dto/account-response.dto';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOkResponse({ type: AccountResponseDto, isArray: true })
  async list(): Promise<AccountResponseDto[]> {
    const accounts = await this.accountsService.listAccounts();
    return accounts.map(AccountResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiOkResponse({ type: AccountResponseDto })
  async getById(@Param('id') id: string): Promise<AccountResponseDto> {
    const account = await this.accountsService.getAccount(id);
    return AccountResponseDto.fromEntity(account);
  }
}
