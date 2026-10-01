import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntityStatus, UserRole, ActivityType } from '../common/types';
import * as bcrypt from 'bcrypt';
import { ActivityService } from '../common/services/activity.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async findAll() {
    const companies = await this.prisma.company.findMany({
      include: {
        users: {
          where: { role: UserRole.COMPANY_ADMIN },
          select: { id: true, fullName: true, username: true, status: true },
        },
        _count: {
          select: {
            branches: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      logo: c.logo,
      status: c.status,
      admins: c.users,
      branchesCount: c._count.branches,
      usersCount: c._count.users,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        branches: true,
        _count: {
          select: { users: true, products: true, salesRequests: true, shortageRequests: true },
        },
      },
    });
    if (!company) {
      throw new NotFoundException('الشركة غير موجودة');
    }
    return company;
  }

  async create(data: { name: string; code: string }) {
    const existing = await this.prisma.company.findUnique({
      where: { code: data.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException('رمز الشركة مستخدم بالفعل');
    }

    return this.prisma.company.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        status: EntityStatus.ACTIVE,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; code?: string; status?: EntityStatus; logo?: string },
  ) {
    const company = await this.findOne(id);

    if (data.code && data.code.trim().toUpperCase() !== company.code) {
      const existing = await this.prisma.company.findUnique({
        where: { code: data.code.trim().toUpperCase() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('رمز الشركة مستخدم بالفعل لشركة أخرى');
      }
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.code && { code: data.code.trim().toUpperCase() }),
        ...(data.status && { status: data.status }),
        ...(data.logo !== undefined && { logo: data.logo }),
      },
    });
  }

  async delete(id: string, _adminUserId: string) {
    const company = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // 1. Audit logs & Activity logs
      await tx.activityLog.deleteMany({ where: { companyId: id } });
      await tx.auditLog.deleteMany({ where: { companyId: id } });

      // 2. Shortages (Events -> Items -> Requests)
      const shortageRequests = await tx.shortageRequest.findMany({
        where: { companyId: id },
        select: { id: true },
      });
      const shortageReqIds = shortageRequests.map((r) => r.id);
      if (shortageReqIds.length > 0) {
        const shortageItems = await tx.shortageItem.findMany({
          where: { shortageRequestId: { in: shortageReqIds } },
          select: { id: true },
        });
        const shortageItemIds = shortageItems.map((i) => i.id);
        if (shortageItemIds.length > 0) {
          await tx.shortageItemEvent.deleteMany({
            where: { shortageItemId: { in: shortageItemIds } },
          });
        }
        await tx.shortageItem.deleteMany({
          where: { shortageRequestId: { in: shortageReqIds } },
        });
        await tx.shortageRequest.deleteMany({ where: { companyId: id } });
      }

      // 3. Sales (Items -> Requests)
      const salesRequests = await tx.salesRequest.findMany({
        where: { companyId: id },
        select: { id: true },
      });
      const salesReqIds = salesRequests.map((r) => r.id);
      if (salesReqIds.length > 0) {
        await tx.salesItem.deleteMany({
          where: { salesRequestId: { in: salesReqIds } },
        });
        await tx.salesRequest.deleteMany({ where: { companyId: id } });
      }

      // 4. Document Sequences, Customers, Products
      await tx.documentSequence.deleteMany({ where: { companyId: id } });
      await tx.customer.deleteMany({ where: { companyId: id } });

      const products = await tx.product.findMany({
        where: { companyId: id },
        select: { id: true },
      });
      const prodIds = products.map((p) => p.id);
      if (prodIds.length > 0) {
        await tx.productAlternativeNumber.deleteMany({
          where: { productId: { in: prodIds } },
        });
        await tx.product.deleteMany({ where: { companyId: id } });
      }

      // 5. User branch access & users
      const users = await tx.user.findMany({
        where: { companyId: id },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      if (userIds.length > 0) {
        await tx.userBranchAccess.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.user.deleteMany({ where: { companyId: id } });
      }

      // 6. Branches
      await tx.branch.deleteMany({ where: { companyId: id } });

      // 7. Delete the company
      await tx.company.delete({ where: { id } });

      return { success: true, message: `تم حذف شركة (${company.name}) وكافة بياناتها بنجاح` };
    });
  }

  async createInitialAdmin(
    companyId: string,
    data: { fullName: string; username: string; password: string },
    adminUserId: string,
  ) {
    const company = await this.findOne(companyId);

    const existingUser = await this.prisma.user.findUnique({
      where: { username: data.username.trim() },
    });
    if (existingUser) {
      throw new ConflictException('اسم المستخدم مستخدم بالفعل');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        companyId: company.id,
        fullName: data.fullName.trim(),
        username: data.username.trim(),
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: EntityStatus.ACTIVE,
      },
    });

    await this.activityService.log(this.prisma, {
      companyId: company.id,
      userId: adminUserId,
      type: ActivityType.USER_CREATED,
      description: `تم إنشاء مدير الشركة الأول (${newUser.fullName})`,
    });

    return {
      id: newUser.id,
      fullName: newUser.fullName,
      username: newUser.username,
      role: newUser.role,
      status: newUser.status,
    };
  }

  async findCompanyBranches(companyId: string) {
    return this.prisma.branch.findMany({
      where: { companyId },
      include: {
        _count: {
          select: {
            userBranchAccess: true,
            salesRequests: true,
            shortageRequests: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCompanyUsers(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: { companyId },
      include: {
        userBranchAccess: {
          include: {
            branch: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      branches: u.userBranchAccess.map((uba) => ({
        id: uba.branch.id,
        name: uba.branch.name,
        code: uba.branch.code,
      })),
    }));
  }
}

