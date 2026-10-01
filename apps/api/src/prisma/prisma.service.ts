import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, UserRole, EntityStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.ensureBootstrapData();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Ensures default platform administrator and seed data exist in the database.
   * Runs idempotently on application startup.
   */
  async ensureBootstrapData() {
    try {
      // 1. Ensure System Administrator: omaradmin / Al-1234567
      const existingAdmin = await this.user.findFirst({
        where: {
          username: { equals: 'omaradmin', mode: 'insensitive' },
        },
      });

      if (!existingAdmin) {
        this.logger.log('⚡ Initializing System Admin account (omaradmin)...');
        const adminHash = await bcrypt.hash('Al-1234567', 10);
        await this.user.create({
          data: {
            username: 'omaradmin',
            fullName: 'عمر العمودي',
            passwordHash: adminHash,
            role: UserRole.SYSTEM_ADMIN,
            status: EntityStatus.ACTIVE,
          },
        });
        this.logger.log('✅ System Admin (omaradmin) successfully created.');
      }

      // 2. Ensure initial company, branches, and admin/operator exist
      const companyCount = await this.company.count();
      if (companyCount === 0) {
        this.logger.log('⚡ Initializing default company, branches, and staff...');
        const company = await this.company.create({
          data: {
            name: 'شركة رصد للمعدات وقطع الغيار',
            code: 'RASD-01',
            status: EntityStatus.ACTIVE,
          },
        });

        const branchRiyadh = await this.branch.create({
          data: {
            companyId: company.id,
            name: 'الفرع الرئيسي - الرياض',
            code: 'MAIN-RYD',
            status: EntityStatus.ACTIVE,
          },
        });

        const branchJeddah = await this.branch.create({
          data: {
            companyId: company.id,
            name: 'فرع المنطقة الغربية - جدة',
            code: 'BR-JED',
            status: EntityStatus.ACTIVE,
          },
        });

        const compPasswordHash = await bcrypt.hash('Admin@123456', 10);
        const operatorPasswordHash = await bcrypt.hash('Operator@123456', 10);

        const compAdmin = await this.user.create({
          data: {
            companyId: company.id,
            username: 'admin_omar',
            fullName: 'عمر العمودي (مدير الشركة)',
            passwordHash: compPasswordHash,
            role: UserRole.COMPANY_ADMIN,
            status: EntityStatus.ACTIVE,
          },
        });

        const operatorAhmed = await this.user.create({
          data: {
            companyId: company.id,
            username: 'ahmed',
            fullName: 'أحمد محمد',
            passwordHash: operatorPasswordHash,
            role: UserRole.OPERATOR,
            status: EntityStatus.ACTIVE,
          },
        });

        await this.userBranchAccess.createMany({
          data: [
            { userId: compAdmin.id, branchId: branchRiyadh.id },
            { userId: compAdmin.id, branchId: branchJeddah.id },
            { userId: operatorAhmed.id, branchId: branchRiyadh.id },
          ],
        });

        this.logger.log('✅ Default company and seed users successfully initialized.');
      }
    } catch (error) {
      this.logger.error('Error during database bootstrap initialization', error);
    }
  }
}

