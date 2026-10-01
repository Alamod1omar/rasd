import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { ActivityService } from '../common/services/activity.service';

@Module({
  controllers: [BranchesController],
  providers: [BranchesService, ActivityService],
  exports: [BranchesService],
})
export class BranchesModule {}
