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

  async update(id: string, data: { name?: string; status?: EntityStatus; logo?: string }) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.status && { status: data.status }),
        ...(data.logo !== undefined && { logo: data.logo }),
      },
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

