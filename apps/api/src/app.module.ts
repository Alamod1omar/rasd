import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { BranchesModule } from './branches/branches.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { ShortagesModule } from './shortages/shortages.module';
import { ActivityModule } from './activity/activity.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { CustomersModule } from './customers/customers.module';
import { BackupModule } from './backup/backup.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CompaniesModule,
    BranchesModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    SalesModule,
    ShortagesModule,
    ActivityModule,
    DashboardModule,
    SearchModule,
    BackupModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
