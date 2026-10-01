'use client';

import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface RasdPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function RasdPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
}: RasdPaginationProps) {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate visible page numbers for desktop
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 select-none text-xs text-slate-600 no-print">
      {/* Items Range & Page Size Info */}
      <div className="flex items-center gap-3">
        <span>
          عرض <strong className="text-slate-900 font-mono">{startItem}–{endItem}</strong> من أصل{' '}
          <strong className="text-slate-900 font-mono">{totalItems}</strong> سجل
        </span>

        {onPageSizeChange && (
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            <span>لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Desktop Pagination Controls */}
      <div className="hidden sm:flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors font-medium"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span>السابق</span>
        </button>

        {getPageNumbers().map((p, idx) =>
          typeof p === 'number' ? (
            <button
              key={idx}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg font-mono font-bold text-xs transition-colors ${
                p === currentPage
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              {p}
            </button>
          ) : (
            <span key={idx} className="w-8 text-center text-slate-400">
              ...
            </span>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors font-medium"
        >
          <span>التالي</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mobile Simplified Pagination: ‹ 3 / 12 › */}
      <div className="sm:hidden flex items-center gap-3">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="w-4 h-4 text-slate-700" />
        </button>

        <span className="font-mono font-bold text-sm text-slate-800">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="w-4 h-4 text-slate-700" />
        </button>
      </div>
    </div>
  );
}
