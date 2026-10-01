import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, UserRole } from '../common/types';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(user: AuthUser, query: string) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    if (!query || query.trim().length === 0) {
      return { products: [], sales: [], shortages: [] };
    }

    const q = query.trim();

    const branchFilter =
      user.role === UserRole.OPERATOR ? { branchId: { in: user.branchIds } } : {};

    // 1. Search Products
    const products = await this.prisma.product.findMany({
      where: {
        companyId: user.companyId,
        OR: [
          { partNumberNormalized: { contains: q.toUpperCase() } },
          { partName: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 8,
      orderBy: { partNumber: 'asc' },
    });

    // 2. Search Sales
    const sales = await this.prisma.salesRequest.findMany({
      where: {
        companyId: user.companyId,
        ...branchFilter,
        OR: [
          { documentNumber: { contains: q, mode: 'insensitive' } },
          { officialInvoiceNumber: { contains: q, mode: 'insensitive' } },
          {
            items: {
              some: {
                OR: [
                  { partNumberSnapshot: { contains: q, mode: 'insensitive' } },
                  { soldTo: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
      include: {
        branch: { select: { name: true } },
        items: { select: { id: true, quantity: true, unitPrice: true } },
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
    });

    // 3. Search Shortages
    const shortages = await this.prisma.shortageRequest.findMany({
      where: {
        companyId: user.companyId,
        ...branchFilter,
        OR: [
          { documentNumber: { contains: q, mode: 'insensitive' } },
          {
            items: {
              some: {
                OR: [
                  { partNumberSnapshot: { contains: q, mode: 'insensitive' } },
                  { partNameSnapshot: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
      include: {
        branch: { select: { name: true } },
        items: { select: { id: true, quantity: true } },
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
    });

    return {
      products,
      sales: sales.map((s) => ({
        id: s.id,
        documentNumber: s.documentNumber,
        status: s.status,
        branchName: s.branch?.name,
        businessDate: s.businessDate,
        itemsCount: s.items.length,
        totalQuantity: s.items.reduce((sum, it) => sum + Number(it.quantity), 0),
        totalAmount: s.items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unitPrice), 0),
        officialInvoiceNumber: s.officialInvoiceNumber,
      })),
      shortages: shortages.map((sh) => ({
        id: sh.id,
        documentNumber: sh.documentNumber,
        status: sh.status,
        branchName: sh.branch?.name,
        businessDate: sh.businessDate,
        itemsCount: sh.items.length,
        totalQuantity: sh.items.reduce((sum, it) => sum + Number(it.quantity), 0),
      })),
    };
  }
}
