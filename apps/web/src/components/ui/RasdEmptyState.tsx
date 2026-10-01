'use client';

import React from 'react';
import { PackageOpen } from 'lucide-react';

interface RasdEmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const RasdEmptyState: React.FC<RasdEmptyStateProps> = ({
  title = 'لا توجد بيانات متاحة',
  description = 'لم يتم تسجيل أي عناصر مطابقة في الوقت الحالي',
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50">
      <div className="p-3 bg-slate-100 text-slate-500 rounded-2xl mb-4">
        {icon || <PackageOpen className="w-8 h-8 stroke-[1.5]" />}
      </div>
      <h4 className="text-base font-bold text-slate-800 mb-1">{title}</h4>
      <p className="text-sm text-slate-500 max-w-sm mb-5 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
