'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ShortageRequest, ShortageRequestStatus, UserRole } from '@/types';
import { RasdBadge } from '@/components/ui/RasdBadge';
import { RasdButton } from '@/components/ui/RasdButton';
import { RasdLoadingState } from '@/components/ui/RasdLoadingState';
import { RasdEmptyState } from '@/components/ui/RasdEmptyState';
import { RegisterShortageModal } from '@/components/ui/RegisterShortageModal';
import { RasdPagination } from '@/components/ui/RasdPagination';
import { exportTableToExcel } from '@/lib/excel-export';
import { DatePreset, getDateRangeFromPreset } from '@/lib/date-filters';
import {
  Search,
  Plus,
  Eye,
  FileSpreadsheet,
  RotateCcw,
  Clock,
  AlertTriangle,
  Printer,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/lib/toast-context';
import { quickPrintShortageOrder } from '@/lib/quick-print';

export default function ShortagesPage() {
  const router = useRouter();
  const { user, activeBranchId } = useAuth();

  useEffect(() => {
    if (user && user.role === UserRole.SYSTEM_ADMIN) {
      router.push('/admin/companies');
    }
  }, [user, router]);

  const [requests, setRequests] = useState<ShortageRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters - Default to Today
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const initialRange = getDateRangeFromPreset('TODAY');
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const { showError } = useToast();

  const hasNoBranch =
    user?.role !== UserRole.SYSTEM_ADMIN &&
    !activeBranchId &&
    (!user?.branches || user.branches.length === 0) &&
    (!user?.branchIds || user.branchIds.length === 0);

  const handleOpenShortageModal = () => {
    if (hasNoBranch) {
      showError('أنت غير مرتبط بأي فرع حالياً، لا يمكنك تسجيل النواقص. يرجى مراجعة إدارة الشركة لربط حسابك بفرع.');
      return;
    }
    setIsModalOpen(true);
  };

  const handleQuickPrint = async (shortageId: string) => {
    setPrintingId(shortageId);
    try {
      await quickPrintShortageOrder(shortageId);
    } catch (err: any) {
      showError(err.message || 'تعذر تشغيل أمر الطباعة السريعة');
    } finally {
      setPrintingId(null);
    }
  };

  // Handle Preset Change
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
    if (preset !== 'CUSTOM') {
      const range = getDateRangeFromPreset(preset);
      setDateFrom(range.dateFrom);
      setDateTo(range.dateTo);
    }
  };

  const resetFilters = () => {
    setDatePreset('TODAY');
    const range = getDateRangeFromPreset('TODAY');
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setStatusFilter('');
    setSearch('');
    setPage(1);
  };

  const fetchShortages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (activeBranchId) params.set('branchId', activeBranchId);
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<{
        items: ShortageRequest[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/shortages?${params.toString()}`);

      setRequests(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      console.error('Failed to load shortages', e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, activeBranchId, statusFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    fetchShortages();
  }, [fetchShortages]);

  useEffect(() => {
    const handleRefresh = () => fetchShortages();
    window.addEventListener('rasd:refresh', handleRefresh);
    return () => window.removeEventListener('rasd:refresh', handleRefresh);
  }, [fetchShortages]);

  // Excel Export Handler (Filtered Results)
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '1000');
      if (activeBranchId) params.set('branchId', activeBranchId);
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<{ items: ShortageRequest[] }>(`/shortages?${params.toString()}`);
      const exportList = res.items || requests;

      const headers = [
        'رقم الطلب',
        'التاريخ',
        'الفرع',
        'عدد الأصناف الناقصة',
        'إجمالي الكمية المطلوبة',
        'الحالة',
      ];

      const rows = exportList.map((r: any) => [
        r.documentNumber,
        new Date(r.businessDate).toLocaleDateString('ar-SA'),
        r.branchName || '',
        r.totalItemsCount || 0,
        r.totalQuantity || 0,
        r.status === 'CLOSED' ? 'مغلق' : 'مفتوح',
      ]);

      const dateTag = datePreset === 'TODAY' ? 'اليوم' : `${dateFrom}_إلى_${dateTo}`;
      exportTableToExcel(`تقرير_النواقص_${dateTag}`, headers, rows);
    } catch (e) {
      console.error('Failed to export shortages Excel', e);
      alert('حدث خطأ أثناء تنزيل ملف الإكسل');
    } finally {
      setExporting(false);
    }
  };


  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                سجل القطع الناقصة
              </h1>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {datePreset === 'TODAY' ? 'طلبات اليوم' : 'تصفية محددة'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              توثيق الأصناف والقطع المطلوبة من العملاء غير المتوفرة حالياً في المستودعات
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              disabled={exporting || requests.length === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-colors disabled:opacity-40"
              title="تنزيل النتائج المفلترة كملف Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{exporting ? 'جاري التصدير...' : 'تنزيل Excel'}</span>
            </button>

            <RasdButton
              variant="danger"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleOpenShortageModal}
            >
              تسجيل نقص
            </RasdButton>
          </div>
        </div>

        {/* Quick Date Filters Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-bold ml-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>الفترة:</span>
            </span>

            {[
              { id: 'TODAY', label: 'اليوم' },
              { id: 'YESTERDAY', label: 'أمس' },
              { id: 'LAST_7_DAYS', label: 'آخر 7 أيام' },
              { id: 'THIS_WEEK', label: 'هذا الأسبوع' },
              { id: 'THIS_MONTH', label: 'هذا الشهر' },
              { id: 'CUSTOM', label: 'مخصص' },
            ].map((p) => {
              const active = datePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id as DatePreset)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}

            {(search || statusFilter || datePreset !== 'TODAY') && (
              <button
                onClick={resetFilters}
                className="mr-auto inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-rose-600 font-medium transition-colors"
                title="إعادة ضبط الفلاتر"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>

          {/* Search and Custom Date inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="بحث برقم الطلب، القطعة..."
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 pl-8 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
            >
              <option value="">جميع الحالات</option>
              <option value={ShortageRequestStatus.OPEN}>مفتوح</option>
              <option value={ShortageRequestStatus.CLOSED}>مغلق</option>
            </select>

            {/* Custom Date From */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">من:</span>
              <input
                type="date"
                value={dateFrom}
                disabled={datePreset !== 'CUSTOM'}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className={`w-full text-xs rounded-xl border border-slate-200 px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono ${
                  datePreset !== 'CUSTOM' ? 'bg-slate-50 opacity-70' : 'bg-white'
                }`}
              />
            </div>

            {/* Custom Date To */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">إلى:</span>
              <input
                type="date"
                value={dateTo}
                disabled={datePreset !== 'CUSTOM'}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className={`w-full text-xs rounded-xl border border-slate-200 px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono ${
                  datePreset !== 'CUSTOM' ? 'bg-slate-50 opacity-70' : 'bg-white'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Content View */}
        {loading ? (
          <RasdLoadingState message="جاري استرجاع طلبات النواقص..." />
        ) : requests.length === 0 ? (
          <RasdEmptyState
            title="لا توجد طلبات نواقص في هذه الفترة"
            description={
              datePreset === 'TODAY'
                ? 'لم يتم تسجيل أي طلبات نواقص اليوم. اضغط على تسجيل نقص لبدء أول طلب'
                : 'جرّب تغيير نطاق التاريخ أو البحث لعرض طلبات أخرى'
            }
            action={
              <RasdButton variant="danger" size="sm" onClick={() => setIsModalOpen(true)}>
                تسجيل نقص جديد
              </RasdButton>
            }
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="py-3.5 px-4">رقم الطلب</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4">الفرع</th>
                    <th className="py-3.5 px-4 text-center">عدد الأصناف</th>
                    <th className="py-3.5 px-4 text-center">إجمالي الكمية المطلوبة</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => {
                    const dateStr = new Date(r.businessDate).toLocaleDateString('ar-SA');
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900" dir="ltr">
                          {r.documentNumber}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">{dateStr}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">{r.branchName}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900 font-mono">
                          {r.totalItemsCount}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900 font-mono">
                          {r.totalQuantity}
                        </td>
                        <td className="py-3.5 px-4">
                          <RasdBadge status={r.status} />
                        </td>
                        <td className="py-3.5 px-4 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickPrint(r.id)}
                              disabled={printingId === r.id}
                              className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                              title="طباعة سريعة"
                            >
                              {printingId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                              ) : (
                                <Printer className="w-3.5 h-3.5 text-slate-500" />
                              )}
                              <span>{printingId === r.id ? 'جاري التحضير...' : 'طباعة'}</span>
                            </button>
                            <Link
                              href={`/shortages/${r.id}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>عرض</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {requests.map((r) => {
                const dateStr = new Date(r.businessDate).toLocaleDateString('ar-SA');
                return (
                  <div
                    key={r.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-slate-900" dir="ltr">
                        {r.documentNumber}
                      </span>
                      <RasdBadge status={r.status} />
                    </div>

                    <div className="text-xs text-slate-500 flex items-center justify-between">
                      <span>{dateStr}</span>
                      <span>{r.branchName}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                      <span>
                        الأصناف: <strong>{r.totalItemsCount}</strong>
                      </span>
                      <span>
                        الكمية الإجمالية: <strong>{r.totalQuantity} قطعة</strong>
                      </span>
                    </div>

                    <div className="pt-2 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleQuickPrint(r.id)}
                        disabled={printingId === r.id}
                        className="flex-1 text-center py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {printingId === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" />
                        ) : (
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                        )}
                        <span>{printingId === r.id ? 'جاري التحضير...' : 'طباعة سريعة'}</span>
                      </button>
                      <Link
                        href={`/shortages/${r.id}`}
                        className="flex-1 text-center py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض التفاصيل</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Standardized Responsive Pagination */}
            <RasdPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={(newPage) => setPage(newPage)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              pageSizeOptions={[20, 50, 100]}
            />
          </>
        )}
      </div>

      <RegisterShortageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchShortages}
      />
    </AppShell>
  );
}
