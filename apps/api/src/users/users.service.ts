import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntityStatus, UserRole, ActivityType, AuthUser } from '../common/types';
import * as bcrypt from 'bcrypt';
import { ActivityService } from '../common/services/activity.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async findAll(currentUser: AuthUser, companyIdFilter?: string) {
    let where: any = {};
    if (currentUser.role === UserRole.SYSTEM_ADMIN) {
      if (companyIdFilter) where.companyId = companyIdFilter;
    } else {
      where.companyId = currentUser.companyId;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        company: {
          select: { id: true, name: true },
        },
        userBranchAccess: {
          include: {
            branch: true,
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
      company: u.company ? { id: u.company.id, name: u.company.name } : null,
      branches: u.userBranchAccess.map((uba) => ({
        id: uba.branch.id,
        name: uba.branch.name,
        code: uba.branch.code,
      })),
    }));
  }

  async findAllForCompany(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: { companyId },
      include: {
        company: { select: { id: true, name: true } },
        userBranchAccess: {
          include: {
            branch: true,
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
      company: u.company ? { id: u.company.id, name: u.company.name } : null,
      branches: u.userBranchAccess.map((uba) => ({
        id: uba.branch.id,
        name: uba.branch.name,
        code: uba.branch.code,
      })),
    }));
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      include: {
        userBranchAccess: {
          include: {
            branch: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      branches: user.userBranchAccess.map((uba) => ({
        id: uba.branch.id,
        name: uba.branch.name,
        code: uba.branch.code,
      })),
    };
  }

  async create(
    companyId: string,
    currentUserId: string,
    data: {
      fullName: string;
      username: string;
      password: string;
      role: UserRole;
      branchIds?: string[];
    },
  ) {
    if (data.role === UserRole.SYSTEM_ADMIN) {
      throw new BadRequestException('لا يمكن إنشاء مدير نظام من هنا');
    }

    const username = data.username.trim();
    const existing = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('اسم المستخدم مستخدم مسبقاً');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        companyId,
        fullName: data.fullName.trim(),
        username,
        passwordHash,
        role: data.role,
        status: EntityStatus.ACTIVE,
      },
    });

    if (data.branchIds && data.branchIds.length > 0) {
      await this.prisma.userBranchAccess.createMany({
        data: data.branchIds.map((branchId) => ({
          userId: user.id,
          branchId,
        })),
        skipDuplicates: true,
      });
    }

    await this.activityService.log(this.prisma, {
      companyId,
      userId: currentUserId,
      type: ActivityType.USER_CREATED,
      description: `تم إنشاء مستخدم جديد: ${user.fullName} (${user.role === UserRole.OPERATOR ? 'مشغّل' : 'مدير شركة'})`,
    });

    return this.findOne(user.id, companyId);
  }

  async update(
    id: string,
    companyId: string,
    currentUserId: string,
    data: {
      fullName?: string;
      password?: string;
      status?: EntityStatus;
      role?: UserRole;
      branchIds?: string[];
    },
  ) {
    await this.findOne(id, companyId);

    const updateData: any = {};
    if (data.fullName) updateData.fullName = data.fullName.trim();
    if (data.status) updateData.status = data.status;
    if (data.role) updateData.role = data.role;
    if (data.password && data.password.trim()) {
      updateData.passwordHash = await bcrypt.hash(data.password.trim(), 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    if (data.branchIds !== undefined) {
      await this.prisma.userBranchAccess.deleteMany({
        where: { userId: id },
      });
      if (data.branchIds.length > 0) {
        await this.prisma.userBranchAccess.createMany({
          data: data.branchIds.map((branchId) => ({
            userId: id,
            branchId,
          })),
        });
      }
    }

    await this.activityService.log(this.prisma, {
      companyId,
      userId: currentUserId,
      type: ActivityType.USER_UPDATED,
      description: `تم تحديث بيانات المستخدم: ${updated.fullName}`,
    });

    return this.findOne(id, companyId);
  }

  async resetPassword(
    id: string,
    currentUser: AuthUser,
    data: { newPassword: string; mustChangePassword?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    if (currentUser.role !== UserRole.SYSTEM_ADMIN && user.companyId !== currentUser.companyId) {
      throw new ForbiddenException('ليس لديك الصلاحية لتعديل هذا المستخدم');
    }

    if (!data.newPassword || data.newPassword.trim().length < 6) {
      throw new BadRequestException('كلمة المرور يجب أن لا تقل عن 6 أحرف');
    }

    const passwordHash = await bcrypt.hash(data.newPassword.trim(), 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    if (user.companyId) {
      await this.activityService.log(this.prisma, {
        companyId: user.companyId,
        userId: currentUser.id,
        type: ActivityType.USER_UPDATED,
        description: `تمت إعادة تعيين كلمة المرور للمستخدم: ${user.fullName}`,
      });
    }

    return {
      success: true,
      message: 'تم إعادة تعيين كلمة المرور بنجاح',
    };
  }

  async deleteOrDeactivate(id: string, currentUser: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    if (currentUser.role !== UserRole.SYSTEM_ADMIN && user.companyId !== currentUser.companyId) {
      throw new ForbiddenException('ليس لديك الصلاحية لحذف هذا المستخدم');
    }

    if (user.id === currentUser.id) {
      throw new BadRequestException('لا يمكنك حذف حسابك الشخصي');
    }

    // Check if user has historical records
    const [salesCount, shortagesCount] = await Promise.all([
      this.prisma.salesRequest.count({ where: { createdById: id } }),
      this.prisma.shortageRequest.count({ where: { createdById: id } }),
    ]);

    if (salesCount > 0 || shortagesCount > 0) {
      // Soft deactivate to preserve historical audit trail
      await this.prisma.user.update({
        where: { id },
        data: { status: EntityStatus.INACTIVE },
      });

      if (user.companyId) {
        await this.activityService.log(this.prisma, {
          companyId: user.companyId,
          userId: currentUser.id,
          type: ActivityType.USER_UPDATED,
          description: `تم تعطيل حساب المستخدم: ${user.fullName} لوجود عمليات سابقة مرتبطة به`,
        });
      }

      return {
        action: 'deactivated',
        message: 'تم تعطيل المستخدم للحفاظ على سجل العمليات التاريخية',
      };
    }

    // No historical records: delete branch access and user safely
    await this.prisma.userBranchAccess.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });

    if (user.companyId) {
      await this.activityService.log(this.prisma, {
        companyId: user.companyId,
        userId: currentUser.id,
        type: ActivityType.USER_UPDATED,
        description: `تم حذف المستخدم نهائياً: ${user.fullName}`,
      });
    }

    return {
      action: 'deleted',
      message: 'تم حذف المستخدم بنجاح',
    };
  }
}
