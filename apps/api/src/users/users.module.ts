import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ActivityService } from '../common/services/activity.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ActivityService],
  exports: [UsersService],
})
export class UsersModule {}
