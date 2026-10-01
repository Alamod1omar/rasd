import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, ActivityType, UserRole } from '../common/types';

@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: ActivityType,
    @Query('branchId') branchId?: string,
    @Query('userId') filterUserId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 25;
    const skip = (p - 1) * ps;

    const where: any = { companyId: user.companyId };

    if (type) where.type = type;

    if (branchId) {
      where.branchId = branchId;
    } else if (user.role === UserRole.OPERATOR) {
      where.branchId = { in: user.branchIds };
    }

    if (filterUserId) where.userId = filterUserId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (search) {
      const s = search.trim();
      where.OR = [
        { description: { contains: s, mode: 'insensitive' } },
        { referenceNumber: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: ps,
        include: {
          user: { select: { fullName: true, username: true } },
          branch: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items: logs.map((log) => ({
        id: log.id,
        companyId: log.companyId,
        branchId: log.branchId,
        branchName: log.branch?.name || null,
        type: log.type,
        referenceNumber: log.referenceNumber,
        description: log.description,
        userId: log.userId,
        userFullName: log.user.fullName,
        createdAt: log.createdAt,
      })),
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }
}
