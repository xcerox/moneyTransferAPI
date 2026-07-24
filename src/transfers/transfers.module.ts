import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [PersistenceModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
