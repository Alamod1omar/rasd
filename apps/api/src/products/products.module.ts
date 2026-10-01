import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ActivityService } from '../common/services/activity.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ActivityService],
  exports: [ProductsService],
})
export class ProductsModule {}
