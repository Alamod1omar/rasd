'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ActivityLog, ActivityType } from '@/types';
import { RasdLoadingState } from '@/components/ui/RasdLoadingState';
import { RasdEmptyState } from '@/components/ui/RasdEmptyState';
import { RasdButton } from '@/components/ui/RasdButton';
import { Search, ChevronLeft, ChevronRight, History, Clock } from 'lucide-react';

export default function ActivityPage() {
  const { user, activeBranchId } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '25');
      if (activeBranchId) params.set('branchId', activeBranchId);
      if (search) params.set('search', search.trim());
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<{
        items: ActivityLog[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/activity?${params.toString()}`);

      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) {
      console.error('Failed to load activity logs', e);
    } finally {
      setLoading(false);
    }
  }, [page, activeBranchId, search, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">سجل العمليات</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            سجل التدقيق التشغيلي المباشر لجميع حركات المبيعات والنواقص والمنتجات
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="بحث في وصف العملية..."
              className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">جميع أنواع العمليات</option>
            <option value={ActivityType.SALE_ITEM_ADDED}>إضافة مبيعات</option>
            <option value={ActivityType.SALE_REQUEST_INVOICED}>فوترة مبيعات</option>
            <option value={ActivityType.SHORTAGE_ITEM_ADDED}>تسجيل نقص</option>
            <option value={ActivityType.SHORTAGE_QUANTITY_INCREASED}>زيادة كمية نقص</option>
            <option value={ActivityType.SHORTAGE_REQUEST_CLOSED}>إغلاق نقص</option>
            <option value={ActivityType.PRODUCT_CREATED}>إضافة منتج</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
          />
        </div>

        {/* Content */}
        {loading ? (
          <RasdLoadingState message="جاري استرجاع سجل العمليات..." />
        ) : logs.length === 0 ? (
          <RasdEmptyState
            title="لا توجد عمليات مطابقة"
            description="لم يتم العثور على أي حركات مسجلة بالمعايير المحددة"
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const dateObj = new Date(log.createdAt);
                const dateStr = dateObj.toLocaleDateString('ar-SA');
                const timeStr = dateObj.toLocaleTimeString('ar-SA', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={log.id}
                    className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900 text-sm">{log.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[11px]">
                          <span>بواسطة: <strong className="text-slate-700">{log.userFullName}</strong></span>
                          {log.branchName && <span>• الفرع: {log.branchName}</span>}
                          {log.referenceNumber && (
                            <span className="font-mono font-bold text-slate-600" dir="ltr">
                              • {log.referenceNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-left font-mono text-slate-400 shrink-0" dir="ltr">
                      {dateStr} {timeStr}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <span className="text-xs text-slate-500 font-medium">
                  إجمالي العمليات: {total}
                </span>
                <div className="flex items-center gap-1.5">
                  <RasdButton
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </RasdButton>
                  <span className="text-xs font-semibold px-2">
                    صفحة {page} من {totalPages}
                  </span>
                  <RasdButton
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </RasdButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
