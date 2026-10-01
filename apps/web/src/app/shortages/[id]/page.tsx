'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import { ShortageRequest, ShortageRequestStatus, UserRole } from '@/types';
import { RasdBadge } from '@/components/ui/RasdBadge';
import { RasdButton } from '@/components/ui/RasdButton';
import { RasdModal } from '@/components/ui/RasdModal';
import { RasdLoadingState } from '@/components/ui/RasdLoadingState';
import { exportDetailsToExcel } from '@/lib/excel-export';
import {
  ArrowRight,
  History,
  Lock,
  Printer,
  FileSpreadsheet,
  Edit2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { RasdInput } from '@/components/ui/RasdInput';
import { quickPrintShortageOrder } from '@/lib/quick-print';

export default function ShortageDetailsPage() {
  const { id } = useParams() as { id: string };
  const { user, hasPermission } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [request, setRequest] = useState<ShortageRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [closingLoading, setClosingLoading] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState<any | null>(null);
  const [itemFilter, setItemFilter] = useState<'all' | 'my'>('all');

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editNote, setEditNote] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const data = await api.get<ShortageRequest>(`/shortages/${id}`);
      setRequest(data);
    } catch (e: any) {
      showError(e.message || 'تعذر تحميل تفاصيل طلب النواقص');
      router.push('/shortages');
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
      quickPrintShortageOrder(request);
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

  const handleCloseRequest = async () => {
    if (!confirm('هل أنت متأكد من إغلاق طلب النواقص؟ بعد الإغلاق سيتم إنشاء طلب جديد للعمليات القادمة.')) {
      return;
    }

    setClosingLoading(true);
    try {
      await api.post(`/shortages/${id}/close`);
      showSuccess('تم إغلاق طلب النواقص بنجاح');
      fetchDetails();
    } catch (e: any) {
      showError(e.message || 'تعذر إغلاق طلب النواقص');
    } finally {
      setClosingLoading(false);
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditQty(Number(item.quantity));
    setEditNote(item.note || '');
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (editQty <= 0) {
      showError('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    setEditLoading(true);
    try {
      await api.patch(`/shortages/items/${editingItem.id}`, {
        quantity: editQty,
        note: editNote,
      });
      showSuccess('تم تحديث بيانات الصنف بنجاح');
      setEditingItem(null);
      fetchDetails();
    } catch (e: any) {
      showError(e.message || 'تعذر تحديث الصنف');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string, partNumber: string) => {
    if (!confirm(`هل أنت متأكد من حذف الصنف (${partNumber}) من طلب النواقص؟`)) return;

    try {
      await api.delete(`/shortages/items/${itemId}`);
      showSuccess('تم حذف الصنف بنجاح');
      fetchDetails();
    } catch (e: any) {
      showError(e.message || 'تعذر حذف الصنف');
    }
  };


  // Export Request Details to Excel
  const handleExportExcel = () => {
    if (!request) return;
    const metadata = [
      { label: 'رقم طلب النواقص', value: request.documentNumber },
      { label: 'تاريخ الطلب', value: new Date(request.businessDate).toLocaleDateString('ar-SA') },
      { label: 'الفرع', value: request.branchName || '-' },
      { label: 'الحالة', value: request.status === 'CLOSED' ? 'مغلق' : 'مفتوح' },
      { label: 'أغلق بواسطة', value: request.closedByFullName || '-' },
    ];

    const headers = [
      '#',
      'رقم القطعة (Part Number)',
      'اسم القطعة',
      'الماركة',
      'الكمية المطلوبة',
      'الملاحظات',
      'سجل بواسطة',
    ];

    const items = (request.items || []).map((it, idx) => [
      idx + 1,
      it.partNumberSnapshot,
      it.partNameSnapshot,
      it.brandSnapshot,
      it.quantity,
      it.note || '',
      it.createdByFullName || '',
    ]);

    const summary = [
      { label: 'إجمالي الأصناف الناقصة', value: request.totalItemsCount },
      { label: 'إجمالي الكمية المطلوبة', value: request.totalQuantity },
    ];

    exportDetailsToExcel(
      `طلب_نواقص_${request.documentNumber}`,
      'تفاصيل طلب قطع ناقصة - نظام رَصْد',
      metadata,
      headers,
      items,
      summary
    );
  };

  if (loading) {
    return (
      <AppShell>
        <RasdLoadingState message="جاري استرجاع تفاصيل طلب النواقص..." />
      </AppShell>
    );
  }

  if (!request) return null;

  const isOpen = request.status === ShortageRequestStatus.OPEN;
  const canClose = hasPermission('shortages.close');

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
              href="/shortages"
              className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
              title="العودة لسجل النواقص"
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

            {/* Close Request Action */}
            {isOpen && canClose && (
              <RasdButton
                variant="outline"
                size="md"
                loading={closingLoading}
                icon={<Lock className="w-4 h-4" />}
                onClick={handleCloseRequest}
              >
                إغلاق الطلب
              </RasdButton>
            )}
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500">عدد الأصناف الناقصة</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
              {request.totalItemsCount}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500">إجمالي الكمية المطلوبة</span>
            <div className="text-xl sm:text-2xl font-black text-rose-600 mt-1 font-mono">
              {request.totalQuantity} قطعة
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-xs font-bold text-slate-500">حالة الطلب</span>
            <div className="mt-1 flex items-center gap-2">
              <RasdBadge status={request.status} />
              {request.closedByFullName && (
                <span className="text-xs text-slate-500">بواسطة: {request.closedByFullName}</span>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Card Header with All / My Items Toggle */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">أصناف النواقص</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                عرض {displayedItems.length} من أصل {request.items?.length || 0} صنف
              </p>
            </div>

            {/* Toggle: الكل | طلباتي (Section 15) */}
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
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">رقم القطعة</th>
                  <th className="py-3.5 px-4">اسم القطعة</th>
                  <th className="py-3.5 px-4">الماركة</th>
                  <th className="py-3.5 px-4 text-center">الكمية المطلوبة</th>
                  <th className="py-3.5 px-4">الملاحظات</th>
                  <th className="py-3.5 px-4">سجل الزيادة</th>
                  <th className="py-3.5 px-4">سُجل بواسطة</th>
                  {isOpen && <th className="py-3.5 px-4 text-left">الإجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={isOpen ? 9 : 8} className="py-8 text-center text-slate-400 font-medium text-xs">
                      {itemFilter === 'my' ? 'لم تقم بتسجيل أي أصناف نواقص في هذا الطلب بعد.' : 'لا توجد أصناف في هذا الطلب.'}
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((it, idx) => {
                    const isOwner = it.createdByUserId === user?.id;
                    const canModify = (isOwner || canClose) && isOpen;

                    return (
                      <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900" dir="ltr">
                          {it.partNumberSnapshot}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{it.partNameSnapshot}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {it.brandSnapshot}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-base text-rose-600">
                          {it.quantity}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {it.note || '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {it.events && it.events.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedItemHistory(it)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>{it.events.length} عمليات دمج</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">تسجيل أولي</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <span>{it.createdByFullName}</span>
                            {isOwner && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">
                                أنا
                              </span>
                            )}
                          </span>
                        </td>
                        {isOpen && (
                          <td className="py-3.5 px-4 text-left">
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

          {/* Mobile Cards View */}
          <div className="md:hidden divide-y divide-slate-100">
            {displayedItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-medium">
                {itemFilter === 'my' ? 'لم تقم بتسجيل أي أصناف نواقص في هذا الطلب بعد.' : 'لا توجد أصناف في هذا الطلب.'}
              </div>
            ) : (
              displayedItems.map((it) => {
                const isOwner = it.createdByUserId === user?.id;
                const canModify = (isOwner || canClose) && isOpen;

                return (
                  <div key={it.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-slate-900" dir="ltr">
                        {it.partNumberSnapshot}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                        {it.brandSnapshot}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">{it.partNameSnapshot}</div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span>
                        الكمية المطلوبة: <strong className="text-rose-600 text-sm font-mono">{it.quantity}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span>بواسطة: {it.createdByFullName}</span>
                        {isOwner && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded font-bold">أنا</span>
                        )}
                      </span>
                    </div>
                    {it.note && <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">{it.note}</div>}
                    {it.events && it.events.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedItemHistory(it)}
                        className="w-full text-center py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg font-bold flex items-center justify-center gap-1.5"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>عرض سجل الزيادات ({it.events.length} حركات)</span>
                      </button>
                    )}
                    {isOpen && canModify && (
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

        const formatPrintDate = (d: string | Date | undefined): string => {
          if (!d) return '-';
          const date = new Date(d);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        return (
          <div className="hidden print:block print:w-full print:bg-white text-slate-900 font-['Cairo'] text-right bg-white p-0 m-0 print-page-container" dir="rtl">
            {/* 1. Report Title */}
            <div className="text-center pt-1 pb-1 bg-white">
              <h1 className="text-[19px] font-bold text-slate-900 tracking-normal m-0 p-0 font-['Cairo']">
                كشف طلب قطع ناقصة
              </h1>
            </div>
            <div className="border-b border-slate-300 my-2" />

            {/* 2. Request Information */}
            <div className="flex justify-between items-center text-xs text-slate-900 font-medium py-1 px-1 bg-white">
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
            <table className="w-full text-right text-xs border-collapse border border-slate-300 font-['Cairo'] mt-1 print-table bg-white">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold text-center">
                  <th className="py-2 px-1.5 border-l border-slate-300 w-[5%] text-center">م</th>
                  <th className="py-2 px-2 border-l border-slate-300 w-[18%] text-center">رقم القطعة</th>
                  <th className="py-2 px-2 border-l border-slate-300 w-[27%] text-right">اسم القطعة</th>
                  <th className="py-2 px-2 border-l border-slate-300 w-[12%] text-center">الماركة</th>
                  <th className="py-2 px-2 border-l border-slate-300 w-[12%] text-center">الكمية المطلوبة</th>
                  <th className="py-2 px-2 border-l border-slate-300 w-[13%] text-right">الملاحظات</th>
                  <th className="py-2 px-2 w-[13%] text-right">بواسطة</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {printItems.map((it, idx) => {
                  const qty = Number(it.quantity || 0);

                  return (
                    <tr key={it.id || idx} className="border-b border-slate-300 bg-white text-slate-900">
                      <td className="py-1.5 px-1.5 border-l border-slate-300 text-center font-mono text-slate-700 bg-white">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2 border-l border-slate-300 text-center font-mono font-bold bg-white" dir="ltr">
                        {it.partNumberSnapshot}
                      </td>
                      <td className="py-1.5 px-2 border-l border-slate-300 text-right font-medium break-words bg-white">
                        {it.partNameSnapshot}
                      </td>
                      <td className="py-1.5 px-2 border-l border-slate-300 text-center font-bold bg-white">
                        {it.brandSnapshot}
                      </td>
                      <td className="py-1.5 px-2 border-l border-slate-300 text-center font-mono font-bold bg-white">
                        {qty}
                      </td>
                      <td className="py-1.5 px-2 border-l border-slate-300 text-right break-words text-slate-600 bg-white">
                        {it.note || '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right break-words text-slate-800 bg-white">
                        {it.createdByFullName || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-400 text-xs font-bold text-slate-900">
                  <td colSpan={7} className="p-2.5 bg-slate-50">
                    <div className="flex justify-between items-center px-4">
                      <div>
                        <span>إجمالي الأصناف: </span>
                        <span className="font-mono">{printTotalItems}</span>
                      </div>
                      <div>
                        <span>إجمالي الكمية المطلوبة: </span>
                        <span className="font-mono">{printTotalQuantity}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {/* Quantity History Modal */}
      {selectedItemHistory && (
        <RasdModal
          isOpen={!!selectedItemHistory}
          onClose={() => setSelectedItemHistory(null)}
          title={`سجل تعديل كمية الصنف (${selectedItemHistory.partNumberSnapshot})`}
          subtitle="تفاصيل تتبع الحركات والمسؤولين عن إضافة الكميات"
          maxWidth="md"
        >
          <div className="space-y-3">
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {selectedItemHistory.events?.map((ev: any, idx: number) => {
                const dateStr = new Date(ev.createdAt).toLocaleString('ar-SA');
                return (
                  <div key={ev.id} className="p-3.5 text-xs flex items-center justify-between bg-white">
                    <div>
                      <div className="font-bold text-slate-800">{ev.userFullName}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">{dateStr}</div>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-slate-400">{ev.previousQuantity}</span>
                      <span className="mx-1 text-emerald-600 font-bold">+{ev.addedQuantity}</span>
                      <span className="text-slate-900 font-black text-sm">➔ {ev.newQuantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <RasdButton variant="secondary" size="md" onClick={() => setSelectedItemHistory(null)}>
                إغلاق
              </RasdButton>
            </div>
          </div>
        </RasdModal>
      )}

      {/* Edit Shortage Item Modal */}
      {editingItem && (
        <RasdModal
          isOpen={true}
          onClose={() => setEditingItem(null)}
          title={`تعديل كمية الصنف: ${editingItem.partNumberSnapshot}`}
          subtitle="تعديل الكمية المطلوبة والملاحظات"
          maxWidth="sm"
        >
          <form onSubmit={handleUpdateItem} className="space-y-4 text-right">
            <RasdInput
              label="الكمية المطلوبة *"
              type="number"
              min="1"
              value={editQty}
              onChange={(e) => setEditQty(Number(e.target.value))}
              required
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">ملاحظات إضافية</label>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={2}
                placeholder="ملاحظات حول القطعة المطلوبة..."
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="pt-2 flex gap-3">
              <RasdButton type="submit" variant="primary" size="md" loading={editLoading} className="flex-1">
                تحديث الكمية
              </RasdButton>
              <RasdButton type="button" variant="secondary" size="md" onClick={() => setEditingItem(null)}>
                إلغاء
              </RasdButton>
            </div>
          </form>
        </RasdModal>
      )}
    </AppShell>
  );
}

