'use client';

import React from 'react';

interface RasdInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  ltr?: boolean;
}

export const RasdInput = React.forwardRef<HTMLInputElement, RasdInputProps>(
  ({ label, error, helperText, ltr = false, className = '', id, ...props }, ref) => {
    const inputId = id || (typeof label === 'string' ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-right">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            dir={ltr ? 'ltr' : 'rtl'}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 ${
              error ? 'border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20' : 'border-slate-200 hover:border-slate-300'
            } ${ltr ? 'font-mono' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  },
);

RasdInput.displayName = 'RasdInput';
