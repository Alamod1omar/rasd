'use client';

import React from 'react';

interface RasdSplashScreenProps {
  message?: string;
}

export const RasdSplashScreen: React.FC<RasdSplashScreenProps> = ({
  message = 'التحقق من بيانات الدخول...',
}) => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 text-white select-none px-4"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center max-w-sm text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Logo with gentle pulse */}
        <div className="relative">
          <div className="absolute -inset-4 bg-emerald-500/10 rounded-3xl blur-xl animate-pulse" />
          <img
            src="/logo.png"
            alt="رَصْد RASD"
            className="relative w-20 h-20 object-contain rounded-2xl shadow-2xl border border-slate-700/60 bg-slate-800/80 p-2"
          />
        </div>

        {/* Brand Text */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-black tracking-tight text-white font-sans">
            رَصْد | RASD
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            نظام رصد المبيعات السريعة والقطع الناقصة لقطع الغيار
          </p>
        </div>

        {/* Loading Indicator */}
        <div className="flex flex-col items-center space-y-3 pt-2">
          <div className="relative w-8 h-8">
            <div className="w-8 h-8 rounded-full border-2 border-slate-700/60 border-t-emerald-400 animate-spin" />
          </div>
          <span className="text-xs text-slate-400 font-semibold tracking-wide">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
};
