import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityType, Prisma } from '@prisma/client';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async log(
    txOrPrisma: Prisma.TransactionClient | PrismaService,
    params: {
      companyId: string;
      branchId?: string | null;
      userId: string;
      type: ActivityType;
      referenceNumber?: string | null;
      description: string;
    },
  ) {
    return txOrPrisma.activityLog.create({
      data: {
        companyId: params.companyId,
        branchId: params.branchId,
        userId: params.userId,
        type: params.type,
        referenceNumber: params.referenceNumber,
        description: params.description,
      },
    });
  }
}
