import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { SalesModule } from '../sales/sales.module';
import { ShortagesModule } from '../shortages/shortages.module';

@Module({
  imports: [SalesModule, ShortagesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
