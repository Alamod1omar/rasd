import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntityStatus, ActivityType } from '../common/types';
import { ActivityService } from '../common/services/activity.service';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async findAllForCompany(companyId: string) {
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
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: {
            userBranchAccess: true,
            salesRequests: true,
            shortageRequests: true,
          },
        },
      },
    });
    if (!branch) {
      throw new NotFoundException('الفرع غير موجود');
    }
    return branch;
  }

  async create(companyId: string, userId: string, data: { name: string; code: string }) {
    const code = data.code.trim().toUpperCase();
    const existing = await this.prisma.branch.findUnique({
      where: {
        companyId_code: {
          companyId,
          code,
        },
      },
    });
    if (existing) {
      throw new ConflictException('رمز الفرع مستخدم مسبقاً في هذه الشركة');
    }

    const branch = await this.prisma.branch.create({
      data: {
        companyId,
        name: data.name.trim(),
        code,
        status: EntityStatus.ACTIVE,
      },
    });

    await this.activityService.log(this.prisma, {
      companyId,
      branchId: branch.id,
      userId,
      type: ActivityType.BRANCH_CREATED,
      description: `تم إنشاء فرع جديد: ${branch.name} (${branch.code})`,
    });

    return branch;
  }

  async update(
    id: string,
    companyId: string,
    userId: string,
    data: { name?: string; code?: string; status?: EntityStatus },
  ) {
    const branch = await this.findOne(id, companyId);

    if (data.code && data.code.trim().toUpperCase() !== branch.code) {
      const code = data.code.trim().toUpperCase();
      const existing = await this.prisma.branch.findUnique({
        where: { companyId_code: { companyId, code } },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('رمز الفرع مستخدم مسبقاً في هذه الشركة');
      }
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.code && { code: data.code.trim().toUpperCase() }),
        ...(data.status && { status: data.status }),
      },
    });

    await this.activityService.log(this.prisma, {
      companyId,
      branchId: updated.id,
      userId,
      type: ActivityType.BRANCH_UPDATED,
      description: `تم تحديث بيانات الفرع: ${updated.name}`,
    });

    return updated;
  }

  async deleteOrDeactivate(id: string, user: { id: string; role: any; companyId?: string }) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            salesRequests: true,
            shortageRequests: true,
            userBranchAccess: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('الفرع غير موجود');
    }

    if (user.role !== 'SYSTEM_ADMIN' && branch.companyId !== user.companyId) {
      throw new ConflictException('ليس لديك صلاحية على هذا الفرع');
    }

    const hasHistory =
      branch._count.salesRequests > 0 ||
      branch._count.shortageRequests > 0 ||
      branch._count.userBranchAccess > 0;

    if (hasHistory) {
      await this.prisma.branch.update({
        where: { id },
        data: { status: EntityStatus.INACTIVE },
      });
      await this.activityService.log(this.prisma, {
        companyId: branch.companyId,
        branchId: branch.id,
        userId: user.id,
        type: ActivityType.BRANCH_UPDATED,
        description: `تم تعطيل الفرع (${branch.name}) لوجود سجلات سابقة مرتبطة به`,
      });
      return { success: true, deactivated: true, message: 'تم تعطيل الفرع بنجاح لحفظ السجلات التاريخية المرتبطة به' };
    }

    await this.prisma.branch.delete({ where: { id } });
    await this.activityService.log(this.prisma, {
      companyId: branch.companyId,
      branchId: branch.id,
      userId: user.id,
      type: ActivityType.BRANCH_UPDATED,
      description: `تم حذف الفرع نهائياً (${branch.name}) لعدم وجود سجلات مرتبطة به`,
    });
    return { success: true, deleted: true, message: 'تم حذف الفرع نهائياً' };
  }
}
