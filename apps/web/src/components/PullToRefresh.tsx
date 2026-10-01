'use client';

import React, { useEffect, useState, useRef } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';

export const PullToRefresh: React.FC = () => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  const THRESHOLD = 65; // Distance in pixels required to trigger refresh

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only initiate pull-to-refresh if page is at the absolute top
      if (window.scrollY <= 0 && e.touches.length === 1) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        startYRef.current = null;
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || startYRef.current === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const rawDelta = currentY - startYRef.current;

      // Only handle downward pull when scrolled to top
      if (rawDelta > 0 && window.scrollY <= 0) {
        // Apply elastic damping resistance
        const dampened = Math.min(rawDelta * 0.42, 110);
        setPullDistance(dampened);

        // Prevent default native scroll bounce if pulling
        if (dampened > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
        isPullingRef.current = false;
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current || isRefreshing) return;

      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);

        // Gentle haptic feedback if supported on mobile
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(20);
          } catch {
            // Ignore vibration error
          }
        }

        // Trigger page refresh
        setTimeout(() => {
          window.location.reload();
        }, 350);
      } else {
        setPullDistance(0);
      }

      startYRef.current = null;
      isPullingRef.current = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  if (pullDistance <= 0 && !isRefreshing) return null;

  const isTriggered = pullDistance >= THRESHOLD || isRefreshing;
  const progressPercent = Math.min((pullDistance / THRESHOLD) * 100, 100);

  return (
    <div
      className="fixed left-0 right-0 top-0 pointer-events-none z-[9999] flex justify-center transition-transform duration-100 ease-out select-none"
      style={{
        transform: `translateY(${Math.min(pullDistance, 80)}px)`,
      }}
      aria-hidden="true"
    >
      <div className="bg-slate-900/95 text-white backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-slate-700/60 flex items-center gap-2.5 text-xs font-bold animate-in fade-in zoom-in-95 duration-150">
        {isRefreshing ? (
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
        ) : (
          <ArrowDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isTriggered ? 'rotate-180 text-emerald-400' : 'text-slate-300'
            }`}
          />
        )}

        <span>
          {isRefreshing
            ? 'جارٍ تحديث الصفحة...'
            : isTriggered
            ? 'أفلت الآن للتحديث'
            : 'اسحب لأسفل للتحديث'}
        </span>

        {!isRefreshing && (
          <div className="w-5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                isTriggered ? 'bg-emerald-400' : 'bg-slate-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
