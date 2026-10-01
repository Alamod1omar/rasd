'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import { SalesRequest, SalesRequestStatus, UserRole } from '@/types';
import { RasdBadge } from '@/components/ui/RasdBadge';
import { RasdButton } from '@/components/ui/RasdButton';
import { RasdModal } from '@/components/ui/RasdModal';
import { RasdInput } from '@/components/ui/RasdInput';
import { RasdLoadingState } from '@/components/ui/RasdLoadingState';
import { SarSymbol, SarAmount } from '@/components/ui/SarSymbol';
import { exportDetailsToExcel } from '@/lib/excel-export';
import {
  ArrowRight,
  FileCheck2,
  Trash2,
  Edit2,
  Printer,
  FileSpreadsheet,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { quickPrintSalesOrder } from '@/lib/quick-print';

export default function SalesDetailsPage() {
  const { id } = useParams() as { id: string };
  const { user, hasPermission } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [request, setRequest] = useState<SalesRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemFilter, setItemFilter] = useState<'all' | 'my'>('all');

  // Invoicing Modal
  const [isInvoicingModalOpen, setIsInvoicingModalOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoicingLoading, setInvoicingLoading] = useState(false);

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editSoldTo, setEditSoldTo] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const data = await api.get<SalesRequest>(`/sales/${id}`);
      setRequest(data);
    } catch (e: any) {
      showError(e.message || 'تعذر تحميل تفاصيل طلب المبيعات');
      router.push('/sales');
    } finally {
      setLoading(false);
    }
  }, [id, showError, router]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Temporarily clear document.title during print to prevent browser header
  useEffect(() => {
    let savedTitle = '';
    const onBefore = () => {
      savedTitle = document.title;
      document.title = '';
    };
    const onAfter = () => {
      if (savedTitle) document.title = savedTitle;
    };
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
    };
  }, []);

  const handlePrint = () => {
    if (request) {
      quickPrintSalesOrder(request, canViewAmounts);
    } else {
      window.print();
    }
  };

  const searchParams = useSearchParams();
  const autoPrintTriggered = useRef(false);

  useEffect(() => {
    if (request && searchParams.get('print') === 'true' && !autoPrintTriggered.current) {
      autoPrintTriggered.current = true;
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [request, searchParams]);


  const handleMarkInvoiced = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      showError('رقم الفاتورة الرسمية مطلوب');
      return;
    }

    setInvoicingLoading(true);
    try {
      await api.post(`/sales/${id}/mark-invoiced`, {
        officialInvoiceNumber: invoiceNumber.trim(),
        officialInvoiceDate: invoiceDate || undefined,
      });
      showSuccess('تم تحويل الطلب إلى مفوتر بنجاح');
      setIsInvoicingModalOpen(false);
      fetchDetails();
    } catch (e: any) {
      showError(e.message || 'تعذر تحويل الطلب إلى مفوتر');
    } finally {
      setInvoicingLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string, partNumber: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف الصنف (${partNumber})؟`)) return;

    try {
      await api.delete(`/sales/items/${itemId}`);
      showSuccess('تم حذف الصنف بنجاح');
      fetchDetails();
    } catch (e: any) {
      showError(e.message || 'تعذر حذف الصنف');
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditQty(item.quantity);
    setEditPrice(item.unitPrice);
    setEditSoldTo(item.soldTo);
    setEditNote(item.note || '');
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setEditLoading(true);
    try {
      await api.patch(`/sales/items/${editingItem.id}`, {
        quantity: editQty,
        unitPrice: editPrice,
        soldTo: editSoldTo,
        note: editNote,
      });
      showSuccess('تم تحديث الصنف بنجاح');
      setEditingItem(null);
      fetchDetails();
    } catch (e: any) {
      showError(e.message || 'تعذر تحديث الصنف');
    } finally {
      setEditLoading(false);
    }
  };

  // Export Request Details to Excel (Section 13)
  const handleExportExcel = () => {
    if (!request) return;
    const metadata = [
      { label: 'رقم الطلب', value: request.documentNumber },
      { label: 'تاريخ الطلب', value: new Date(request.businessDate).toLocaleDateString('ar-SA') },
      { label: 'الفرع', value: request.branchName || '-' },
      { label: 'الحالة', value: request.status === 'INVOICED' ? 'مفوتر' : 'غير مفوتر' },
      { label: 'رقم الفاتورة الرسمية', value: request.officialInvoiceNumber || 'غير محدد' },
    ];

    const headers = [
      '#',
      'رقم القطعة (Part Number)',
      'اسم القطعة',
      'الماركة',
      'الكمية',
      'سعر الوحدة (ر.س)',
      'الإجمالي (ر.س)',
      'لمن تم البيع (العميل)',
      'سجل بواسطة',
      'وقت التسجيل',
      'ملاحظات',
    ];

    const items = (request.items || []).map((it, idx) => [
      idx + 1,
      it.partNumberSnapshot,
      it.partNameSnapshot,
      it.brandSnapshot,
      it.quantity,
      it.unitPrice,
      it.totalPrice,
      it.soldTo || 'عميل نقدي',
      it.createdByFullName || '',
      new Date(it.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      it.note || '',
    ]);

    const summary = [
      { label: 'إجمالي الأصناف', value: request.totalItemsCount },
      { label: 'إجمالي الكمية', value: request.totalQuantity },
      { label: 'إجمالي المبلغ (ر.س)', value: request.totalAmount },
    ];

    exportDetailsToExcel(
      `طلب_بيع_${request.documentNumber}`,
      'تفاصيل طلب بيع - نظام رَصْد',
      metadata,
      headers,
      items,
      summary
    );
  };

  if (loading) {
    return (
      <AppShell>
        <RasdLoadingState message="جاري استرجاع تفاصيل طلب المبيعات..." />
      </AppShell>
    );
  }

  if (!request) return null;

  const isUninvoiced = request.status === SalesRequestStatus.UNINVOICED || request.status === 'OPEN';
  const canInvoice = hasPermission('sales.invoice');
  const canViewAmounts = hasPermission('sales.amount.view');

  const displayedItems = (request.items || []).filter((item) => {
    if (itemFilter === 'my') {
      return item.createdByUserId === user?.id;
    }
    return true;
  });

  return (
    <AppShell>
      {/* ================= ON-SCREEN VIEW (Hidden when printing) ================= */}
      <div className="space-y-6 print:hidden">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/sales"
              className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
              title="العودة لسجل المبيعات"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-xl sm:text-2xl font-black text-slate-900" dir="ltr">
                  {request.documentNumber}
                </h1>
                <RasdBadge status={request.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تاريخ الطلب:{' '}
                <span className="font-mono text-slate-700">
                  {new Date(request.businessDate).toLocaleDateString('ar-SA')}
                </span>{' '}
                • الفرع: {request.branchName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-colors"
              title="تنزيل تفاصيل الطلب كملف Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تنزيل Excel</span>
            </button>

            <RasdButton
              variant="secondary"
              size="md"
              icon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
            >
              طباعة
            </RasdButton>

            {/* Invoice Action */}
            {isUninvoiced && canInvoice && (
              <RasdButton
                variant="emerald"
                size="md"
                icon={<FileCheck2 className="w-4 h-4" />}
                onClick={() => setIsInvoicingModalOpen(true)}
              >
                تحويل الطلب إلى مفوتر
              </RasdButton>
            )}
          </div>
        </div>

        {/* Request Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500">إجمالي الأصناف</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
              {request.totalItemsCount}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500">إجمالي القطع</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
              {request.totalQuantity}
            </div>
          </div>
          {/* إجمالي المبلغ — hidden if cannot view amounts */}
          {canViewAmounts && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500">إجمالي المبلغ</span>
            <div className="mt-1">
              <SarAmount
                amount={request.totalAmount}
                size="lg"
                symbolSize="1.15em"
                symbolClassName="text-slate-900"
              />
            </div>
          </div>
          )}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500">حالة الفاتورة</span>
            <div className="mt-1">
              {request.officialInvoiceNumber ? (
                <div className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                  {request.officialInvoiceNumber}
                </div>
              ) : (
                <span className="text-xs font-semibold text-amber-700">بانتظار الفاتورة الرسمية</span>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Metadata if Invoiced */}
        {!isUninvoiced && (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between text-xs text-emerald-900 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                تمت فوترة هذا الطلب برقم فاتورة رسمي: <strong>{request.officialInvoiceNumber}</strong>
              </span>
            </div>
            {request.invoicedByFullName && (
              <div className="text-emerald-700">
                بواسطة: {request.invoicedByFullName} في{' '}
                {new Date(request.invoicedAt || '').toLocaleDateString('ar-SA')}
              </div>
            )}
          </div>
        )}

        {/* Items List (Section 6: With Sold To, Created By, Time) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Card Header with All / My Items Toggle */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">الأصناف المسجلة في الطلب</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                عرض {displayedItems.length} من أصل {request.items?.length || 0} صنف
              </p>
            </div>

            {/* Toggle: الكل | طلباتي (Section 11) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setItemFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  itemFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                الكل ({request.items?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setItemFilter('my')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  itemFilter === 'my'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                طلباتي ({request.items?.filter((it) => it.createdByUserId === user?.id).length || 0})
              </button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">رقم القطعة</th>
                  <th className="py-3 px-3">اسم القطعة</th>
                  <th className="py-3 px-3">الماركة</th>
                  <th className="py-3 px-3 text-center">الكمية</th>
                  <th className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 font-bold">
                      <span>سعر الوحدة</span>
                      <SarSymbol size="1.25em" />
                    </span>
                  </th>
                  {canViewAmounts && (
                  <th className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 font-bold">
                      <span>الإجمالي</span>
                      <SarSymbol size="1.25em" />
                    </span>
                  </th>
                  )}
                  <th className="py-3 px-3">لمن تم البيع</th>
                  <th className="py-3 px-3">بواسطة</th>
                  <th className="py-3 px-3">وقت التسجيل</th>
                  {isUninvoiced && <th className="py-3 px-3 text-left">الإجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={isUninvoiced ? 11 : 10} className="py-8 text-center text-slate-400 font-medium text-xs">
                      {itemFilter === 'my' ? 'لم تقم بتسجيل أي أصناف في هذا الطلب بعد.' : 'لا توجد أصناف في هذا الطلب.'}
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((it, idx) => {
                    const timeStr = new Date(it.createdAt).toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const isOwner = it.createdByUserId === user?.id;
                    const isAdmin = user?.role === UserRole.COMPANY_ADMIN || user?.role === UserRole.SYSTEM_ADMIN;
                    const canModify = (isOwner || isAdmin) && isUninvoiced;

                    return (
                      <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-900" dir="ltr">
                          {it.partNumberSnapshot}
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 font-medium">{it.partNameSnapshot}</td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {it.brandSnapshot}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-900 font-mono">
                          {it.quantity}
                        </td>
                        <td className="py-3.5 px-3" dir="ltr">
                          <SarAmount amount={it.unitPrice} size="sm" />
                        </td>
                        {canViewAmounts && (
                        <td className="py-3.5 px-3" dir="ltr">
                          <SarAmount amount={it.totalPrice} size="sm" />
                        </td>
                        )}
                        <td className="py-3.5 px-3 font-bold text-slate-800">{it.soldTo || 'عميل نقدي'}</td>
                        <td className="py-3.5 px-3 font-medium text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <span>{it.createdByFullName || '—'}</span>
                            {isOwner && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">
                                أنا
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-400 font-mono" dir="ltr">
                          {timeStr}
                        </td>
                        {isUninvoiced && (
                          <td className="py-3.5 px-3 text-left">
                            {canModify ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(it)}
                                  className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="تعديل الصنف"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(it.id, it.partNumberSnapshot)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="حذف الصنف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs px-2 select-none" title="أضيف بواسطة موظف آخر">
                                —
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Items Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {displayedItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-medium">
                {itemFilter === 'my' ? 'لم تقم بتسجيل أي أصناف في هذا الطلب بعد.' : 'لا توجد أصناف في هذا الطلب.'}
              </div>
            ) : (
              displayedItems.map((it) => {
                const isOwner = it.createdByUserId === user?.id;
                const isAdmin = user?.role === UserRole.COMPANY_ADMIN || user?.role === UserRole.SYSTEM_ADMIN;
                const canModify = (isOwner || isAdmin) && isUninvoiced;

                return (
                  <div key={it.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-slate-900" dir="ltr">
                        {it.partNumberSnapshot}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                        {it.brandSnapshot}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">{it.partNameSnapshot}</div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1">
                        <span>الكمية: <strong>{it.quantity}</strong> ×</span>
                        <SarAmount amount={it.unitPrice} size="sm" />
                      </div>
                      {canViewAmounts && (
                      <div>
                        <SarAmount amount={it.totalPrice} size="md" />
                      </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center justify-between pt-1 bg-slate-50 p-2 rounded-lg">
                      <span>العميل: <strong className="text-slate-900">{it.soldTo || 'عميل نقدي'}</strong></span>
                      <span className="inline-flex items-center gap-1">
                        <span>بواسطة: {it.createdByFullName || '—'}</span>
                        {isOwner && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded font-bold">أنا</span>
                        )}
                      </span>
                    </div>
                    {isUninvoiced && canModify && (
                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-50">
                        <button
                          type="button"
                          onClick={() => openEditModal(it)}
                          className="px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(it.id, it.partNumberSnapshot)}
                          className="px-2.5 py-1 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg font-medium transition-colors"
                        >
                          حذف
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>


      {/* ================= DEDICATED A4 PRINT LAYOUT ================= */}
      {(() => {
        const printItems = request.items || [];
        const printTotalItems = printItems.length;
        const printTotalQuantity = printItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
        const printTotalAmount = printItems.reduce(
          (sum, it) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0),
          0
        );

        const formatPrintDate = (d: string | Date | undefined): string => {
          if (!d) return '-';
          const date = new Date(d);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        return (
          <div className="hidden print:block print:w-full print:bg-white text-slate-900 font-['Cairo'] text-right print-page-container" dir="rtl">
            {/* 1. Report Title */}
            <div className="text-center pt-1 pb-1">
              <h1 className="text-[19px] font-bold text-slate-900 tracking-normal m-0 p-0 font-['Cairo']">
                كشف المنتجات المباعة بغير فاتورة
              </h1>
            </div>
            <div className="border-b border-slate-300 my-2" />

            {/* 2. Request Information */}
            <div className="flex justify-between items-center text-xs text-slate-900 font-medium py-1 px-1">
              <div>
                <span className="font-bold">رقم الطلب: </span>
                <span className="font-mono font-bold" dir="ltr">{request.documentNumber}</span>
              </div>
              <div>
                <span className="font-bold">التاريخ: </span>
                <span className="font-mono">{formatPrintDate(request.businessDate)}</span>
              </div>
              <div>
                <span className="font-bold">الفرع: </span>
                <span>{request.branchName || 'الرئيسي'}</span>
              </div>
            </div>
            <div className="border-b border-slate-300 my-2" />

            {/* 3. Main Table */}
            <table className="w-full text-right text-xs border-collapse border border-slate-300 font-['Cairo'] mt-1">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold text-center">
                  <th className={`py-2 px-1.5 border-l border-slate-300 text-center ${canViewAmounts ? 'w-[5%]' : 'w-[5%]'}`}>م</th>
                  <th className={`py-2 px-1.5 border-l border-slate-300 text-center ${canViewAmounts ? 'w-[14%]' : 'w-[18%]'}`}>رقم القطعة</th>
                  <th className={`py-2 px-2 border-l border-slate-300 text-right ${canViewAmounts ? 'w-[20%]' : 'w-[29%]'}`}>اسم القطعة</th>
                  <th className={`py-2 px-1.5 border-l border-slate-300 text-center ${canViewAmounts ? 'w-[9%]' : 'w-[12%]'}`}>الماركة</th>
                  <th className={`py-2 px-1.5 border-l border-slate-300 text-center ${canViewAmounts ? 'w-[7%]' : 'w-[10%]'}`}>الكمية</th>
                  {canViewAmounts && (
                    <>
                      <th className="py-2 px-1.5 border-l border-slate-300 w-[10%] text-center">
                        <span className="inline-flex items-center justify-center gap-1">
                          <span>سعر الوحدة</span>
                          <SarSymbol size="0.85em" className="text-slate-800" />
                        </span>
                      </th>
                      <th className="py-2 px-1.5 border-l border-slate-300 w-[11%] text-center">
                        <span className="inline-flex items-center justify-center gap-1">
                          <span>الإجمالي</span>
                          <SarSymbol size="0.85em" className="text-slate-800" />
                        </span>
                      </th>
                    </>
                  )}
                  <th className={`py-2 px-2 border-l border-slate-300 text-right ${canViewAmounts ? 'w-[12%]' : 'w-[13%]'}`}>لمن تم البيع</th>
                  <th className={`py-2 px-2 text-right ${canViewAmounts ? 'w-[12%]' : 'w-[13%]'}`}>بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {printItems.map((it, idx) => {
                  const qty = Number(it.quantity || 0);
                  const price = Number(it.unitPrice || 0);
                  const lineTotal = qty * price;

                  return (
                    <tr key={it.id || idx} className="border-b border-slate-300 bg-white text-slate-900">
                      <td className="py-1.5 px-1.5 border-l border-slate-300 text-center font-mono text-slate-700">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-1.5 border-l border-slate-300 text-center font-mono font-bold" dir="ltr">
                        {it.partNumberSnapshot}
                      </td>
                      <td className="py-1.5 px-2 border-l border-slate-300 text-right font-medium break-words">
                        {it.partNameSnapshot}
                      </td>
                      <td className="py-1.5 px-1.5 border-l border-slate-300 text-center font-bold">
                        {it.brandSnapshot}
                      </td>
                      <td className="py-1.5 px-1.5 border-l border-slate-300 text-center font-mono font-bold">
                        {qty}
                      </td>
                      {canViewAmounts && (
                        <>
                          <td className="py-1.5 px-1.5 border-l border-slate-300 text-center font-mono">
                            <span className="inline-flex items-center justify-center gap-1">
                              <span>{price.toFixed(2)}</span>
                              <SarSymbol size="0.85em" className="shrink-0 text-slate-700" />
                            </span>
                          </td>
                          <td className="py-1.5 px-1.5 border-l border-slate-300 text-center font-mono font-bold">
                            <span className="inline-flex items-center justify-center gap-1">
                              <span>{lineTotal.toFixed(2)}</span>
                              <SarSymbol size="0.85em" className="shrink-0 text-slate-900" />
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-1.5 px-2 border-l border-slate-300 text-right break-words">
                        {it.soldTo || 'عميل نقدي'}
                      </td>
                      <td className="py-1.5 px-2 text-right break-words text-slate-800">
                        {it.createdByFullName || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-400 text-xs font-bold text-slate-900">
                  <td colSpan={canViewAmounts ? 9 : 7} className="p-2.5">
                    <div className="flex justify-between items-center px-3">
                      <div>
                        <span>إجمالي الأصناف: </span>
                        <span className="font-mono">{printTotalItems}</span>
                      </div>
                      <div>
                        <span>إجمالي الكمية: </span>
                        <span className="font-mono">{printTotalQuantity}</span>
                      </div>
                      {canViewAmounts && (
                        <div className="flex items-center gap-1">
                          <span>إجمالي القيمة: </span>
                          <span className="inline-flex items-center gap-1 font-mono font-bold">
                            <span>{printTotalAmount.toFixed(2)}</span>
                            <SarSymbol size="0.9em" className="shrink-0 text-slate-900" />
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {/* Mark Invoiced Modal */}
      <RasdModal
        isOpen={isInvoicingModalOpen}
        onClose={() => setIsInvoicingModalOpen(false)}
        title="تحويل طلب المبيعات إلى مفوتر"
        subtitle="بعد تأكيد الفوترة برقم الفاتورة الرسمية، سيصبح هذا الطلب للقراءة فقط"
        maxWidth="md"
      >
        <form onSubmit={handleMarkInvoiced} className="space-y-4 text-right">
          <RasdInput
            label="رقم الفاتورة الرسمية *"
            ltr
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="INV-XXXXX"
            autoFocus
            required
          />

          <RasdInput
            label="تاريخ الفاتورة"
            type="date"
            ltr
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />

          <div className="pt-2 flex gap-3">
            <RasdButton
              type="submit"
              variant="emerald"
              size="md"
              loading={invoicingLoading}
              className="flex-1"
            >
              تأكيد الفوترة
            </RasdButton>
            <RasdButton
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsInvoicingModalOpen(false)}
            >
              إلغاء
            </RasdButton>
          </div>
        </form>
      </RasdModal>

      {/* Edit Item Modal */}
      {editingItem && (
        <RasdModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title={`تعديل الصنف (${editingItem.partNumberSnapshot})`}
          maxWidth="md"
        >
          <form onSubmit={handleUpdateItem} className="space-y-4 text-right">
            <div className="grid grid-cols-2 gap-3">
              <RasdInput
                label="الكمية *"
                type="number"
                ltr
                step="any"
                min="0.1"
                value={editQty}
                onChange={(e) => setEditQty(parseFloat(e.target.value))}
                required
              />
              <RasdInput
                label={
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <span>سعر الوحدة</span>
                    <span className="text-slate-500">
                      (<SarSymbol size="1.15em" />)
                    </span>
                    <span>*</span>
                  </span>
                }
                type="number"
                ltr
                step="any"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(parseFloat(e.target.value))}
                required
              />
            </div>

            <RasdInput
              label="لمن تم البيع *"
              value={editSoldTo}
              onChange={(e) => setEditSoldTo(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">ملاحظة</label>
              <textarea
                rows={2}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <RasdButton
                type="submit"
                variant="primary"
                size="md"
                loading={editLoading}
                className="flex-1"
              >
                حفظ التعديلات
              </RasdButton>
              <RasdButton
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setEditingItem(null)}
              >
                إلغاء
              </RasdButton>
            </div>
          </form>
        </RasdModal>
      )}
    </AppShell>
  );
}
