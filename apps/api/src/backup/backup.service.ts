import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface BackupMetadata {
  rasdBackupVersion: string;
  appVersion: string;
  schemaVersion: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  companyId?: string | null;
  companyName: string;
  note: string;
  recordCounts: {
    branches: number;
    users: number;
    products: number;
    salesRequests: number;
    shortageRequests: number;
    customers: number;
    activityLogs: number;
  };
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: {
    company: any;
    branches: any[];
    users: any[];
    userBranchAccess: any[];
    products: any[];
    customers: any[];
    documentSequences: any[];
    salesRequests: any[];
    salesItems: any[];
    shortageRequests: any[];
    shortageItems: any[];
    shortageItemEvents: any[];
    activityLogs: any[];
  };
}

@Injectable()
export class BackupService {
  private backupDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.backupDir = path.resolve(process.cwd(), 'uploads', 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private sanitizeFilename(filename: string): string {
    const clean = path.basename(filename);
    if (!clean.endsWith('.rasdbackup') && !clean.endsWith('.json')) {
      throw new BadRequestException('اسم ملف النسخة الاحتياطية غير صالح');
    }
    return clean;
  }

  async createBackup(
    companyId: string | null,
    userId: string,
    note?: string,
    isPreRestoreSafety: boolean = false,
  ): Promise<{ filename: string; metadata: BackupMetadata; fullPayload: BackupPayload }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const company = companyId ? await this.prisma.company.findUnique({ where: { id: companyId } }) : null;

    // Fetch all business records
    const whereCompany = companyId ? { companyId } : {};

    const [
      branches,
      users,
      userBranchAccess,
      products,
      customers,
      documentSequences,
      salesRequests,
      salesItems,
      shortageRequests,
      shortageItems,
      shortageItemEvents,
      activityLogs,
    ] = await Promise.all([
      this.prisma.branch.findMany({ where: whereCompany }),
      this.prisma.user.findMany({ where: whereCompany }),
      this.prisma.userBranchAccess.findMany({
        where: companyId ? { user: { companyId } } : {},
      }),
      this.prisma.product.findMany({ where: whereCompany, include: { alternativeNumbers: true } }),
      this.prisma.customer.findMany({ where: whereCompany }),
      this.prisma.documentSequence.findMany({ where: whereCompany }),
      this.prisma.salesRequest.findMany({ where: whereCompany }),
      this.prisma.salesItem.findMany({
        where: companyId ? { salesRequest: { companyId } } : {},
      }),
      this.prisma.shortageRequest.findMany({ where: whereCompany }),
      this.prisma.shortageItem.findMany({
        where: companyId ? { shortageRequest: { companyId } } : {},
      }),
      this.prisma.shortageItemEvent.findMany({
        where: companyId ? { shortageItem: { shortageRequest: { companyId } } } : {},
      }),
      this.prisma.activityLog.findMany({
        where: whereCompany,
        take: 3000,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const metadata: BackupMetadata = {
      rasdBackupVersion: '1.2',
      appVersion: '2.0.0',
      schemaVersion: '1.0',
      createdAt: new Date().toISOString(),
      createdById: userId,
      createdByName: user?.fullName || 'مدير النظام',
      companyId: companyId,
      companyName: company?.name || 'منصة رَصْد RASD',
      note: note?.trim() || (isPreRestoreSafety ? 'نسخة أمان تلقائية قبل استعادة البيانات' : 'نسخة احتياطية يدوية'),
      recordCounts: {
        branches: branches.length,
        users: users.length,
        products: products.length,
        salesRequests: salesRequests.length,
        shortageRequests: shortageRequests.length,
        customers: customers.length,
        activityLogs: activityLogs.length,
      },
    };

    const fullPayload: BackupPayload = {
      metadata,
      data: {
        company,
        branches,
        users,
        userBranchAccess,
        products,
        customers,
        documentSequences,
        salesRequests,
        salesItems,
        shortageRequests,
        shortageItems,
        shortageItemEvents,
        activityLogs,
      },
    };

    // Filename generation
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = `${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
    const prefix = isPreRestoreSafety ? 'RASD_PreRestore_Backup' : 'RASD_Backup';
    const filename = `${prefix}_${dateStr}_${timeStr}_${Date.now().toString().slice(-4)}.rasdbackup`;

    const filePath = path.join(this.backupDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(fullPayload, null, 2), 'utf-8');

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'BACKUP_CREATED',
        resource: 'Backup',
        details: JSON.stringify({
          filename,
          isSafety: isPreRestoreSafety,
          recordCounts: metadata.recordCounts,
          note: metadata.note,
        }),
      },
    });

    return { filename, metadata, fullPayload };
  }

  async listBackups(companyId?: string | null) {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    const files = fs.readdirSync(this.backupDir);
    const backups: any[] = [];

    for (const f of files) {
      if (!f.endsWith('.rasdbackup') && !f.endsWith('.json')) continue;
      const filePath = path.join(this.backupDir, f);
      try {
        const stats = fs.statSync(filePath);
        // Quick read metadata
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const meta: BackupMetadata = parsed.metadata || {};

        if (companyId && meta.companyId && meta.companyId !== companyId) {
          continue;
        }

        backups.push({
          filename: f,
          sizeBytes: stats.size,
          createdAt: meta.createdAt || stats.mtime.toISOString(),
          createdByName: meta.createdByName || '—',
          note: meta.note || '',
          version: meta.rasdBackupVersion || '1.0',
          recordCounts: meta.recordCounts || null,
        });
      } catch (err) {
        // Skip corrupted or unreadable files in list
      }
    }

    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getBackupFile(filename: string, userId: string, companyId?: string | null) {
    const clean = this.sanitizeFilename(filename);
    const filePath = path.join(this.backupDir, clean);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('ملف النسخة الاحتياطية غير موجود');
    }

    await this.prisma.auditLog.create({
      data: {
        companyId: companyId || null,
        userId,
        action: 'BACKUP_DOWNLOADED',
        resource: 'Backup',
        details: JSON.stringify({ filename: clean }),
      },
    });

    return {
      filePath,
      filename: clean,
    };
  }

  validateBackupPayload(payload: any): { isValid: boolean; metadata: BackupMetadata } {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('ملف النسخة الاحتياطية غير صالح أو تالف');
    }

    const meta = payload.metadata;
    if (!meta || !meta.rasdBackupVersion || !meta.recordCounts) {
      throw new BadRequestException('هذا الملف ليس ملف نسخة احتياطية معتمداً لمنصة رَصْد (تنسيق غير متوافق)');
    }

    if (!payload.data || typeof payload.data !== 'object') {
      throw new BadRequestException('بيانات النسخة الاحتياطية مفقودة أو غير مكتملة');
    }

    const { branches, users, products } = payload.data;
    if (!Array.isArray(branches) || !Array.isArray(users) || !Array.isArray(products)) {
      throw new BadRequestException('بنية بيانات النسخة الاحتياطية غير صالحة للاستعادة');
    }

    return {
      isValid: true,
      metadata: meta,
    };
  }

  async restoreBackup(companyId: string | null, userId: string, payload: BackupPayload) {
    // 1. Re-validate payload
    this.validateBackupPayload(payload);

    // 2. MANDATORY: Automatic Safety Backup before restoring
    let safetyBackupName = '';
    try {
      const safety = await this.createBackup(companyId, userId, 'نسخة أمان قبل الاستعادة', true);
      safetyBackupName = safety.filename;
    } catch (err) {
      throw new InternalServerErrorException('تعذر إنشاء نسخة الأمان التلقائية قبل الاستعادة. تم إلغاء العملية لحماية البيانات.');
    }

    // 3. Log Restore Started
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'BACKUP_RESTORE_STARTED',
        resource: 'Backup',
        details: JSON.stringify({
          safetyBackup: safetyBackupName,
          targetMetadata: payload.metadata,
        }),
      },
    });

    // 4. Safe restoration inside Prisma transaction
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // --- Step A: Clear existing operational records in safe order ---
          if (companyId) {
            await tx.activityLog.deleteMany({ where: { companyId } });

            await tx.shortageItemEvent.deleteMany({
              where: { shortageItem: { shortageRequest: { companyId } } },
            });
            await tx.shortageItem.deleteMany({
              where: { shortageRequest: { companyId } },
            });
            await tx.shortageRequest.deleteMany({ where: { companyId } });

            await tx.salesItem.deleteMany({
              where: { salesRequest: { companyId } },
            });
            await tx.salesRequest.deleteMany({ where: { companyId } });

            await tx.documentSequence.deleteMany({ where: { companyId } });
            await tx.product.deleteMany({ where: { companyId } });
            await tx.customer.deleteMany({ where: { companyId } });

            await tx.userBranchAccess.deleteMany({
              where: { user: { companyId } },
            });
          }

          // --- Step B: Restore from Backup Payload ---
          const {
            company,
            branches,
            users,
            userBranchAccess,
            products,
            customers,
            documentSequences,
            salesRequests,
            salesItems,
            shortageRequests,
            shortageItems,
            shortageItemEvents,
          } = payload.data;

          // 1. Company
          if (company && company.id) {
            await tx.company.upsert({
              where: { id: company.id },
              update: {
                name: company.name,
                code: company.code,
                status: company.status || 'ACTIVE',
              },
              create: {
                id: company.id,
                name: company.name,
                code: company.code,
                status: company.status || 'ACTIVE',
              },
            });
          }

          // 2. Branches
          for (const b of branches || []) {
            await tx.branch.upsert({
              where: { id: b.id },
              update: {
                name: b.name,
                code: b.code,
                status: b.status || 'ACTIVE',
              },
              create: {
                id: b.id,
                companyId: b.companyId,
                name: b.name,
                code: b.code,
                status: b.status || 'ACTIVE',
              },
            });
          }

          // 3. Users
          for (const u of users || []) {
            await tx.user.upsert({
              where: { id: u.id },
              update: {
                fullName: u.fullName,
                username: u.username,
                passwordHash: u.passwordHash,
                role: u.role,
                status: u.status || 'ACTIVE',
                companyId: u.companyId,
              },
              create: {
                id: u.id,
                companyId: u.companyId,
                fullName: u.fullName,
                username: u.username,
                passwordHash: u.passwordHash,
                role: u.role,
                status: u.status || 'ACTIVE',
              },
            });
          }

          // 4. User Branch Access
          for (const uba of userBranchAccess || []) {
            await tx.userBranchAccess.upsert({
              where: {
                userId_branchId: {
                  userId: uba.userId,
                  branchId: uba.branchId,
                },
              },
              update: {},
              create: {
                id: uba.id,
                userId: uba.userId,
                branchId: uba.branchId,
              },
            });
          }

          // 5. Products
          for (const p of products || []) {
            await tx.product.upsert({
              where: { id: p.id },
              update: {
                partNumber: p.partNumber,
                partNumberNormalized: p.partNumberNormalized,
                partName: p.partName,
                brand: p.brand,
                brandNormalized: p.brandNormalized,
                status: p.status || 'ACTIVE',
              },
              create: {
                id: p.id,
                companyId: p.companyId,
                partNumber: p.partNumber,
                partNumberNormalized: p.partNumberNormalized,
                partName: p.partName,
                brand: p.brand,
                brandNormalized: p.brandNormalized,
                status: p.status || 'ACTIVE',
              },
            });

            if (p.alternativeNumbers && p.alternativeNumbers.length > 0) {
              await tx.productAlternativeNumber.deleteMany({
                where: { productId: p.id },
              });
              await tx.productAlternativeNumber.createMany({
                data: p.alternativeNumbers.map((a: any) => ({
                  id: a.id,
                  productId: p.id,
                  number: a.number,
                  normalizedNumber: a.normalizedNumber,
                })),
                skipDuplicates: true,
              });
            }
          }

          // 6. Customers
          for (const c of customers || []) {
            await tx.customer.upsert({
              where: { id: c.id },
              update: {
                name: c.name,
                normalizedName: c.normalizedName,
                phone: c.phone || null,
                taxNumber: c.taxNumber || null,
                city: c.city || null,
                active: c.active !== undefined ? c.active : true,
              },
              create: {
                id: c.id,
                companyId: c.companyId,
                name: c.name,
                normalizedName: c.normalizedName,
                phone: c.phone || null,
                taxNumber: c.taxNumber || null,
                city: c.city || null,
                active: c.active !== undefined ? c.active : true,
              },
            });
          }

          // 7. Document Sequences
          for (const s of documentSequences || []) {
            await tx.documentSequence.upsert({
              where: { id: s.id },
              update: {
                lastNumber: s.lastNumber,
              },
              create: {
                id: s.id,
                companyId: s.companyId,
                branchId: s.branchId,
                type: s.type,
                prefix: s.prefix,
                dateKey: s.dateKey,
                lastNumber: s.lastNumber,
              },
            });
          }

          // 8. Sales Requests & Items
          for (const sr of salesRequests || []) {
            await tx.salesRequest.upsert({
              where: { id: sr.id },
              update: {
                documentNumber: sr.documentNumber,
                businessDate: new Date(sr.businessDate),
                status: sr.status,
                totalItems: sr.totalItems,
                totalQuantity: sr.totalQuantity,
                totalAmount: sr.totalAmount,
                officialInvoiceNumber: sr.officialInvoiceNumber || null,
                officialInvoiceDate: sr.officialInvoiceDate ? new Date(sr.officialInvoiceDate) : null,
                invoicedByUserId: sr.invoicedByUserId || null,
                invoicedAt: sr.invoicedAt ? new Date(sr.invoicedAt) : null,
              },
              create: {
                id: sr.id,
                companyId: sr.companyId,
                branchId: sr.branchId,
                customerId: sr.customerId || null,
                createdById: sr.createdById || null,
                documentNumber: sr.documentNumber,
                businessDate: new Date(sr.businessDate),
                status: sr.status,
                totalItems: sr.totalItems,
                totalQuantity: sr.totalQuantity,
                totalAmount: sr.totalAmount,
                officialInvoiceNumber: sr.officialInvoiceNumber || null,
                officialInvoiceDate: sr.officialInvoiceDate ? new Date(sr.officialInvoiceDate) : null,
                invoicedByUserId: sr.invoicedByUserId || null,
                invoicedAt: sr.invoicedAt ? new Date(sr.invoicedAt) : null,
              },
            });
          }

          for (const si of salesItems || []) {
            await tx.salesItem.upsert({
              where: { id: si.id },
              update: {
                quantity: si.quantity,
                unitPrice: si.unitPrice,
                lineTotal: si.lineTotal || null,
                soldTo: si.soldTo,
                note: si.note || null,
              },
              create: {
                id: si.id,
                salesRequestId: si.salesRequestId,
                productId: si.productId || null,
                partNumberSnapshot: si.partNumberSnapshot,
                partNameSnapshot: si.partNameSnapshot,
                brandSnapshot: si.brandSnapshot,
                quantity: si.quantity,
                unitPrice: si.unitPrice,
                lineTotal: si.lineTotal || null,
                soldTo: si.soldTo,
                note: si.note || null,
                createdByUserId: si.createdByUserId,
              },
            });
          }

          // 9. Shortage Requests & Items & Events
          for (const shr of shortageRequests || []) {
            await tx.shortageRequest.upsert({
              where: { id: shr.id },
              update: {
                documentNumber: shr.documentNumber,
                businessDate: new Date(shr.businessDate),
                status: shr.status,
                totalItems: shr.totalItems,
                totalQuantity: shr.totalQuantity,
                closedByUserId: shr.closedByUserId || null,
                closedAt: shr.closedAt ? new Date(shr.closedAt) : null,
              },
              create: {
                id: shr.id,
                companyId: shr.companyId,
                branchId: shr.branchId,
                createdById: shr.createdById || null,
                documentNumber: shr.documentNumber,
                businessDate: new Date(shr.businessDate),
                status: shr.status,
                totalItems: shr.totalItems,
                totalQuantity: shr.totalQuantity,
                closedByUserId: shr.closedByUserId || null,
                closedAt: shr.closedAt ? new Date(shr.closedAt) : null,
              },
            });
          }

          for (const shi of shortageItems || []) {
            await tx.shortageItem.upsert({
              where: { id: shi.id },
              update: {
                quantity: shi.quantity,
                priority: shi.priority || null,
                note: shi.note || null,
              },
              create: {
                id: shi.id,
                shortageRequestId: shi.shortageRequestId,
                productId: shi.productId || null,
                partNumberSnapshot: shi.partNumberSnapshot,
                partNameSnapshot: shi.partNameSnapshot,
                brandSnapshot: shi.brandSnapshot,
                quantity: shi.quantity,
                priority: shi.priority || null,
                note: shi.note || null,
                createdByUserId: shi.createdByUserId,
              },
            });
          }

          for (const ev of shortageItemEvents || []) {
            await tx.shortageItemEvent.upsert({
              where: { id: ev.id },
              update: {},
              create: {
                id: ev.id,
                shortageItemId: ev.shortageItemId,
                userId: ev.userId,
                previousQuantity: ev.previousQuantity,
                addedQuantity: ev.addedQuantity,
                newQuantity: ev.newQuantity,
                createdAt: new Date(ev.createdAt),
              },
            });
          }
        },
        { timeout: 60000 },
      );

      // Log success
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'BACKUP_RESTORE_COMPLETED',
          resource: 'Backup',
          details: JSON.stringify({
            safetyBackup: safetyBackupName,
            restoredCounts: payload.metadata.recordCounts,
          }),
        },
      });

      return {
        success: true,
        safetyBackup: safetyBackupName,
        restoredCounts: payload.metadata.recordCounts,
      };
    } catch (err: any) {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'BACKUP_RESTORE_FAILED',
          resource: 'Backup',
          details: JSON.stringify({
            error: err.message,
            safetyBackup: safetyBackupName,
          }),
        },
      });

      throw new InternalServerErrorException(
        `فشلت عملية استعادة النسخة الاحتياطية (${err.message}). تم الحفاظ على نسخة الأمان التلقائية: ${safetyBackupName}`,
      );
    }
  }

  async deleteBackup(filename: string, userId: string, companyId?: string | null) {
    const clean = this.sanitizeFilename(filename);
    const filePath = path.join(this.backupDir, clean);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.auditLog.create({
      data: {
        companyId: companyId || null,
        userId,
        action: 'BACKUP_DELETED',
        resource: 'Backup',
        details: JSON.stringify({ filename: clean }),
      },
    });

    return { success: true };
  }
}
