'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import { DashboardSummary, SalesRequestStatus, ShortageRequestStatus } from '@/types';
import { RasdBadge } from '@/components/ui/RasdBadge';
import { RasdLoadingState } from '@/components/ui/RasdLoadingState';
import { RegisterSaleModal } from '@/components/ui/RegisterSaleModal';
import { RegisterShortageModal } from '@/components/ui/RegisterShortageModal';
import { SarSymbol, SarAmount } from '@/components/ui/SarSymbol';
import {
  ShoppingCart,
  AlertTriangle,
  Plus,
  ArrowLeft,
  Clock,
  ChevronLeft,
  Layers,
  CircleDollarSign,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types';

export default function HomePage() {
  const { user, activeBranchId, hasPermission } = useAuth();
  const { showError } = useToast();
  const router = useRouter();
  const canViewAmounts = hasPermission('sales.amount.view');

  const hasNoBranch =
    user?.role !== UserRole.SYSTEM_ADMIN &&
    !activeBranchId &&
    (!user?.branches || user.branches.length === 0) &&
    (!user?.branchIds || user.branchIds.length === 0);

  useEffect(() => {
    if (user && user.role === UserRole.SYSTEM_ADMIN) {
      router.push('/admin/companies');
    }
  }, [user, router]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [shortageModalOpen, setShortageModalOpen] = useState(false);

  const handleOpenSale = () => {
    if (hasNoBranch) {
      showError('أنت غير مرتبط بأي فرع حالياً، لا يمكنك تسجيل المبيعات. يرجى مراجعة إدارة الشركة لربط حسابك بفرع.');
      return;
    }
    setSaleModalOpen(true);
  };

  const handleOpenShortage = () => {
    if (hasNoBranch) {
      showError('أنت غير مرتبط بأي فرع حالياً، لا يمكنك تسجيل النواقص. يرجى مراجعة إدارة الشركة لربط حسابك بفرع.');
      return;
    }
    setShortageModalOpen(true);
  };

  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.get<DashboardSummary>(
        `/dashboard/summary${activeBranchId ? `?branchId=${activeBranchId}` : ''}`,
      );
      setSummary(data);
    } catch (e) {
      console.error('Failed to load dashboard summary', e);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (user) {
      fetchSummary();
    }
  }, [user, fetchSummary]);

  // Listen for custom event dispatched after saving in AppShell or modals
  useEffect(() => {
    const handleRefresh = () => fetchSummary();
    window.addEventListener('rasd:refresh', handleRefresh);
    return () => window.removeEventListener('rasd:refresh', handleRefresh);
  }, [fetchSummary]);

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* Unassigned Branch Warning Banner */}
        {hasNoBranch && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">حسابك غير مرتبط بأي فرع حالياً</p>
              <p className="text-amber-700 mt-0.5">
                لتتمكن من تسجيل المبيعات والنواقص ومتابعة حركة القطع، يرجى مراجعة مشرف الشركة لربط حسابك بأحد الفروع.
              </p>
            </div>
          </div>
        )}

        {/* ================= SECTION 12: THE TWO PRIMARY ACTION BUTTONS ================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Action 1: تسجيل بيع */}
          <button
            onClick={handleOpenSale}
            className="group relative overflow-hidden rounded-2xl bg-slate-900 p-6 sm:p-7 text-right text-white shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/20 hover:bg-slate-800 transition-all duration-200 active:scale-[0.99] border border-slate-800"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-emerald-400 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/20 transition-all">
                <Plus className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-5">
              <div className="text-xl sm:text-2xl font-black tracking-tight">تسجيل بيع</div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                قطعة خرجت من الشركة بدون فاتورة رسمية حتى الآن
              </p>
            </div>
          </button>

          {/* Action 2: تسجيل نقص */}
          <button
            onClick={handleOpenShortage}
            className="group relative overflow-hidden rounded-2xl bg-rose-600 p-6 sm:p-7 text-right text-white shadow-xl shadow-rose-900/10 hover:shadow-2xl hover:shadow-rose-900/20 hover:bg-rose-700 transition-all duration-200 active:scale-[0.99] border border-rose-500"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/20 transition-all">
                <Plus className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-5">
              <div className="text-xl sm:text-2xl font-black tracking-tight">تسجيل نقص</div>
              <p className="text-xs sm:text-sm text-rose-100 mt-1 font-medium">
                قطعة طلبها العميل ولكنها غير متوفرة في المستودع
              </p>
            </div>
          </button>
        </section>

        {loading ? (
          <RasdLoadingState message="جاري استرجاع مؤشرات رصد..." />
        ) : (
          <>
            {/* ================= SECTION 13: USEFUL OPERATIONAL METRICS ================= */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Uninvoiced Sales Count */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-500">غير المفوتر</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900">
                    {summary?.uninvoicedSalesCount || 0}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">طلبات</span>
                </div>
              </div>

              {/* Uninvoiced Value — hidden if without sales.amount.view */}
              {canViewAmounts && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-500">قيمة غير المفوتر</span>
                <div className="mt-2 flex items-baseline">
                  <SarAmount
                    amount={summary?.uninvoicedSalesTotalAmount || 0}
                    size="lg"
                    symbolSize="1.15em"
                    symbolClassName="text-slate-900"
                    decimals={0}
                  />
                </div>
              </div>
              )}

              {/* Open Shortages Count */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-500">النواقص المفتوحة</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-rose-600">
                    {summary?.openShortagesCount || 0}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">طلبات</span>
                </div>
              </div>

              {/* Total Shortages Quantity */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي كمية النواقص</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    {summary?.openShortagesTotalQuantity || 0}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">قطعة</span>
                </div>
              </div>
            </section>

            {/* ================= SECTION 14: CURRENT ACTIVE REQUEST INDICATORS ================= */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active Sale Request */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      البيع الحالي
                    </span>
                    <RasdBadge status={SalesRequestStatus.UNINVOICED} />
                  </div>

                  {summary?.currentActiveSale ? (
                    <div>
                      <div className="font-mono text-xl font-bold text-slate-900 mb-2" dir="ltr">
                        {summary.currentActiveSale.documentNumber}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600 font-medium">
                        <div>
                          <span className="font-bold text-slate-900">{summary.currentActiveSale.totalItemsCount}</span> صنف
                        </div>
                        <div>•</div>
                        <div>
                          <span className="font-bold text-slate-900">{summary.currentActiveSale.totalQuantity}</span> قطعة
                        </div>
                        <div>•</div>
                        {canViewAmounts && (
                        <div dir="ltr">
                          <SarAmount amount={summary.currentActiveSale.totalAmount} size="sm" />
                        </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-3">
                      لا يوجد طلب مبيعات نشط حالياً (سيتم إنشاؤه تلقائياً عند أول تسجيل بيع)
                    </p>
                  )}
                </div>

                {summary?.currentActiveSale && (
                  <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                    <Link
                      href={`/sales/${summary.currentActiveSale.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      <span>عرض تفاصيل الطلب</span>
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Active Shortage Request */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-rose-500 uppercase tracking-wider">
                      النواقص الحالية
                    </span>
                    <RasdBadge status={ShortageRequestStatus.OPEN} />
                  </div>

                  {summary?.currentActiveShortage ? (
                    <div>
                      <div className="font-mono text-xl font-bold text-slate-900 mb-2" dir="ltr">
                        {summary.currentActiveShortage.documentNumber}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600 font-medium">
                        <div>
                          <span className="font-bold text-slate-900">
                            {summary.currentActiveShortage.totalItemsCount}
                          </span>{' '}
                          أصناف
                        </div>
                        <div>•</div>
                        <div>
                          <span className="font-bold text-slate-900">
                            {summary.currentActiveShortage.totalQuantity}
                          </span>{' '}
                          قطعة مطلوبة
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-3">
                      لا يوجد طلب نواقص مفتوح حالياً (سيتم إنشاؤه تلقائياً عند أول تسجيل نقص)
                    </p>
                  )}
                </div>

                {summary?.currentActiveShortage && (
                  <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                    <Link
                      href={`/shortages/${summary.currentActiveShortage.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors"
                    >
                      <span>عرض تفاصيل النواقص</span>
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* ================= SECTION 15: TODAY ACTIVITY — hidden if without sales.amount.view ================= */}
            {canViewAmounts && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900">آخر عمليات اليوم</h3>
                </div>
                <Link
                  href="/activity"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  عرض سجل العمليات كاملاً
                </Link>
              </div>

              {summary?.todayActivities && summary.todayActivities.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {summary.todayActivities.map((act) => {
                    const timeStr = new Date(act.createdAt).toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <div key={act.id} className="py-3 flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-400 shrink-0 font-medium" dir="ltr">
                            {timeStr}
                          </span>
                          <span className="text-slate-800 font-medium">{act.description}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">لم يتم تسجيل أي عمليات اليوم حتى الآن</p>
              )}
            </section>
            )}
          </>
        )}
      </div>

      {/* Primary Registration Modals */}
      <RegisterSaleModal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        onSuccess={fetchSummary}
      />

      <RegisterShortageModal
        isOpen={shortageModalOpen}
        onClose={() => setShortageModalOpen(false)}
        onSuccess={fetchSummary}
      />
    </AppShell>
  );
}
