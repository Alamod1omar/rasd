import { Module } from '@nestjs/common';
import { ShortagesService } from './shortages.service';
import { ShortagesController } from './shortages.controller';
import { SequenceService } from '../common/services/sequence.service';
import { ActivityService } from '../common/services/activity.service';

@Module({
  controllers: [ShortagesController],
  providers: [ShortagesService, SequenceService, ActivityService],
  exports: [ShortagesService],
})
export class ShortagesModule {}
