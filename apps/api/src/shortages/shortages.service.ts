import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../common/services/sequence.service';
import { ActivityService } from '../common/services/activity.service';
import { ShortageRequestStatus, ActivityType, AuthUser, UserRole, normalizePartNumber, normalizeBrand } from '../common/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class ShortagesService {
  constructor(
    private prisma: PrismaService,
    private sequenceService: SequenceService,
    private activityService: ActivityService,
  ) {}

  private validateBranchAccess(user: AuthUser, branchId: string) {
    if (user.role === UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('مدير المنصة لا يشارك في العمليات التشغيلية');
    }
    if (user.role === UserRole.OPERATOR && (!user.branchIds || user.branchIds.length === 0)) {
      throw new BadRequestException('المستخدم غير مرتبط بأي فرع حالياً، لا يمكن إتمام العملية. يرجى مراجعة إدارة الشركة لربط حسابك بفرع.');
    }
    if (user.role === UserRole.OPERATOR && !user.branchIds.includes(branchId)) {
      throw new ForbiddenException('المستخدم غير مرتبط بهذا الفرع، لا يمكن تسجيل العمليات');
    }
  }

  async getActiveRequest(companyId: string, branchId: string) {
    const activeReq = await this.prisma.shortageRequest.findFirst({
      where: {
        companyId,
        branchId,
        status: ShortageRequestStatus.OPEN,
      },
      include: {
        branch: { select: { name: true, code: true } },
        items: {
          include: {
            createdBy: { select: { fullName: true } },
            events: {
              include: { user: { select: { fullName: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeReq) return null;
    return this.mapRequestDto(activeReq);
  }

  /**
   * One Shortage Request -> Multiple Items
   * Atomic PostgreSQL transaction:
   * 1. Validate items
   * 2. Generate unique document sequence (SH-YYYYMMDD-XXX)
   * 3. Compute totals
   * 4. Create ShortageRequest
   * 5. Create ShortageItems & ShortageItemEvents
   * 6. Log Activity
   */
  async checkItemInActiveRequest(
    companyId: string,
    branchId: string,
    partNumber: string,
    brand?: string,
    productId?: string,
  ) {
    const activeReq = await this.prisma.shortageRequest.findFirst({
      where: {
        companyId,
        branchId,
        status: ShortageRequestStatus.OPEN,
      },
      include: {
        items: {
          include: {
            createdBy: { select: { fullName: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeReq) return { exists: false };

    const pNorm = normalizePartNumber(partNumber);
    const bNorm = brand ? normalizeBrand(brand) : null;

    const existing = activeReq.items.find((it) => {
      if (productId && it.productId && it.productId === productId) return true;
      const matchPart = normalizePartNumber(it.partNumberSnapshot) === pNorm;
      if (!matchPart) return false;
      if (bNorm) {
        return normalizeBrand(it.brandSnapshot) === bNorm;
      }
      return true;
    });

    if (!existing) return { exists: false, requestDocumentNumber: activeReq.documentNumber };

    return {
      exists: true,
      requestId: activeReq.id,
      requestDocumentNumber: activeReq.documentNumber,
      currentQuantity: Number(existing.quantity),
      partName: existing.partNameSnapshot,
      brand: existing.brandSnapshot,
      createdByFullName: existing.createdBy?.fullName || 'أحد الموظفين',
    };
  }

  /**
   * Shortage Recording:
   * 1. Search for current OPEN shortage request for the branch.
   * 2. If exists, add items into it. If none, create new OPEN request.
   * 3. For duplicate parts inside the request, accumulate quantities atomically and record event.
   * 4. Update request totals.
   */
  async createShortageRequest(
    user: AuthUser,
    dto: {
      branchId?: string;
      items: Array<{
        productId?: string;
        partNumber: string;
        partName?: string;
        brand: string;
        quantity: number;
        priority?: string;
        note?: string;
      }>;
    },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const branchId = dto.branchId || user.currentBranchId;
    if (!branchId || (user.role === UserRole.OPERATOR && (!user.branchIds || user.branchIds.length === 0))) {
      throw new BadRequestException('المستخدم غير مرتبط بأي فرع حالياً، لا يمكن تسجيل النواقص. يرجى مراجعة إدارة الشركة لربط حسابك بفرع.');
    }

    this.validateBranchAccess(user, branchId);

    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('يجب إضافة صنف واحد على الأقل في طلب النواقص');
    }

    for (const it of dto.items) {
      if (!it.partNumber || !it.brand || it.quantity <= 0) {
        throw new BadRequestException('يرجى التحقق من بيانات النواقص (رقم القطعة، الماركة، والكمية > 0)');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Search for active OPEN request for this branch
      let shortageRequest = await tx.shortageRequest.findFirst({
        where: {
          companyId: user.companyId!,
          branchId,
          status: ShortageRequestStatus.OPEN,
        },
        include: {
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      let isNewRequest = false;

      if (!shortageRequest) {
        isNewRequest = true;
        const documentNumber = await this.sequenceService.getNextDocumentNumber(
          tx,
          user.companyId!,
          branchId,
          'SHORTAGE',
        );

        shortageRequest = await tx.shortageRequest.create({
          data: {
            companyId: user.companyId!,
            branchId,
            createdById: user.id,
            documentNumber,
            businessDate: new Date(),
            status: ShortageRequestStatus.OPEN,
            totalItems: 0,
            totalQuantity: new Prisma.Decimal(0),
          },
          include: {
            items: true,
          },
        });
      }

      // 2. Process items (accumulate if existing in open request)
      const currentItems = [...shortageRequest.items];

      for (const it of dto.items) {
        const partNumber = it.partNumber.trim();
        const brand = it.brand.trim();
        const partName = it.partName?.trim() || partNumber;
        const qtyToAdd = Number(it.quantity);

        const pNorm = partNumber.toUpperCase();
        const bNorm = brand.toUpperCase();

        const existingItemIndex = currentItems.findIndex(
          (ci) =>
            ci.partNumberSnapshot.trim().toUpperCase() === pNorm &&
            ci.brandSnapshot.trim().toUpperCase() === bNorm,
        );

        if (existingItemIndex >= 0) {
          // Accumulate quantity
          const existing = currentItems[existingItemIndex];
          const oldQty = Number(existing.quantity);
          const newQty = oldQty + qtyToAdd;

          const updatedItem = await tx.shortageItem.update({
            where: { id: existing.id },
            data: {
              quantity: new Prisma.Decimal(newQty),
              note: it.note ? (existing.note ? `${existing.note} | ${it.note}` : it.note) : existing.note,
              updatedAt: new Date(),
            },
          });

          await tx.shortageItemEvent.create({
            data: {
              shortageItemId: existing.id,
              userId: user.id,
              previousQuantity: new Prisma.Decimal(oldQty),
              addedQuantity: new Prisma.Decimal(qtyToAdd),
              newQuantity: new Prisma.Decimal(newQty),
            },
          });

          currentItems[existingItemIndex] = updatedItem;
        } else {
          let productId = it.productId || null;
          if (!productId) {
            const product = await tx.product.findUnique({
              where: {
                companyId_partNumberNormalized_brandNormalized: {
                  companyId: user.companyId!,
                  partNumberNormalized: pNorm,
                  brandNormalized: bNorm,
                },
              },
            });
            if (product) productId = product.id;
          }

          const shortageItem = await tx.shortageItem.create({
            data: {
              shortageRequestId: shortageRequest.id,
              productId,
              partNumberSnapshot: partNumber,
              partNameSnapshot: partName,
              brandSnapshot: brand,
              quantity: new Prisma.Decimal(qtyToAdd),
              priority: it.priority || 'MEDIUM',
              note: it.note ? it.note.trim() : null,
              createdByUserId: user.id,
            },
          });

          await tx.shortageItemEvent.create({
            data: {
              shortageItemId: shortageItem.id,
              userId: user.id,
              previousQuantity: new Prisma.Decimal(0),
              addedQuantity: new Prisma.Decimal(qtyToAdd),
              newQuantity: new Prisma.Decimal(qtyToAdd),
            },
          });

          currentItems.push(shortageItem);
        }
      }

      // 3. Recalculate totals
      const totalItems = currentItems.length;
      let totalQuantity = 0;
      for (const item of currentItems) {
        totalQuantity += Number(item.quantity);
      }

      await tx.shortageRequest.update({
        where: { id: shortageRequest.id },
        data: {
          totalItems,
          totalQuantity: new Prisma.Decimal(totalQuantity),
        },
      });

      // 4. Log Activity
      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId,
        userId: user.id,
        type: isNewRequest ? ActivityType.SHORTAGE_REQUEST_CREATED : ActivityType.SHORTAGE_ITEM_ADDED,
        referenceNumber: shortageRequest.documentNumber,
        description: isNewRequest
          ? `${user.fullName} سجل طلب نواقص مفتوح جديد (${shortageRequest.documentNumber}) بإجمالي ${totalItems} صنف (${totalQuantity} قطعة)`
          : `${user.fullName} أضاف قطع إلى طلب النواقص المفتوح (${shortageRequest.documentNumber})`,
      });

      return {
        id: shortageRequest.id,
        documentNumber: shortageRequest.documentNumber,
        status: shortageRequest.status,
        isNewRequest,
        totalItems,
        totalQuantity,
        createdAt: shortageRequest.createdAt,
      };
    });
  }

  async registerItem(
    user: AuthUser,
    dto: {
      branchId?: string;
      productId?: string;
      partNumber: string;
      partName?: string;
      brand: string;
      quantity: number;
      note?: string;
    },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const branchId = dto.branchId || user.currentBranchId;
    if (!branchId) {
      throw new BadRequestException('يجب تحديد الفرع لتسجيل النقص');
    }

    this.validateBranchAccess(user, branchId);

    if (!dto.partNumber || !dto.brand || !dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('يرجى التحقق من صحة البيانات المدخلة (رقم القطعة، الماركة، والكمية المطلوبة)');
    }

    const partNumber = dto.partNumber.trim();
    const brand = dto.brand.trim();
    const partName = dto.partName ? dto.partName.trim() : partNumber;

    return this.prisma.$transaction(async (tx) => {
      // 1. Find active OPEN shortage request for this branch
      let shortageRequest = await tx.shortageRequest.findFirst({
        where: {
          companyId: user.companyId!,
          branchId,
          status: ShortageRequestStatus.OPEN,
        },
        orderBy: { createdAt: 'desc' },
      });

      // 2. If not found, safely generate document sequence and create new request
      if (!shortageRequest) {
        const documentNumber = await this.sequenceService.getNextDocumentNumber(
          tx,
          user.companyId!,
          branchId,
          'SHORTAGE',
        );

        shortageRequest = await tx.shortageRequest.create({
          data: {
            companyId: user.companyId!,
            branchId,
            documentNumber,
            businessDate: new Date(),
            status: ShortageRequestStatus.OPEN,
          },
        });
      }

      // 3. Resolve product if available
      let productId = dto.productId || null;
      if (!productId) {
        const product = await tx.product.findUnique({
          where: {
            companyId_partNumberNormalized_brandNormalized: {
              companyId: user.companyId!,
              partNumberNormalized: partNumber.toUpperCase(),
              brandNormalized: brand.toUpperCase(),
            },
          },
        });
        if (product) {
          productId = product.id;
        }
      }

      // 4. Critical Shortage Duplicate Check:
      // If same partNumber + brand already exists in active request, merge quantity!
      const existingItem = await tx.shortageItem.findFirst({
        where: {
          shortageRequestId: shortageRequest.id,
          partNumberSnapshot: { equals: partNumber, mode: 'insensitive' },
          brandSnapshot: { equals: brand, mode: 'insensitive' },
        },
      });

      let shortageItem;
      if (existingItem) {
        // Merge quantity!
        const prevQty = Number(existingItem.quantity);
        const addQty = Number(dto.quantity);
        const newQty = prevQty + addQty;

        shortageItem = await tx.shortageItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: new Prisma.Decimal(newQty),
            ...(dto.note && {
              note: existingItem.note
                ? `${existingItem.note}\n[${user.fullName}]: ${dto.note.trim()}`
                : dto.note.trim(),
            }),
          },
          include: {
            createdBy: { select: { fullName: true, username: true } },
          },
        });

        // Record accountability event in shortage_item_events
        await tx.shortageItemEvent.create({
          data: {
            shortageItemId: shortageItem.id,
            userId: user.id,
            previousQuantity: new Prisma.Decimal(prevQty),
            addedQuantity: new Prisma.Decimal(addQty),
            newQuantity: new Prisma.Decimal(newQty),
          },
        });

        await this.activityService.log(tx, {
          companyId: user.companyId!,
          branchId,
          userId: user.id,
          type: ActivityType.SHORTAGE_QUANTITY_INCREASED,
          referenceNumber: shortageRequest.documentNumber,
          description: `${user.fullName} أضاف ${addQty} إلى كمية ${partNumber} / ${brand} في طلب النواقص ${shortageRequest.documentNumber} (الكمية الإجمالية: ${newQty})`,
        });
      } else {
        // Create new item in request
        shortageItem = await tx.shortageItem.create({
          data: {
            shortageRequestId: shortageRequest.id,
            productId,
            partNumberSnapshot: partNumber,
            partNameSnapshot: partName,
            brandSnapshot: brand,
            quantity: new Prisma.Decimal(dto.quantity),
            note: dto.note ? dto.note.trim() : null,
            createdByUserId: user.id,
          },
          include: {
            createdBy: { select: { fullName: true, username: true } },
          },
        });

        // Record initial event
        await tx.shortageItemEvent.create({
          data: {
            shortageItemId: shortageItem.id,
            userId: user.id,
            previousQuantity: new Prisma.Decimal(0),
            addedQuantity: new Prisma.Decimal(dto.quantity),
            newQuantity: new Prisma.Decimal(dto.quantity),
          },
        });

        await this.activityService.log(tx, {
          companyId: user.companyId!,
          branchId,
          userId: user.id,
          type: ActivityType.SHORTAGE_ITEM_ADDED,
          referenceNumber: shortageRequest.documentNumber,
          description: `${user.fullName} سجل نقص ${dto.quantity} × ${partNumber} / ${brand} في (${shortageRequest.documentNumber})`,
        });
      }

      return {
        item: {
          id: shortageItem.id,
          shortageRequestId: shortageItem.shortageRequestId,
          productId: shortageItem.productId,
          partNumberSnapshot: shortageItem.partNumberSnapshot,
          partNameSnapshot: shortageItem.partNameSnapshot,
          brandSnapshot: shortageItem.brandSnapshot,
          quantity: Number(shortageItem.quantity),
          note: shortageItem.note,
          createdByUserId: shortageItem.createdByUserId,
          createdByFullName: shortageItem.createdBy.fullName,
          createdAt: shortageItem.createdAt,
          updatedAt: shortageItem.updatedAt,
        },
        request: {
          id: shortageRequest.id,
          documentNumber: shortageRequest.documentNumber,
          status: shortageRequest.status,
        },
      };
    });
  }

  async findAll(
    user: AuthUser,
    query: {
      status?: ShortageRequestStatus;
      branchId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 15;
    const skip = (page - 1) * pageSize;

    const where: any = { companyId: user.companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.branchId) {
      this.validateBranchAccess(user, query.branchId);
      where.branchId = query.branchId;
    } else if (user.role === UserRole.OPERATOR) {
      where.branchId = { in: user.branchIds };
    }

    if (query.dateFrom || query.dateTo) {
      where.businessDate = {};
      if (query.dateFrom) where.businessDate.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        where.businessDate.lte = to;
      }
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { documentNumber: { contains: s, mode: 'insensitive' } },
        {
          items: {
            some: {
              OR: [
                { partNumberSnapshot: { contains: s, mode: 'insensitive' } },
                { partNameSnapshot: { contains: s, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [requests, total] = await Promise.all([
      this.prisma.shortageRequest.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          branch: { select: { name: true, code: true } },
          closedBy: { select: { fullName: true } },
          items: { select: { id: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shortageRequest.count({ where }),
    ]);

    const mapped = requests.map((req) => {
      const totalItemsCount = req.items.length;
      const totalQuantity = req.items.reduce((sum, item) => sum + Number(item.quantity), 0);

      return {
        id: req.id,
        companyId: req.companyId,
        branchId: req.branchId,
        branchName: req.branch?.name,
        documentNumber: req.documentNumber,
        businessDate: req.businessDate,
        status: req.status,
        closedByFullName: req.closedBy?.fullName || null,
        closedAt: req.closedAt,
        totalItemsCount,
        totalQuantity,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      };
    });

    return {
      items: mapped,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, user: AuthUser) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const req = await this.prisma.shortageRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        branch: { select: { name: true, code: true } },
        closedBy: { select: { fullName: true } },
        items: {
          include: {
            createdBy: { select: { fullName: true, username: true } },
            events: {
              include: { user: { select: { fullName: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!req) {
      throw new NotFoundException('طلب النواقص غير موجود');
    }

    if (user.role === UserRole.OPERATOR && !user.branchIds.includes(req.branchId)) {
      throw new ForbiddenException('ليس لديك صلاحية على هذا الفرع');
    }

    return this.mapRequestDto(req);
  }

  async closeRequest(id: string, user: AuthUser) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const req = await this.prisma.shortageRequest.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!req) {
      throw new NotFoundException('طلب النواقص غير موجود');
    }

    if (req.status === ShortageRequestStatus.CLOSED) {
      throw new BadRequestException('طلب النواقص مغلق بالفعل');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.shortageRequest.update({
        where: { id },
        data: {
          status: ShortageRequestStatus.CLOSED,
          closedByUserId: user.id,
          closedAt: new Date(),
        },
      });

      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId: req.branchId,
        userId: user.id,
        type: ActivityType.SHORTAGE_REQUEST_CLOSED,
        referenceNumber: req.documentNumber,
        description: `${user.fullName} أغلق طلب النواقص ${req.documentNumber}`,
      });

      return res;
    });

    return this.findOne(updated.id, user);
  }

  async updateItem(
    itemId: string,
    user: AuthUser,
    dto: { quantity?: number; note?: string },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const item = await this.prisma.shortageItem.findUnique({
      where: { id: itemId },
      include: { shortageRequest: true },
    });

    if (!item || item.shortageRequest.companyId !== user.companyId) {
      throw new NotFoundException('الصنف غير موجود');
    }

    if (item.shortageRequest.status === ShortageRequestStatus.CLOSED) {
      throw new ForbiddenException('لا يمكن تعديل الصنف بعد إغلاق طلب النواقص');
    }

    // Role-based permission check: Operator can only edit items they added in their authorized branch
    if (user.role === UserRole.OPERATOR) {
      if (item.createdByUserId !== user.id) {
        throw new ForbiddenException('لا يمكنك تعديل صنف أضافه مستخدم آخر');
      }
      if (!user.branchIds.includes(item.shortageRequest.branchId)) {
        throw new ForbiddenException('ليس لديك صلاحية على هذا الفرع');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const newQty = dto.quantity !== undefined ? dto.quantity : Number(item.quantity);

      const res = await tx.shortageItem.update({
        where: { id: itemId },
        data: {
          ...(dto.quantity !== undefined && { quantity: new Prisma.Decimal(newQty) }),
          ...(dto.note !== undefined && { note: dto.note ? dto.note.trim() : null }),
          updatedAt: new Date(),
        },
      });

      // Recalculate request totals
      const allItems = await tx.shortageItem.findMany({
        where: { shortageRequestId: item.shortageRequestId },
      });
      const totalItems = allItems.length;
      let totalQuantity = 0;
      for (const it of allItems) {
        totalQuantity += Number(it.quantity);
      }

      await tx.shortageRequest.update({
        where: { id: item.shortageRequestId },
        data: {
          totalItems,
          totalQuantity: new Prisma.Decimal(totalQuantity),
        },
      });

      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId: item.shortageRequest.branchId,
        userId: user.id,
        type: ActivityType.SHORTAGE_ITEM_EDITED,
        referenceNumber: item.shortageRequest.documentNumber,
        description: `${user.fullName} عدّل كمية/بيانات الصنف ${item.partNumberSnapshot} في طلب النواقص ${item.shortageRequest.documentNumber}`,
      });

      return res;
    });

    return updated;
  }

  async deleteItem(itemId: string, user: AuthUser) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const item = await this.prisma.shortageItem.findUnique({
      where: { id: itemId },
      include: { shortageRequest: true },
    });

    if (!item || item.shortageRequest.companyId !== user.companyId) {
      throw new NotFoundException('الصنف غير موجود');
    }

    if (item.shortageRequest.status === ShortageRequestStatus.CLOSED) {
      throw new ForbiddenException('لا يمكن حذف الصنف بعد إغلاق طلب النواقص');
    }

    // Role-based permission check: Operator can only delete items they added in their authorized branch
    if (user.role === UserRole.OPERATOR) {
      if (item.createdByUserId !== user.id) {
        throw new ForbiddenException('لا يمكنك حذف صنف أضافه مستخدم آخر');
      }
      if (!user.branchIds.includes(item.shortageRequest.branchId)) {
        throw new ForbiddenException('ليس لديك صلاحية على هذا الفرع');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete events first
      await tx.shortageItemEvent.deleteMany({
        where: { shortageItemId: itemId },
      });

      await tx.shortageItem.delete({
        where: { id: itemId },
      });

      // Recalculate request totals
      const allItems = await tx.shortageItem.findMany({
        where: { shortageRequestId: item.shortageRequestId },
      });
      const totalItems = allItems.length;
      let totalQuantity = 0;
      for (const it of allItems) {
        totalQuantity += Number(it.quantity);
      }

      await tx.shortageRequest.update({
        where: { id: item.shortageRequestId },
        data: {
          totalItems,
          totalQuantity: new Prisma.Decimal(totalQuantity),
        },
      });

      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId: item.shortageRequest.branchId,
        userId: user.id,
        type: ActivityType.SHORTAGE_ITEM_EDITED,
        referenceNumber: item.shortageRequest.documentNumber,
        description: `${user.fullName} حذف الصنف ${item.partNumberSnapshot} من طلب النواقص ${item.shortageRequest.documentNumber}`,
      });
    });

    return { message: 'تم حذف الصنف بنجاح' };
  }

  private mapRequestDto(req: any) {
    const items = (req.items || []).map((it: any) => ({
      id: it.id,
      shortageRequestId: it.shortageRequestId,
      productId: it.productId,
      partNumberSnapshot: it.partNumberSnapshot,
      partNameSnapshot: it.partNameSnapshot,
      brandSnapshot: it.brandSnapshot,
      quantity: Number(it.quantity),
      note: it.note,
      createdByUserId: it.createdByUserId,
      createdByFullName: it.createdBy?.fullName || '',
      events: (it.events || []).map((ev: any) => ({
        id: ev.id,
        shortageItemId: ev.shortageItemId,
        userId: ev.userId,
        userFullName: ev.user?.fullName || '',
        previousQuantity: Number(ev.previousQuantity),
        addedQuantity: Number(ev.addedQuantity),
        newQuantity: Number(ev.newQuantity),
        createdAt: ev.createdAt,
      })),
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));

    const totalItemsCount = items.length;
    const totalQuantity = items.reduce((sum: number, it: any) => sum + it.quantity, 0);

    return {
      id: req.id,
      companyId: req.companyId,
      branchId: req.branchId,
      branchName: req.branch?.name,
      documentNumber: req.documentNumber,
      businessDate: req.businessDate,
      status: req.status,
      closedByFullName: req.closedBy?.fullName || null,
      closedAt: req.closedAt,
      totalItemsCount,
      totalQuantity,
      items,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    };
  }
}
