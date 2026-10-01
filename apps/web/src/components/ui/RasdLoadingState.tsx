'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface RasdLoadingStateProps {
  message?: string;
}

export const RasdLoadingState: React.FC<RasdLoadingStateProps> = ({
  message = 'جاري تحميل البيانات...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <Loader2 className="w-8 h-8 text-slate-800 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
};
