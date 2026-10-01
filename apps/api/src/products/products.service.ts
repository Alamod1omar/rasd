import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntityStatus, ActivityType, normalizePartNumber, normalizeBrand } from '../common/types';
import { ActivityService } from '../common/services/activity.service';
import * as xlsx from 'xlsx';
import { Buffer } from 'buffer';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async getDefaultCompanyId(): Promise<string | null> {
    const c = await this.prisma.company.findFirst({
      where: { status: EntityStatus.ACTIVE },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return c ? c.id : null;
  }

  /**
   * List all products for management catalog.
   * Supports searching by primary part number (original or normalized),
   * brand, name, and alternative numbers.
   */
  async findAll(
    companyId: string,
    query: {
      search?: string;
      brand?: string;
      status?: EntityStatus;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.brand) {
      where.brand = { equals: query.brand, mode: 'insensitive' };
    }

    if (query.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      const sNorm = normalizePartNumber(s);

      where.OR = [
        { partNumber: { contains: s, mode: 'insensitive' } },
        { partName: { contains: s, mode: 'insensitive' } },
        { brand: { contains: s, mode: 'insensitive' } },
        ...(sNorm ? [{ partNumberNormalized: { contains: sNorm } }] : []),
        ...(sNorm
          ? [
              {
                alternativeNumbers: {
                  some: { normalizedNumber: { contains: sNorm } },
                },
              },
            ]
          : [
              {
                alternativeNumbers: {
                  some: { number: { contains: s, mode: 'insensitive' } },
                },
              },
            ]),
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          alternativeNumbers: {
            select: { id: true, number: true, normalizedNumber: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ partNumber: 'asc' }, { brand: 'asc' }],
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Search active catalog for Sales & Shortages auto-complete.
   * Matches by primary part number or alternative number.
   * If matched via alternative, includes `matchedViaAlternative`.
   */
  async searchCatalog(companyId: string, search: string) {
    if (!search || search.trim().length === 0) {
      return [];
    }

    const query = search.trim();
    const queryNorm = normalizePartNumber(query);

    const orConditions: any[] = [
      { partNumber: { contains: query, mode: 'insensitive' } },
      { partName: { contains: query, mode: 'insensitive' } },
    ];

    if (queryNorm) {
      orConditions.push({ partNumberNormalized: { contains: queryNorm } });
      orConditions.push({
        alternativeNumbers: {
          some: { normalizedNumber: { contains: queryNorm } },
        },
      });
    }

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        status: EntityStatus.ACTIVE,
        OR: orConditions,
      },
      include: {
        alternativeNumbers: {
          select: { id: true, number: true, normalizedNumber: true },
        },
      },
      take: 30,
      orderBy: [{ partNumber: 'asc' }, { brand: 'asc' }],
    });

    return products.map((p) => {
      let matchedViaAlternative: string | undefined;

      // Check if primary did not match directly, but an alternative did
      const primaryMatches =
        p.partNumber.toLowerCase().includes(query.toLowerCase()) ||
        (queryNorm && p.partNumberNormalized.includes(queryNorm));

      if (!primaryMatches && queryNorm && p.alternativeNumbers) {
        const matchingAlt = p.alternativeNumbers.find(
          (a) =>
            a.normalizedNumber.includes(queryNorm) ||
            a.number.toLowerCase().includes(query.toLowerCase()),
        );
        if (matchingAlt) {
          matchedViaAlternative = matchingAlt.number;
        }
      }

      return {
        ...p,
        matchedViaAlternative,
      };
    });
  }

  /**
   * Get all brands available for a given part number.
   */
  async getBrandsForPartNumber(companyId: string, partNumber: string) {
    const normalized = normalizePartNumber(partNumber);
    if (!normalized) return [];

    return this.prisma.product.findMany({
      where: {
        companyId,
        status: EntityStatus.ACTIVE,
        OR: [
          { partNumberNormalized: normalized },
          { alternativeNumbers: { some: { normalizedNumber: normalized } } },
        ],
      },
      select: {
        id: true,
        partNumber: true,
        partName: true,
        brand: true,
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: {
        alternativeNumbers: {
          select: { id: true, number: true, normalizedNumber: true },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('المنتج غير موجود في الدليل');
    }
    return product;
  }

  /**
   * Clean and normalize a list of alternative numbers.
   * Strips formatting, rejects duplicates, and ensures alternative != primary.
   */
  private cleanAlternatives(
    alternatives: string[] | undefined,
    primaryNormalized: string,
  ): Array<{ raw: string; norm: string }> {
    if (!alternatives || !Array.isArray(alternatives)) return [];

    const seen = new Set<string>();
    const result: Array<{ raw: string; norm: string }> = [];

    for (const alt of alternatives) {
      if (!alt) continue;
      const raw = String(alt).trim();
      const norm = normalizePartNumber(raw);
      if (!norm) continue;

      // Formatting variations of primary are not alternatives
      if (norm === primaryNormalized) continue;

      if (!seen.has(norm)) {
        seen.add(norm);
        result.push({ raw, norm });
      }
    }

    return result;
  }

  /**
   * Create a new product with alternative numbers.
   * Enforces UNIQUE(companyId, partNumberNormalized, brandNormalized).
   * Alternative numbers can freely reference other products or be cross-referenced.
   */
  async create(
    companyId: string,
    userId: string,
    data: {
      partNumber: string;
      partName: string;
      brand: string;
      alternativeNumbers?: string[];
    },
  ) {
    if (!data.partNumber || !data.partNumber.trim()) {
      throw new BadRequestException('رقم القطعة مطلوب');
    }
    if (!data.brand || !data.brand.trim()) {
      throw new BadRequestException('الماركة مطلوبة');
    }

    const partNumber = data.partNumber.trim();
    const partNumberNormalized = normalizePartNumber(partNumber);
    const brand = data.brand.trim();
    const brandNormalized = normalizeBrand(brand);
    const partName = (data.partName || partNumber).trim();

    // Check duplicate product: NORMALIZED PART NO. + BRAND
    const existing = await this.prisma.product.findUnique({
      where: {
        companyId_partNumberNormalized_brandNormalized: {
          companyId,
          partNumberNormalized,
          brandNormalized,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `المنتج (${partNumber} / ${brand}) مسجل مسبقاً في دليل الشركة`,
      );
    }

    const cleanAlts = this.cleanAlternatives(data.alternativeNumbers, partNumberNormalized);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          companyId,
          partNumber,
          partNumberNormalized,
          partName,
          brand,
          brandNormalized,
          status: EntityStatus.ACTIVE,
          alternativeNumbers: {
            create: cleanAlts.map((a) => ({
              number: a.raw,
              normalizedNumber: a.norm,
            })),
          },
        },
        include: {
          alternativeNumbers: {
            select: { id: true, number: true, normalizedNumber: true },
          },
        },
      });

      return created;
    });

    await this.activityService.log(this.prisma, {
      companyId,
      userId,
      type: ActivityType.PRODUCT_CREATED,
      description: `تمت إضافة منتج جديد: ${product.partNumber} - ${product.partName} (${product.brand})`,
    });

    return product;
  }

  /**
   * Update an existing product and its alternative numbers.
   */
  async update(
    id: string,
    companyId: string,
    userId: string,
    data: {
      partNumber?: string;
      partName?: string;
      brand?: string;
      status?: EntityStatus;
      alternativeNumbers?: string[];
    },
  ) {
    const current = await this.findOne(id, companyId);

    const partNumber = data.partNumber !== undefined ? data.partNumber.trim() : current.partNumber;
    const partName = data.partName !== undefined ? data.partName.trim() : current.partName;
    const brand = data.brand !== undefined ? data.brand.trim() : current.brand;
    const partNumberNormalized = normalizePartNumber(partNumber);
    const brandNormalized = normalizeBrand(brand);

    if (
      partNumberNormalized !== current.partNumberNormalized ||
      brandNormalized !== current.brandNormalized
    ) {
      const existing = await this.prisma.product.findUnique({
        where: {
          companyId_partNumberNormalized_brandNormalized: {
            companyId,
            partNumberNormalized,
            brandNormalized,
          },
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `المنتج (${partNumber} / ${brand}) مسجل مسبقاً لصنف آخر`,
        );
      }
    }

    const cleanAlts =
      data.alternativeNumbers !== undefined
        ? this.cleanAlternatives(data.alternativeNumbers, partNumberNormalized)
        : current.alternativeNumbers?.map((a) => ({ raw: a.number, norm: a.normalizedNumber })) || [];

    const updated = await this.prisma.$transaction(async (tx) => {
      if (data.alternativeNumbers !== undefined) {
        await tx.productAlternativeNumber.deleteMany({
          where: { productId: id },
        });

        if (cleanAlts.length > 0) {
          await tx.productAlternativeNumber.createMany({
            data: cleanAlts.map((a) => ({
              productId: id,
              number: a.raw,
              normalizedNumber: a.norm,
            })),
          });
        }
      }

      return tx.product.update({
        where: { id },
        data: {
          partNumber,
          partNumberNormalized,
          partName,
          brand,
          brandNormalized,
          ...(data.status && { status: data.status }),
        },
        include: {
          alternativeNumbers: {
            select: { id: true, number: true, normalizedNumber: true },
          },
        },
      });
    });

    await this.activityService.log(this.prisma, {
      companyId,
      userId,
      type: ActivityType.PRODUCT_UPDATED,
      description: `تم تحديث المنتج: ${updated.partNumber} (${updated.brand})`,
    });

    return updated;
  }

  /**
   * Parse Excel file for Import.
   * Structure: Part No. | Name | Brand | Alternative No.
   * Multi-alternatives: comma-separated.
   * Duplicate detection: NORMALIZED PART NO. + BRAND.
   */
  async parseExcel(fileBuffer: Buffer, companyId: string) {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });

    let targetSheetName = workbook.SheetNames[0];
    let sheet = workbook.Sheets[targetSheetName];
    for (const name of workbook.SheetNames) {
      const candidate = workbook.Sheets[name];
      if (candidate && Object.keys(candidate).length > 1) {
        targetSheetName = name;
        sheet = candidate;
        break;
      }
    }

    if (!sheet) {
      throw new BadRequestException('الملف فارغ أو لا يحتوي على صفحات صالحة');
    }

    const rawData = xlsx.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    if (!rawData || rawData.length <= 1) {
      throw new BadRequestException('الملف لا يحتوي على بيانات');
    }

    // 4 Columns: Part No | Name | Brand | Alternative No
    const pnKeywords = ['part no', 'part', 'رقم القطعة', 'رقم القطعه', 'القطعة', 'كود', 'sku', 'p/n', 'pn', 'item'];
    const nameKeywords = ['name', 'اسم القطعة', 'اسم', 'وصف', 'بيان', 'description'];
    const brandKeywords = ['brand', 'الماركة', 'ماركة', 'ماركه', 'الشركة', 'براند', 'make', 'manufacturer'];
    const altKeywords = ['alternative', 'بديل', 'الرقم البديل', 'بدائل', 'رقم بديل', 'alt'];

    let headerRowIdx = 0;
    let pnIdx = -1;
    let nameIdx = -1;
    let brandIdx = -1;
    let altIdx = -1;

    for (let r = 0; r < Math.min(10, rawData.length); r++) {
      const row = (rawData[r] || []).map((c: any) => String(c || '').trim().toLowerCase());
      const pIdx = row.findIndex((h: string) => pnKeywords.some((k) => h.includes(k)));
      const nIdx = row.findIndex((h: string) => nameKeywords.some((k) => h.includes(k)));
      const bIdx = row.findIndex((h: string) => brandKeywords.some((k) => h.includes(k)));
      const aIdx = row.findIndex((h: string) => altKeywords.some((k) => h.includes(k)));

      if (pIdx !== -1 || nIdx !== -1 || bIdx !== -1) {
        headerRowIdx = r;
        pnIdx = pIdx;
        nameIdx = nIdx;
        brandIdx = bIdx;
        altIdx = aIdx;
        break;
      }
    }

    // Default positions: 0: Part No, 1: Name, 2: Brand, 3: Alternative No
    if (pnIdx === -1) pnIdx = 0;
    if (nameIdx === -1) nameIdx = 1;
    if (brandIdx === -1) brandIdx = 2;
    if (altIdx === -1) altIdx = 3;

    // Load existing catalog items & alternative numbers for this company
    const [existingProducts, existingAlts] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId },
        select: { id: true, partNumber: true, partNumberNormalized: true, brandNormalized: true },
      }),
      this.prisma.productAlternativeNumber.findMany({
        where: { product: { companyId } },
        select: {
          number: true,
          normalizedNumber: true,
          product: { select: { id: true, partNumber: true, brandNormalized: true } },
        },
      }),
    ]);

    const existingProductMap = new Map<string, { id: string; partNumber: string }>();
    for (const p of existingProducts) {
      existingProductMap.set(`${p.partNumberNormalized}::${p.brandNormalized}`, {
        id: p.id,
        partNumber: p.partNumber,
      });
    }

    // Map: altNorm::brandNormalized -> owner partNumber
    const existingAltOwnerMap = new Map<string, string>();
    for (const a of existingAlts) {
      existingAltOwnerMap.set(`${a.normalizedNumber}::${a.product.brandNormalized}`, a.product.partNumber);
    }

    const rows: any[] = [];
    // Track first appearance in sheet: key = partNorm::brandNorm -> rowNumber
    const sheetSeenMap = new Map<string, number>();
    // Track alternatives in sheet: key = altNorm::brandNorm -> rowNumber
    const sheetAltSeenMap = new Map<string, number>();

    let newCount = 0;
    let updateCount = 0;
    let duplicateCount = 0;
    let missingCount = 0;
    let conflictCount = 0;

    for (let i = headerRowIdx + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !Array.isArray(row) || row.every((c) => String(c || '').trim() === '')) {
        continue;
      }

      const rowNumber = i + 1;
      const partNumber = String(row[pnIdx] || '').trim();
      const partName = (row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : '') || partNumber;
      const brand = (row[brandIdx] !== undefined ? String(row[brandIdx]).trim() : '') || 'عام';
      const alternativeRaw = altIdx >= 0 && row[altIdx] !== undefined ? String(row[altIdx]).trim() : '';

      // Check missing part number
      if (!partNumber) {
        missingCount++;
        rows.push({
          rowNumber,
          partNumber: '-',
          partName,
          brand,
          alternativeNumbers: [],
          status: 'بيانات ناقصة',
          statusType: 'error',
          note: 'رقم القطعة مفقود في هذا السطر',
          canImport: false,
        });
        continue;
      }

      const partNumberNormalized = normalizePartNumber(partNumber);
      const brandNormalized = normalizeBrand(brand);
      const productKey = `${partNumberNormalized}::${brandNormalized}`;

      // Parse alternative numbers from cell (comma / semicolon separated)
      const altTokens = alternativeRaw
        .split(/[,;\n\r]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const parsedAlts: Array<{ raw: string; norm: string }> = [];
      const seenRowAlts = new Set<string>();

      for (const token of altTokens) {
        const norm = normalizePartNumber(token);
        if (!norm || norm === partNumberNormalized) continue;
        if (!seenRowAlts.has(norm)) {
          seenRowAlts.add(norm);
          parsedAlts.push({ raw: token, norm });
        }
      }

      // Check Duplicate in current file: SAME Normalized Part No + Brand
      if (sheetSeenMap.has(productKey)) {
        duplicateCount++;
        const firstRow = sheetSeenMap.get(productKey);
        rows.push({
          rowNumber,
          partNumber,
          partNumberNormalized,
          partName,
          brand,
          alternativeNumbers: parsedAlts.map((a) => a.raw),
          status: 'مكرر داخل الملف',
          statusType: 'duplicate',
          note: `مكرر مع السطر ${firstRow} (نفس رقم القطعة والماركة)`,
          canImport: false,
        });
        continue;
      }

      // Record in sheet map
      sheetSeenMap.set(productKey, rowNumber);

      // Check if product exists in database -> update or new
      const isExistingInDb = existingProductMap.has(productKey);
      if (isExistingInDb) {
        updateCount++;
      } else {
        newCount++;
      }

      rows.push({
        rowNumber,
        partNumber,
        partNumberNormalized,
        partName,
        brand,
        brandNormalized,
        alternativeNumbers: parsedAlts.map((a) => a.raw),
        status: isExistingInDb ? 'موجود مسبقاً (تحديث)' : 'صالح للاستيراد',
        statusType: isExistingInDb ? 'existing' : 'valid',
        note: isExistingInDb ? 'سيتم تحديث الاسم والأرقام البديلة' : 'منتج جديد سيتم إدراجه',
        canImport: true,
      });
    }

    const validRows = rows.filter((r) => r.canImport);

    return {
      totalRows: rows.length,
      validCount: validRows.length,
      newCount,
      updateCount,
      duplicateCount,
      missingCount,
      conflictCount,
      allRows: rows,
      validRows: validRows.map((r) => ({
        partNumber: r.partNumber,
        partName: r.partName,
        brand: r.brand,
        alternativeNumbers: r.alternativeNumbers,
      })),
    };
  }

  /**
   * Confirm and execute Excel Import.
   */
  async confirmImport(
    companyId: string,
    userId: string,
    validRows: Array<{
      partNumber: string;
      partName: string;
      brand: string;
      alternativeNumbers?: string[];
    }>,
  ) {
    if (!validRows || validRows.length === 0) {
      throw new BadRequestException('لا توجد أصناف صالحة للاستيراد');
    }

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          let count = 0;
          for (const row of validRows) {
            const partNumber = String(row.partNumber || '').trim();
            if (!partNumber) continue;

            const brand = String(row.brand || 'عام').trim() || 'عام';
            const partName = String(row.partName || partNumber).trim();
            const partNumberNormalized = normalizePartNumber(partNumber);
            const brandNormalized = normalizeBrand(brand);

            const cleanAlts = this.cleanAlternatives(row.alternativeNumbers, partNumberNormalized);

            const product = await tx.product.upsert({
              where: {
                companyId_partNumberNormalized_brandNormalized: {
                  companyId,
                  partNumberNormalized,
                  brandNormalized,
                },
              },
              update: {
                partName,
                status: EntityStatus.ACTIVE,
              },
              create: {
                companyId,
                partNumber,
                partNumberNormalized,
                partName,
                brand,
                brandNormalized,
                status: EntityStatus.ACTIVE,
              },
            });

            // Sync alternatives: remove old and insert clean alternatives
            if (cleanAlts.length > 0) {
              await tx.productAlternativeNumber.deleteMany({
                where: { productId: product.id },
              });

              await tx.productAlternativeNumber.createMany({
                data: cleanAlts.map((a) => ({
                  productId: product.id,
                  number: a.raw,
                  normalizedNumber: a.norm,
                })),
                skipDuplicates: true,
              });
            }

            count++;
          }
          return count;
        },
        {
          maxWait: 15000,
          timeout: 90000,
        },
      );

      await this.activityService.log(this.prisma, {
        companyId,
        userId,
        type: ActivityType.PRODUCT_IMPORTED,
        description: `تم استيراد / تحديث ${created} منتج بنجاح عبر ملف Excel`,
      });

      return { importedCount: created };
    } catch (err: any) {
      console.error('confirmImport error:', err);
      throw new BadRequestException(
        err.message || 'حدث خطأ أثناء حفظ وتحديث المنتجات في قاعدة البيانات',
      );
    }
  }

  /**
   * Export all products for the company in EXACTLY 4 columns:
   * Part No. | Name | Brand | Alternative No.
   * Multiple alternatives are comma-separated in the 4th column.
   */
  async exportProducts(companyId: string): Promise<Buffer> {
    const products = await this.prisma.product.findMany({
      where: { companyId },
      include: {
        alternativeNumbers: {
          select: { number: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ partNumber: 'asc' }, { brand: 'asc' }],
    });

    const exportRows = products.map((p) => {
      const altCell = (p.alternativeNumbers || []).map((a) => a.number).join(', ');
      return {
        'Part No.': p.partNumber,
        Name: p.partName,
        Brand: p.brand,
        'Alternative No.': altCell,
      };
    });

    const ws = xlsx.utils.json_to_sheet(exportRows, {
      header: ['Part No.', 'Name', 'Brand', 'Alternative No.'],
    });

    // Set column widths
    ws['!cols'] = [
      { wch: 22 }, // Part No.
      { wch: 32 }, // Name
      { wch: 18 }, // Brand
      { wch: 35 }, // Alternative No.
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Products');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Downloadable 4-column Import Template with sample rows.
   */
  async getImportTemplate(): Promise<Buffer> {
    const sampleRows = [
      {
        'Part No.': '1G-232',
        Name: 'PIN',
        Brand: 'CAT',
        'Alternative No.': '5P1000, 7X5000',
      },
      {
        'Part No.': '8N7005',
        Name: 'BUSHING',
        Brand: 'CAT',
        'Alternative No.': '8N7006',
      },
      {
        'Part No.': '1G232',
        Name: 'PIN',
        Brand: 'CTP',
        'Alternative No.': 'CTP10022',
      },
      {
        'Part No.': '1G 232',
        Name: 'PIN',
        Brand: 'ITR',
        'Alternative No.': 'ITR3000',
      },
    ];

    const ws = xlsx.utils.json_to_sheet(sampleRows, {
      header: ['Part No.', 'Name', 'Brand', 'Alternative No.'],
    });

    ws['!cols'] = [
      { wch: 22 },
      { wch: 30 },
      { wch: 18 },
      { wch: 35 },
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Template');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
