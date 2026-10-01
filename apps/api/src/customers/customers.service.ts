import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    // Normalize Arabic characters for consistent matching
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    // Remove Arabic tashkeel (diacritics)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .toLowerCase();
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Search customers by partial name or phone within company tenant
   */
  async search(companyId: string, query: string, limit: number = 10) {
    if (!companyId) return [];
    const q = (query || '').trim();
    if (!q) {
      return this.prisma.customer.findMany({
        where: {
          companyId,
          active: true,
        },
        orderBy: { name: 'asc' },
        take: limit,
      });
    }

    const normalizedQ = normalizeCustomerName(q);

    // Search by name (contains), normalizedName (contains), or phone (contains)
    return this.prisma.customer.findMany({
      where: {
        companyId,
        active: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { normalizedName: { contains: normalizedQ } },
          { phone: { contains: q } },
        ],
      },
      orderBy: { name: 'asc' },
      take: limit,
    });
  }

  /**
   * Find existing customer by normalized name or ID, or create new customer atomically inside a Prisma transaction
   */
  async findOrCreateInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    data: {
      id?: string;
      name: string;
      phone?: string;
      taxNumber?: string;
      city?: string;
    },
  ) {
    const rawName = (data.name || '').replace(/\s+/g, ' ').trim();
    if (!rawName) {
      throw new BadRequestException('اسم العميل مطلوب');
    }

    // 1. If explicit customer ID provided, verify it belongs to this company
    if (data.id) {
      const existingById = await tx.customer.findFirst({
        where: { id: data.id, companyId },
      });
      if (existingById) {
        return existingById;
      }
    }

    const normalizedName = normalizeCustomerName(rawName);

    // 2. Search for existing customer with same normalized name within company
    const existing = await tx.customer.findUnique({
      where: {
        companyId_normalizedName: {
          companyId,
          normalizedName,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // 3. Create new customer record
    return tx.customer.create({
      data: {
        companyId,
        name: rawName,
        normalizedName,
        phone: data.phone?.trim() || null,
        taxNumber: data.taxNumber?.trim() || null,
        city: data.city?.trim() || null,
        createdById: userId,
        active: true,
      },
    });
  }

  async getAll(companyId: string, page: number = 1, pageSize: number = 20, search?: string) {
    const where: Prisma.CustomerWhereInput = {
      companyId,
      active: true,
    };

    if (search && search.trim()) {
      const q = search.trim();
      const nq = normalizeCustomerName(q);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { normalizedName: { contains: nq } },
        { phone: { contains: q } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdBy: { select: { fullName: true } },
          _count: { select: { sales: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
