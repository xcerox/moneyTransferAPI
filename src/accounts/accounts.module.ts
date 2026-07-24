import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [PersistenceModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
