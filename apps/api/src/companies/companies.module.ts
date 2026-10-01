import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { ActivityService } from '../common/services/activity.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, ActivityService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
