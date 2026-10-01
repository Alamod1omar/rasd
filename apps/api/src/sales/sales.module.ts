import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SequenceService } from '../common/services/sequence.service';
import { ActivityService } from '../common/services/activity.service';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  controllers: [SalesController],
  providers: [SalesService, SequenceService, ActivityService],
  exports: [SalesService],
})
export class SalesModule {}
