'use client';

import React from 'react';
import { SalesRequestStatus, ShortageRequestStatus, EntityStatus } from '@/types';

interface RasdBadgeProps {
  status: SalesRequestStatus | ShortageRequestStatus | EntityStatus | string;
  className?: string;
}

export const RasdBadge: React.FC<RasdBadgeProps> = ({ status, className = '' }) => {
  let label = status;
  let style = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (status) {
    case SalesRequestStatus.UNINVOICED:
      label = 'غير مفوتر';
      style = 'bg-amber-50 text-amber-800 border-amber-300';
      break;
    case SalesRequestStatus.INVOICED:
      label = 'مفوتر';
      style = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      break;
    case ShortageRequestStatus.OPEN:
      label = 'مفتوح';
      style = 'bg-rose-50 text-rose-800 border-rose-300';
      break;
    case ShortageRequestStatus.CLOSED:
      label = 'مغلق';
      style = 'bg-slate-100 text-slate-600 border-slate-200';
      break;
    case EntityStatus.ACTIVE:
      label = 'نشط';
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      break;
    case EntityStatus.INACTIVE:
      label = 'غير نشط';
      style = 'bg-rose-50 text-rose-700 border-rose-200';
      break;
    default:
      label = status;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style} ${className}`}
    >
      {label}
    </span>
  );
};
