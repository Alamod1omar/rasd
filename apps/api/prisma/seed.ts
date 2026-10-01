import { PrismaClient, UserRole, EntityStatus, SalesRequestStatus, ShortageRequestStatus, ActivityType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning previous development data ---');
  await prisma.activityLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.shortageItemEvent.deleteMany();
  await prisma.shortageItem.deleteMany();
  await prisma.shortageRequest.deleteMany();
  await prisma.salesItem.deleteMany();
  await prisma.salesRequest.deleteMany();
  await prisma.documentSequence.deleteMany();
  await prisma.product.deleteMany();
  await prisma.userBranchAccess.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.company.deleteMany();

  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const operatorPasswordHash = await bcrypt.hash('Operator@123456', 10);
  const omarAdminPasswordHash = await bcrypt.hash('Al-1234567', 10);

  console.log('--- Creating System Admin (Omar Alamodi) ---');
  const sysAdmin = await prisma.user.create({
    data: {
      username: 'omaradmin',
      fullName: 'عمر العمودي',
      passwordHash: omarAdminPasswordHash,
      role: UserRole.SYSTEM_ADMIN,
      status: EntityStatus.ACTIVE,
    },
  });

  console.log('--- Creating Demo Company ---');
  const company = await prisma.company.create({
    data: {
      name: 'شركة رصد للمعدات وقطع الغيار',
      code: 'RASD-01',
      status: EntityStatus.ACTIVE,
    },
  });

  console.log('--- Creating Branches ---');
  const branchRiyadh = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: 'الفرع الرئيسي - الرياض',
      code: 'MAIN-RYD',
      status: EntityStatus.ACTIVE,
    },
  });

  const branchJeddah = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: 'فرع المنطقة الغربية - جدة',
      code: 'BR-JED',
      status: EntityStatus.ACTIVE,
    },
  });

  console.log('--- Creating Company Admin & Operators ---');
  const compAdmin = await prisma.user.create({
    data: {
      companyId: company.id,
      username: 'admin_omar',
      fullName: 'عمر العمودي (مدير الشركة)',
      passwordHash,
      role: UserRole.COMPANY_ADMIN,
      status: EntityStatus.ACTIVE,
    },
  });

  const operatorAhmed = await prisma.user.create({
    data: {
      companyId: company.id,
      username: 'ahmed',
      fullName: 'أحمد محمد',
      passwordHash: operatorPasswordHash,
      role: UserRole.OPERATOR,
      status: EntityStatus.ACTIVE,
    },
  });

  const operatorKhaled = await prisma.user.create({
    data: {
      companyId: company.id,
      username: 'khaled',
      fullName: 'خالد عبدالله',
      passwordHash: operatorPasswordHash,
      role: UserRole.OPERATOR,
      status: EntityStatus.ACTIVE,
    },
  });

  // Assign branch access
  await prisma.userBranchAccess.createMany({
    data: [
      { userId: compAdmin.id, branchId: branchRiyadh.id },
      { userId: compAdmin.id, branchId: branchJeddah.id },
      { userId: operatorAhmed.id, branchId: branchRiyadh.id },
      { userId: operatorKhaled.id, branchId: branchRiyadh.id },
    ],
  });

  console.log('--- Creating Product Catalog (20+ items with brand variations) ---');
  const rawProducts = [
    { partNumber: '7N1234', partName: 'فلتر زيت محرك', brand: 'CAT' },
    { partNumber: '7N1234', partName: 'فلتر زيت محرك تجاري', brand: 'CTP' },
    { partNumber: '8T4136', partName: 'مسمار شداد مجنزر', brand: 'CAT' },
    { partNumber: '8T4136', partName: 'مسمار شداد مجنزر ياباني', brand: 'KOMATSU' },
    { partNumber: '1R0716', partName: 'فلتر ديزل رئيسي', brand: 'CAT' },
    { partNumber: '1R0716', partName: 'فلتر ديزل رئيسي بديل', brand: 'CTP' },
    { partNumber: '1R0749', partName: 'فلتر هيدروليك عالي الضغط', brand: 'CAT' },
    { partNumber: '1R0750', partName: 'فلتر وقود إضافي ناعم', brand: 'CAT' },
    { partNumber: '9W8452', partName: 'سن غرافة بوكلين', brand: 'CAT' },
    { partNumber: '9W8452', partName: 'سن غرافة إيطالي شد بلد', brand: 'ITR' },
    { partNumber: '6I2505', partName: 'فلتر هواء خارجي كبير', brand: 'CAT' },
    { partNumber: '6I2506', partName: 'فلتر هواء داخلي أمان', brand: 'CAT' },
    { partNumber: '4N0015', partName: 'طقم وجيه طرمبة ماء', brand: 'CAT' },
    { partNumber: '2W8002', partName: 'سبائك عمود كرنك ستاندر', brand: 'CAT' },
    { partNumber: '7C3161', partName: 'بلف حرارة ثيرموستات', brand: 'CAT' },
    { partNumber: '247-5212', partName: 'طرمبة هيدروليك مساعدة', brand: 'CAT' },
    { partNumber: '109-7294', partName: 'قلب تيربو شاحن هواء', brand: 'CAT' },
    { partNumber: '5P8245', partName: 'أورنق حراري سيليكون', brand: 'CAT' },
    { partNumber: '5P8245', partName: 'أورنق حراري تجاري', brand: 'CTP' },
    { partNumber: '123-4567', partName: 'سيل بستم دركتل هيدروليك', brand: 'KOMATSU' },
    { partNumber: '6732-71-6112', partName: 'بخاخ ديزل إلكتروني', brand: 'KOMATSU' },
    { partNumber: '207-70-14151', partName: 'وصلة جنزير رئيسية ماستر', brand: 'KOMATSU' },
  ];

  const createdProducts = [];
  for (const p of rawProducts) {
    const prod = await prisma.product.create({
      data: {
        companyId: company.id,
        partNumber: p.partNumber,
        partNumberNormalized: p.partNumber.trim().toUpperCase(),
        partName: p.partName,
        brand: p.brand,
        brandNormalized: p.brand.trim().toUpperCase(),
        status: EntityStatus.ACTIVE,
      },
    });
    createdProducts.push(prod);
  }

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  console.log('--- Creating Active UNINVOICED Sales Request with items ---');
  const activeSale = await prisma.salesRequest.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      documentNumber: `SL-${dateStr}-001`,
      businessDate: today,
      status: SalesRequestStatus.UNINVOICED,
    },
  });

  await prisma.documentSequence.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      type: 'SALES',
      prefix: 'SL',
      dateKey: dateStr,
      lastNumber: 1,
    },
  });

  const p1 = createdProducts.find((p) => p.partNumber === '7N1234' && p.brand === 'CAT')!;
  const p2 = createdProducts.find((p) => p.partNumber === '8T4136' && p.brand === 'CAT')!;
  const p3 = createdProducts.find((p) => p.partNumber === '9W8452' && p.brand === 'CAT')!;

  await prisma.salesItem.createMany({
    data: [
      {
        salesRequestId: activeSale.id,
        productId: p1.id,
        partNumberSnapshot: p1.partNumber,
        partNameSnapshot: p1.partName,
        brandSnapshot: p1.brand,
        quantity: 2,
        unitPrice: 150,
        soldTo: 'مؤسسة الرمال الذهبية للمقاولات',
        note: 'تسليم يدوي للمندوب أبو فهد',
        createdByUserId: operatorAhmed.id,
      },
      {
        salesRequestId: activeSale.id,
        productId: p2.id,
        partNumberSnapshot: p2.partNumber,
        partNameSnapshot: p2.partName,
        brandSnapshot: p2.brand,
        quantity: 10,
        unitPrice: 45,
        soldTo: 'شركة الإنشاءات الحديثة',
        note: 'عاجل ورشة الموقع',
        createdByUserId: operatorKhaled.id,
      },
      {
        salesRequestId: activeSale.id,
        productId: p3.id,
        partNumberSnapshot: p3.partNumber,
        partNameSnapshot: p3.partName,
        brandSnapshot: p3.brand,
        quantity: 4,
        unitPrice: 320,
        soldTo: 'مؤسسة الرمال الذهبية للمقاولات',
        note: 'قطع غيار حفارة كات 330',
        createdByUserId: operatorAhmed.id,
      },
    ],
  });

  console.log('--- Creating Invoiced Historical Sales Request ---');
  const pastDate = new Date(Date.now() - 86400000);
  const invoicedSale = await prisma.salesRequest.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      documentNumber: 'SL-20260925-001',
      businessDate: pastDate,
      status: SalesRequestStatus.INVOICED,
      officialInvoiceNumber: 'INV-2026-0041',
      officialInvoiceDate: pastDate,
      invoicedByUserId: compAdmin.id,
      invoicedAt: pastDate,
    },
  });

  const p4 = createdProducts.find((p) => p.partNumber === '1R0716' && p.brand === 'CAT')!;
  const p5 = createdProducts.find((p) => p.partNumber === '247-5212' && p.brand === 'CAT')!;

  await prisma.salesItem.createMany({
    data: [
      {
        salesRequestId: invoicedSale.id,
        productId: p4.id,
        partNumberSnapshot: p4.partNumber,
        partNameSnapshot: p4.partName,
        brandSnapshot: p4.brand,
        quantity: 6,
        unitPrice: 85,
        soldTo: 'شركة نقليات الصقر',
        createdByUserId: operatorAhmed.id,
      },
      {
        salesRequestId: invoicedSale.id,
        productId: p5.id,
        partNumberSnapshot: p5.partNumber,
        partNameSnapshot: p5.partName,
        brandSnapshot: p5.brand,
        quantity: 1,
        unitPrice: 4200,
        soldTo: 'شركة نقليات الصقر',
        createdByUserId: operatorKhaled.id,
      },
    ],
  });

  console.log('--- Creating Active OPEN Shortage Request ---');
  const activeShortage = await prisma.shortageRequest.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      documentNumber: `SH-${dateStr}-001`,
      businessDate: today,
      status: ShortageRequestStatus.OPEN,
    },
  });

  await prisma.documentSequence.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      type: 'SHORTAGE',
      prefix: 'SH',
      dateKey: dateStr,
      lastNumber: 1,
    },
  });

  const shItem1 = await prisma.shortageItem.create({
    data: {
      shortageRequestId: activeShortage.id,
      productId: p1.id,
      partNumberSnapshot: p1.partNumber,
      partNameSnapshot: p1.partName,
      brandSnapshot: p1.brand,
      quantity: 5,
      note: 'مطلوب توفير 5 قطع إضافية بأسرع وقت لعميل الصيانة',
      createdByUserId: operatorAhmed.id,
    },
  });

  await prisma.shortageItemEvent.create({
    data: {
      shortageItemId: shItem1.id,
      userId: operatorAhmed.id,
      previousQuantity: 0,
      addedQuantity: 5,
      newQuantity: 5,
    },
  });

  const p6 = createdProducts.find((p) => p.partNumber === '6732-71-6112' && p.brand === 'KOMATSU')!;
  const shItem2 = await prisma.shortageItem.create({
    data: {
      shortageRequestId: activeShortage.id,
      productId: p6.id,
      partNumberSnapshot: p6.partNumber,
      partNameSnapshot: p6.partName,
      brandSnapshot: p6.brand,
      quantity: 6,
      note: 'بخاخات كوماتسو غير متوفرة في المستودع الرئيسي',
      createdByUserId: operatorKhaled.id,
    },
  });

  await prisma.shortageItemEvent.create({
    data: {
      shortageItemId: shItem2.id,
      userId: operatorKhaled.id,
      previousQuantity: 0,
      addedQuantity: 6,
      newQuantity: 6,
    },
  });

  console.log('--- Creating Closed Shortage Request ---');
  const closedShortage = await prisma.shortageRequest.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      documentNumber: 'SH-20260925-001',
      businessDate: pastDate,
      status: ShortageRequestStatus.CLOSED,
      closedByUserId: compAdmin.id,
      closedAt: pastDate,
    },
  });

  await prisma.shortageItem.create({
    data: {
      shortageRequestId: closedShortage.id,
      productId: p3.id,
      partNumberSnapshot: p3.partNumber,
      partNameSnapshot: p3.partName,
      brandSnapshot: p3.brand,
      quantity: 12,
      note: 'تم تأمين الشحنة وإغلاق الطلب',
      createdByUserId: operatorAhmed.id,
    },
  });

  console.log('--- Creating Activity Logs (Arabic human readable) ---');
  await prisma.activityLog.createMany({
    data: [
      {
        companyId: company.id,
        branchId: branchRiyadh.id,
        type: ActivityType.SALE_ITEM_ADDED,
        referenceNumber: activeSale.documentNumber,
        description: 'أحمد محمد أضاف 2 × 7N1234 / CAT إلى المبيعات',
        userId: operatorAhmed.id,
      },
      {
        companyId: company.id,
        branchId: branchRiyadh.id,
        type: ActivityType.SALE_ITEM_ADDED,
        referenceNumber: activeSale.documentNumber,
        description: 'خالد عبدالله أضاف 10 × 8T4136 / CAT إلى المبيعات',
        userId: operatorKhaled.id,
      },
      {
        companyId: company.id,
        branchId: branchRiyadh.id,
        type: ActivityType.SHORTAGE_ITEM_ADDED,
        referenceNumber: activeShortage.documentNumber,
        description: 'أحمد محمد سجل نقص 5 × 7N1234 / CAT',
        userId: operatorAhmed.id,
      },
      {
        companyId: company.id,
        branchId: branchRiyadh.id,
        type: ActivityType.SHORTAGE_ITEM_ADDED,
        referenceNumber: activeShortage.documentNumber,
        description: 'خالد عبدالله سجل نقص 6 × 6732-71-6112 / KOMATSU',
        userId: operatorKhaled.id,
      },
      {
        companyId: company.id,
        branchId: branchRiyadh.id,
        type: ActivityType.SALE_REQUEST_INVOICED,
        referenceNumber: invoicedSale.documentNumber,
        description: 'عمر العمودي حوّل الطلب SL-20260925-001 إلى مفوتر برقم INV-2026-0041',
        userId: compAdmin.id,
      },
    ],
  });

  console.log('✅ SEED SUCCESSFUL! Initial state populated.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
