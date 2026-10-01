import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../common/services/sequence.service';
import { ActivityService } from '../common/services/activity.service';
import { CustomersService } from '../customers/customers.service';
import { SalesRequestStatus, ActivityType, AuthUser, UserRole, EntityStatus, normalizePartNumber, normalizeBrand } from '../common/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private sequenceService: SequenceService,
    private activityService: ActivityService,
    private customersService: CustomersService,
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
    const activeReq = await this.prisma.salesRequest.findFirst({
      where: {
        companyId,
        branchId,
        status: SalesRequestStatus.UNINVOICED,
      },
      include: {
        branch: { select: { name: true, code: true } },
        items: {
          include: {
            createdBy: { select: { fullName: true, username: true } },
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
   * One Sale Request -> Multiple Items
   * Atomic PostgreSQL transaction:
   * 1. Validate items and customer
   * 2. Find or create Customer
   * 3. Generate sequential document number (e.g., SL-20260929-001)
   * 4. Compute totals
   * 5. Create SalesRequest
   * 6. Create SalesItems
   * 7. Log Activity
   */
  async checkItemInActiveRequest(
    companyId: string,
    branchId: string,
    partNumber: string,
    brand?: string,
    productId?: string,
  ) {
    const activeReq = await this.prisma.salesRequest.findFirst({
      where: {
        companyId,
        branchId,
        status: SalesRequestStatus.UNINVOICED,
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
      unitPrice: Number(existing.unitPrice),
      soldTo: existing.soldTo,
      createdByFullName: existing.createdBy?.fullName || 'أحد الموظفين',
    };
  }

  /**
   * Sale Recording:
   * 1. Search for current UNINVOICED sale request for the branch.
   * 2. If exists, add items to it. If none, create new UNINVOICED request.
   * 3. For duplicate parts inside the request, accumulate quantities atomically.
   * 4. Update request totals.
   */
  async createSaleRequest(
    user: AuthUser,
    dto: {
      branchId?: string;
      customer?: {
        id?: string;
        name: string;
        phone?: string;
        taxNumber?: string;
        city?: string;
      };
      items: Array<{
        productId?: string;
        partNumber: string;
        partName?: string;
        brand: string;
        quantity: number;
        unitPrice: number;
        soldTo?: string;
        note?: string;
      }>;
    },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const branchId = dto.branchId || user.currentBranchId;
    if (!branchId || (user.role === UserRole.OPERATOR && (!user.branchIds || user.branchIds.length === 0))) {
      throw new BadRequestException('المستخدم غير مرتبط بأي فرع حالياً، لا يمكن تسجيل المبيعات. يرجى مراجعة إدارة الشركة لربط حسابك بفرع.');
    }

    this.validateBranchAccess(user, branchId);

    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('يجب إضافة صنف واحد على الأقل في طلب البيع');
    }

    for (const it of dto.items) {
      if (!it.partNumber || !it.brand || it.quantity <= 0 || it.unitPrice < 0) {
        throw new BadRequestException('يرجى التحقق من صحة بيانات الأصناف (رقم القطعة، الماركة، الكمية > 0، والسعر >= 0)');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve customer if provided
      let defaultCustomerName = 'عميل نقدي';
      if (dto.customer && dto.customer.name && dto.customer.name.trim()) {
        const cust = await this.customersService.findOrCreateInTx(
          tx,
          user.companyId!,
          user.id,
          dto.customer,
        );
        defaultCustomerName = cust.name;
      }

      // 2. Check for active UNINVOICED request for this branch
      let salesRequest = await tx.salesRequest.findFirst({
        where: {
          companyId: user.companyId!,
          branchId,
          status: SalesRequestStatus.UNINVOICED,
        },
        include: {
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      let isNewRequest = false;

      if (!salesRequest) {
        isNewRequest = true;
        const documentNumber = await this.sequenceService.getNextDocumentNumber(
          tx,
          user.companyId!,
          branchId,
          'SALES',
        );

        salesRequest = await tx.salesRequest.create({
          data: {
            companyId: user.companyId!,
            branchId,
            createdById: user.id,
            documentNumber,
            businessDate: new Date(),
            status: SalesRequestStatus.UNINVOICED,
            totalItems: 0,
            totalQuantity: new Prisma.Decimal(0),
            totalAmount: new Prisma.Decimal(0),
          },
          include: {
            items: true,
          },
        });
      }

      // 3. Process items (accumulate quantities if already present in open request)
      const currentItems = [...salesRequest.items];

      for (const it of dto.items) {
        const partNumber = it.partNumber.trim();
        const brand = it.brand.trim();
        const partName = it.partName?.trim() || partNumber;
        const soldTo = it.soldTo?.trim() || defaultCustomerName;
        const qtyToAdd = Number(it.quantity);
        const unitPrice = Number(it.unitPrice);

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
          const newQty = Number(existing.quantity) + qtyToAdd;
          const newLineTotal = newQty * Number(existing.unitPrice);

          const updatedItem = await tx.salesItem.update({
            where: { id: existing.id },
            data: {
              quantity: new Prisma.Decimal(newQty),
              lineTotal: new Prisma.Decimal(newLineTotal),
              soldTo: soldTo !== 'عميل نقدي' ? soldTo : existing.soldTo,
              note: it.note ? (existing.note ? `${existing.note} | ${it.note}` : it.note) : existing.note,
              updatedAt: new Date(),
            },
          });

          currentItems[existingItemIndex] = updatedItem;
        } else {
          // Find product if exists
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

          const lineTotal = qtyToAdd * unitPrice;

          const newItem = await tx.salesItem.create({
            data: {
              salesRequestId: salesRequest.id,
              productId,
              partNumberSnapshot: partNumber,
              partNameSnapshot: partName,
              brandSnapshot: brand,
              quantity: new Prisma.Decimal(qtyToAdd),
              unitPrice: new Prisma.Decimal(unitPrice),
              lineTotal: new Prisma.Decimal(lineTotal),
              soldTo,
              note: it.note ? it.note.trim() : null,
              createdByUserId: user.id,
            },
          });

          currentItems.push(newItem);
        }
      }

      // 4. Recalculate Totals
      const totalItems = currentItems.length;
      let totalQuantity = 0;
      let totalAmount = 0;

      for (const item of currentItems) {
        const q = Number(item.quantity);
        const p = Number(item.unitPrice);
        totalQuantity += q;
        totalAmount += q * p;
      }

      await tx.salesRequest.update({
        where: { id: salesRequest.id },
        data: {
          totalItems,
          totalQuantity: new Prisma.Decimal(totalQuantity),
          totalAmount: new Prisma.Decimal(totalAmount),
        },
      });

      // 5. Activity Log
      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId,
        userId: user.id,
        type: isNewRequest ? ActivityType.SALE_REQUEST_CREATED : ActivityType.SALE_ITEM_ADDED,
        referenceNumber: salesRequest.documentNumber,
        description: isNewRequest
          ? `${user.fullName} أنشأ طلب بيع مفتوح (${salesRequest.documentNumber}) بإجمالي ${totalAmount.toFixed(2)} ر.س`
          : `${user.fullName} أضاف أصناف إلى طلب البيع المفتوح (${salesRequest.documentNumber})`,
      });

      return {
        id: salesRequest.id,
        documentNumber: salesRequest.documentNumber,
        status: salesRequest.status,
        isNewRequest,
        totalItems,
        totalQuantity,
        totalAmount,
        createdAt: salesRequest.createdAt,
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
      unitPrice: number;
      soldTo: string;
      note?: string;
    },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const branchId = dto.branchId || user.currentBranchId;
    if (!branchId) {
      throw new BadRequestException('يجب تحديد الفرع لتسجيل البيع');
    }

    this.validateBranchAccess(user, branchId);

    if (!dto.partNumber || !dto.brand || !dto.quantity || dto.quantity <= 0 || dto.unitPrice === undefined || dto.unitPrice < 0) {
      throw new BadRequestException('يرجى التحقق من صحة البيانات المدخلة (رقم القطعة، الماركة، الكمية، والسعر)');
    }

    if (!dto.soldTo || !dto.soldTo.trim()) {
      throw new BadRequestException('حقل (لمن تم البيع) مطلوب');
    }

    const partNumber = dto.partNumber.trim();
    const brand = dto.brand.trim();
    const partName = dto.partName ? dto.partName.trim() : partNumber;

    // Execute atomically inside PostgreSQL transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Check for active UNINVOICED request for this branch
      let salesRequest = await tx.salesRequest.findFirst({
        where: {
          companyId: user.companyId!,
          branchId,
          status: SalesRequestStatus.UNINVOICED,
        },
        orderBy: { createdAt: 'desc' },
      });

      // 2. If not found, generate new document number safely and create active request
      if (!salesRequest) {
        const documentNumber = await this.sequenceService.getNextDocumentNumber(
          tx,
          user.companyId!,
          branchId,
          'SALES',
        );

        salesRequest = await tx.salesRequest.create({
          data: {
            companyId: user.companyId!,
            branchId,
            documentNumber,
            businessDate: new Date(),
            status: SalesRequestStatus.UNINVOICED,
          },
        });
      }

      // 3. Resolve or verify product if provided
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

      // 4. Insert sales item (preserving independent line items even if same part/brand)
      const salesItem = await tx.salesItem.create({
        data: {
          salesRequestId: salesRequest.id,
          productId,
          partNumberSnapshot: partNumber,
          partNameSnapshot: partName,
          brandSnapshot: brand,
          quantity: new Prisma.Decimal(dto.quantity),
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          soldTo: dto.soldTo.trim(),
          note: dto.note ? dto.note.trim() : null,
          createdByUserId: user.id,
        },
        include: {
          createdBy: { select: { fullName: true, username: true } },
        },
      });

      // 5. Create human-readable Arabic activity log
      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId,
        userId: user.id,
        type: ActivityType.SALE_ITEM_ADDED,
        referenceNumber: salesRequest.documentNumber,
        description: `${user.fullName} أضاف ${dto.quantity} × ${partNumber} / ${brand} إلى المبيعات (${salesRequest.documentNumber})`,
      });

      return {
        item: {
          id: salesItem.id,
          salesRequestId: salesItem.salesRequestId,
          productId: salesItem.productId,
          partNumberSnapshot: salesItem.partNumberSnapshot,
          partNameSnapshot: salesItem.partNameSnapshot,
          brandSnapshot: salesItem.brandSnapshot,
          quantity: Number(salesItem.quantity),
          unitPrice: Number(salesItem.unitPrice),
          totalPrice: Number(salesItem.quantity) * Number(salesItem.unitPrice),
          soldTo: salesItem.soldTo,
          note: salesItem.note,
          createdByUserId: salesItem.createdByUserId,
          createdByFullName: salesItem.createdBy.fullName,
          createdAt: salesItem.createdAt,
          updatedAt: salesItem.updatedAt,
        },
        request: {
          id: salesRequest.id,
          documentNumber: salesRequest.documentNumber,
          status: salesRequest.status,
        },
      };
    });
  }

  async findAll(
    user: AuthUser,
    query: {
      status?: SalesRequestStatus;
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
        { officialInvoiceNumber: { contains: s, mode: 'insensitive' } },
        { customer: { name: { contains: s, mode: 'insensitive' } } },
        {
          items: {
            some: {
              OR: [
                { partNumberSnapshot: { contains: s, mode: 'insensitive' } },
                { soldTo: { contains: s, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [requests, total] = await Promise.all([
      this.prisma.salesRequest.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          branch: { select: { name: true, code: true } },
          customer: { select: { id: true, name: true, phone: true } },
          createdBy: { select: { fullName: true } },
          invoicedBy: { select: { fullName: true } },
          items: {
            select: {
              id: true,
              soldTo: true,
              quantity: true,
              unitPrice: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesRequest.count({ where }),
    ]);

    const mapped = requests.map((req) => {
      const totalItemsCount = req.totalItems || req.items.length;
      const totalQuantity = Number(req.totalQuantity) || req.items.reduce((sum, item) => sum + Number(item.quantity), 0);
      const totalAmount = Number(req.totalAmount) || req.items.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
        0,
      );

      return {
        id: req.id,
        companyId: req.companyId,
        branchId: req.branchId,
        branchName: req.branch?.name,
        customerId: req.customerId,
        customer: req.customer,
        customerName: req.customer?.name || (req.items?.[0]?.soldTo || 'عميل نقدي'),
        createdByFullName: req.createdBy?.fullName || '',
        documentNumber: req.documentNumber,
        businessDate: req.businessDate,
        status: req.status,
        officialInvoiceNumber: req.officialInvoiceNumber,
        officialInvoiceDate: req.officialInvoiceDate,
        invoicedByFullName: req.invoicedBy?.fullName || null,
        invoicedAt: req.invoicedAt,
        totalItemsCount,
        totalQuantity,
        totalAmount,
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

    const req = await this.prisma.salesRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        branch: { select: { name: true, code: true } },
        customer: true,
        createdBy: { select: { fullName: true, username: true } },
        invoicedBy: { select: { fullName: true } },
        items: {
          include: {
            createdBy: { select: { fullName: true, username: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!req) {
      throw new NotFoundException('طلب المبيعات غير موجود');
    }

    if (user.role === UserRole.OPERATOR && !user.branchIds.includes(req.branchId)) {
      throw new ForbiddenException('ليس لديك صلاحية على هذا الفرع');
    }

    return this.mapRequestDto(req);
  }

  async markInvoiced(
    id: string,
    user: AuthUser,
    dto: { officialInvoiceNumber: string; officialInvoiceDate?: string },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    if (!dto.officialInvoiceNumber || !dto.officialInvoiceNumber.trim()) {
      throw new BadRequestException('رقم الفاتورة الرسمية مطلوب');
    }

    const req = await this.prisma.salesRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: { items: true },
    });

    if (!req) {
      throw new NotFoundException('طلب المبيعات غير موجود');
    }

    if (req.status === SalesRequestStatus.INVOICED) {
      throw new BadRequestException('هذا الطلب مفوتر بالفعل مسبقاً');
    }

    if (req.items.length === 0) {
      throw new BadRequestException('لا يمكن فوترة طلب مبيعات لا يحتوي على أي صنف');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.salesRequest.update({
        where: { id },
        data: {
          status: SalesRequestStatus.INVOICED,
          officialInvoiceNumber: dto.officialInvoiceNumber.trim(),
          officialInvoiceDate: dto.officialInvoiceDate ? new Date(dto.officialInvoiceDate) : new Date(),
          invoicedByUserId: user.id,
          invoicedAt: new Date(),
        },
      });

      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId: req.branchId,
        userId: user.id,
        type: ActivityType.SALE_REQUEST_INVOICED,
        referenceNumber: req.documentNumber,
        description: `${user.fullName} حوّل الطلب ${req.documentNumber} إلى مفوتر برقم ${dto.officialInvoiceNumber.trim()}`,
      });

      return res;
    });

    return this.findOne(updated.id, user);
  }

  async updateItem(
    itemId: string,
    user: AuthUser,
    dto: { quantity?: number; unitPrice?: number; soldTo?: string; note?: string },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const item = await this.prisma.salesItem.findUnique({
      where: { id: itemId },
      include: { salesRequest: true },
    });

    if (!item || item.salesRequest.companyId !== user.companyId) {
      throw new NotFoundException('الصنف غير موجود');
    }

    if (item.salesRequest.status === SalesRequestStatus.INVOICED) {
      throw new ForbiddenException('لا يمكن تعديل الصنف بعد فوترة الطلب رسمياً');
    }

    // Role-based permission check: Operator can only edit items they added in their authorized branch
    if (user.role === UserRole.OPERATOR) {
      if (item.createdByUserId !== user.id) {
        throw new ForbiddenException('لا يمكنك تعديل صنف أضافه مستخدم آخر');
      }
      if (!user.branchIds.includes(item.salesRequest.branchId)) {
        throw new ForbiddenException('ليس لديك صلاحية على هذا الفرع');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const newQty = dto.quantity !== undefined ? dto.quantity : Number(item.quantity);
      const newUnitPrice = dto.unitPrice !== undefined ? dto.unitPrice : Number(item.unitPrice);
      const newLineTotal = newQty * newUnitPrice;

      const res = await tx.salesItem.update({
        where: { id: itemId },
        data: {
          ...(dto.quantity !== undefined && { quantity: new Prisma.Decimal(newQty) }),
          ...(dto.unitPrice !== undefined && { unitPrice: new Prisma.Decimal(newUnitPrice) }),
          lineTotal: new Prisma.Decimal(newLineTotal),
          ...(dto.soldTo !== undefined && { soldTo: dto.soldTo.trim() }),
          ...(dto.note !== undefined && { note: dto.note ? dto.note.trim() : null }),
          updatedAt: new Date(),
        },
      });

      // Recalculate request totals
      const allItems = await tx.salesItem.findMany({
        where: { salesRequestId: item.salesRequestId },
      });
      const totalItems = allItems.length;
      let totalQuantity = 0;
      let totalAmount = 0;
      for (const it of allItems) {
        const q = Number(it.quantity);
        const p = Number(it.unitPrice);
        totalQuantity += q;
        totalAmount += q * p;
      }

      await tx.salesRequest.update({
        where: { id: item.salesRequestId },
        data: {
          totalItems,
          totalQuantity: new Prisma.Decimal(totalQuantity),
          totalAmount: new Prisma.Decimal(totalAmount),
        },
      });

      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId: item.salesRequest.branchId,
        userId: user.id,
        type: ActivityType.SALE_ITEM_EDITED,
        referenceNumber: item.salesRequest.documentNumber,
        description: `${user.fullName} عدّل بيانات الصنف ${item.partNumberSnapshot} في الطلب ${item.salesRequest.documentNumber}`,
      });

      return res;
    });

    return updated;
  }

  async deleteItem(itemId: string, user: AuthUser) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }

    const item = await this.prisma.salesItem.findUnique({
      where: { id: itemId },
      include: { salesRequest: true },
    });

    if (!item || item.salesRequest.companyId !== user.companyId) {
      throw new NotFoundException('الصنف غير موجود');
    }

    if (item.salesRequest.status === SalesRequestStatus.INVOICED) {
      throw new ForbiddenException('لا يمكن حذف الصنف بعد فوترة الطلب رسمياً');
    }

    // Role-based permission check: Operator can only delete items they added in their authorized branch
    if (user.role === UserRole.OPERATOR) {
      if (item.createdByUserId !== user.id) {
        throw new ForbiddenException('لا يمكنك حذف صنف أضافه مستخدم آخر');
      }
      if (!user.branchIds.includes(item.salesRequest.branchId)) {
        throw new ForbiddenException('ليس لديك صلاحية على هذا الفرع');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.salesItem.delete({ where: { id: itemId } });

      // Recalculate request totals
      const allItems = await tx.salesItem.findMany({
        where: { salesRequestId: item.salesRequestId },
      });
      const totalItems = allItems.length;
      let totalQuantity = 0;
      let totalAmount = 0;
      for (const it of allItems) {
        const q = Number(it.quantity);
        const p = Number(it.unitPrice);
        totalQuantity += q;
        totalAmount += q * p;
      }

      await tx.salesRequest.update({
        where: { id: item.salesRequestId },
        data: {
          totalItems,
          totalQuantity: new Prisma.Decimal(totalQuantity),
          totalAmount: new Prisma.Decimal(totalAmount),
        },
      });

      await this.activityService.log(tx, {
        companyId: user.companyId!,
        branchId: item.salesRequest.branchId,
        userId: user.id,
        type: ActivityType.SALE_ITEM_DELETED,
        referenceNumber: item.salesRequest.documentNumber,
        description: `${user.fullName} حذف الصنف ${item.partNumberSnapshot} من الطلب ${item.salesRequest.documentNumber}`,
      });
    });

    return { message: 'تم حذف الصنف بنجاح' };
  }


  private mapRequestDto(req: any) {
    const items = (req.items || []).map((it: any) => ({
      id: it.id,
      salesRequestId: it.salesRequestId,
      productId: it.productId,
      partNumberSnapshot: it.partNumberSnapshot,
      partNameSnapshot: it.partNameSnapshot,
      brandSnapshot: it.brandSnapshot,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.quantity) * Number(it.unitPrice),
      soldTo: it.soldTo,
      note: it.note,
      createdByUserId: it.createdByUserId,
      createdByFullName: it.createdBy?.fullName || '',
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));

    const totalItemsCount = items.length;
    const totalQuantity = items.reduce((sum: number, it: any) => sum + it.quantity, 0);
    const totalAmount = items.reduce((sum: number, it: any) => sum + it.totalPrice, 0);

    return {
      id: req.id,
      companyId: req.companyId,
      branchId: req.branchId,
      branchName: req.branch?.name,
      customerId: req.customerId,
      customer: req.customer ? {
        id: req.customer.id,
        name: req.customer.name,
        phone: req.customer.phone,
        taxNumber: req.customer.taxNumber,
        city: req.customer.city,
      } : null,
      customerName: req.customer?.name || (items[0]?.soldTo || 'عميل نقدي'),
      createdByFullName: req.createdBy?.fullName || '',
      documentNumber: req.documentNumber,
      businessDate: req.businessDate,
      status: req.status,
      officialInvoiceNumber: req.officialInvoiceNumber,
      officialInvoiceDate: req.officialInvoiceDate,
      invoicedByFullName: req.invoicedBy?.fullName || null,
      invoicedAt: req.invoicedAt,
      totalItemsCount,
      totalQuantity,
      totalAmount,
      items,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    };
  }
}
