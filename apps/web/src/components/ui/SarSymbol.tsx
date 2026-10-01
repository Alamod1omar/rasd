'use client';

import React from 'react';

interface SarSymbolProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Official Saudi Riyal Symbol (⃁ / SAMA Official Vector)
 * High-definition vector guaranteed to render perfectly across all platforms and browsers.
 */
export function SarSymbol({
  size = '1.15em',
  className = '',
  ...props
}: SarSymbolProps) {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1124.14 1256.39"
      width={dimension}
      height={dimension}
      fill="currentColor"
      aria-label="ريال سعودي"
      role="img"
      className={`inline-block align-middle shrink-0 transition-transform ${className}`}
      style={{ display: 'inline-block', verticalAlign: '-0.14em' }}
      {...props}
    >
      <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z" />
      <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z" />
    </svg>
  );
}

interface SarAmountProps {
  amount: number | string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  symbolSize?: number | string;
  className?: string;
  symbolClassName?: string;
  decimals?: number;
  placement?: 'left' | 'right';
}

/**
 * Formats monetary amounts with the official Saudi Riyal symbol (⃁) prominently displayed on the left (or right).
 */
export function SarAmount({
  amount,
  size = 'md',
  symbolSize,
  className = '',
  symbolClassName = '',
  decimals = 2,
  placement = 'left',
}: SarAmountProps) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || '0') || 0;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const sizeClasses = {
    sm: 'text-sm gap-1',
    md: 'text-base gap-1.5',
    lg: 'text-lg gap-1.5 font-bold',
    xl: 'text-2xl gap-2 font-black',
    '2xl': 'text-3xl gap-2.5 font-black',
  };

  const defaultSymbolSizes = {
    sm: '1.05em',
    md: '1.15em',
    lg: '1.25em',
    xl: '1.35em',
    '2xl': '1.5em',
  };

  const chosenSymbolSize = symbolSize || defaultSymbolSizes[size];

  const symbolElement = (
    <SarSymbol
      size={chosenSymbolSize}
      className={`text-slate-900 dark:text-slate-100 font-extrabold shrink-0 ${symbolClassName}`}
    />
  );

  return (
    <span
      className={`inline-flex items-center font-bold font-mono tracking-tight ${sizeClasses[size]} ${className}`}
      dir="ltr"
    >
      {placement === 'left' && symbolElement}
      <span className="font-numeric">{formatted}</span>
      {placement === 'right' && symbolElement}
    </span>
  );
}
