import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
import { ShortagesService } from '../shortages/shortages.service';
import { AuthUser, SalesRequestStatus, ShortageRequestStatus, UserRole } from '../common/types';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private salesService: SalesService,
    private shortagesService: ShortagesService,
  ) {}

  async getSummary(user: AuthUser, branchIdQuery?: string) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const branchId = branchIdQuery || user.currentBranchId;

    const branchFilter = branchId
      ? { branchId }
      : user.role === UserRole.OPERATOR
        ? { branchId: { in: user.branchIds } }
        : {};

    // 1. Uninvoiced sales requests & totals
    const uninvoicedRequests = await this.prisma.salesRequest.findMany({
      where: {
        companyId: user.companyId,
        status: SalesRequestStatus.UNINVOICED,
        ...branchFilter,
      },
      include: {
        items: {
          select: {
            quantity: true,
            unitPrice: true,
          },
        },
      },
    });

    const uninvoicedSalesCount = uninvoicedRequests.length;
    const uninvoicedSalesTotalAmount = uninvoicedRequests.reduce((total, req) => {
      return (
        total +
        req.items.reduce((sub, it) => sub + Number(it.quantity) * Number(it.unitPrice), 0)
      );
    }, 0);

    // 2. Open shortages & total quantities
    const openShortages = await this.prisma.shortageRequest.findMany({
      where: {
        companyId: user.companyId,
        status: ShortageRequestStatus.OPEN,
        ...branchFilter,
      },
      include: {
        items: {
          select: {
            quantity: true,
          },
        },
      },
    });

    const openShortagesCount = openShortages.length;
    const openShortagesTotalQuantity = openShortages.reduce((total, req) => {
      return total + req.items.reduce((sub, it) => sub + Number(it.quantity), 0);
    }, 0);

    // 3. Current active requests for the active branch
    let currentActiveSale = null;
    let currentActiveShortage = null;

    if (branchId) {
      currentActiveSale = await this.salesService.getActiveRequest(user.companyId, branchId);
      currentActiveShortage = await this.shortagesService.getActiveRequest(user.companyId, branchId);
    }

    // 4. Today's activities
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayActivitiesRaw = await this.prisma.activityLog.findMany({
      where: {
        companyId: user.companyId,
        createdAt: { gte: startOfToday },
        ...branchFilter,
      },
      include: {
        user: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const todayActivities = todayActivitiesRaw.map((log) => ({
      id: log.id,
      companyId: log.companyId,
      branchId: log.branchId,
      branchName: log.branch?.name || null,
      type: log.type,
      referenceNumber: log.referenceNumber,
      description: log.description,
      userId: log.userId,
      userFullName: log.user.fullName,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      uninvoicedSalesCount,
      uninvoicedSalesTotalAmount,
      openShortagesCount,
      openShortagesTotalQuantity,
      currentActiveSale,
      currentActiveShortage,
      todayActivities,
    };
  }
}
