'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface RasdInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  ltr?: boolean;
  endAdornment?: React.ReactNode;
}

export const RasdInput = React.forwardRef<HTMLInputElement, RasdInputProps>(
  (
    {
      label,
      error,
      helperText,
      ltr = false,
      type = 'text',
      className = '',
      id,
      endAdornment,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const computedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    const inputId =
      id ||
      (typeof label === 'string'
        ? `input-${label.replace(/\s+/g, '-').toLowerCase()}`
        : undefined);

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
            type={computedType}
            dir={ltr ? 'ltr' : 'rtl'}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 ${
              isPassword || endAdornment ? (ltr ? 'pr-10' : 'pl-10') : ''
            } ${
              error
                ? 'border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20'
                : 'border-slate-200 hover:border-slate-300'
            } ${ltr ? 'font-mono' : ''} ${className}`}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              tabIndex={-1}
              className={`absolute top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-lg focus:outline-none ${
                ltr ? 'right-2' : 'left-2'
              }`}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-slate-600" />
              ) : (
                <Eye className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )}

          {!isPassword && endAdornment && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 flex items-center ${
                ltr ? 'right-2.5' : 'left-2.5'
              }`}
            >
              {endAdornment}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  },
);

RasdInput.displayName = 'RasdInput';

