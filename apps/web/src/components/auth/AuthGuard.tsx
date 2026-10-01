'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/types';
import { RasdSplashScreen } from '@/components/ui/RasdSplashScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { authLoading, isAuthenticated, currentUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Client-mounted check to prevent SSR hydration flash
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoginPage = pathname === '/login';

  // Perform navigation side-effects safely after verification
  useEffect(() => {
    if (!mounted || authLoading) return;

    if (!isAuthenticated) {
      if (!isLoginPage) {
        router.replace('/login');
      }
    } else {
      if (isLoginPage) {
        if (currentUser?.role === UserRole.SYSTEM_ADMIN) {
          router.replace('/admin/companies');
        } else {
          router.replace('/');
        }
      } else if (currentUser?.role === UserRole.SYSTEM_ADMIN && !pathname.startsWith('/admin')) {
        router.replace('/admin/companies');
      } else if (currentUser?.role !== UserRole.SYSTEM_ADMIN && pathname.startsWith('/admin')) {
        router.replace('/');
      }
    }
  }, [mounted, authLoading, isAuthenticated, isLoginPage, currentUser, pathname, router]);

  // Before hydration or while verifying credentials:
  // Show the native-aligned RASD splash screen.
  // NEVER render protected children during this phase.
  if (!mounted || authLoading) {
    // If user is already on /login and definitely has no token, render login immediately
    if (typeof window !== 'undefined' && isLoginPage && !localStorage.getItem('rasd_token')) {
      return <>{children}</>;
    }
    return <RasdSplashScreen message="التحقق من بيانات الدخول..." />;
  }

  // Verification completed: NOT AUTHENTICATED
  if (!isAuthenticated) {
    if (isLoginPage) {
      return <>{children}</>;
    }
    // Still on protected route waiting for redirect to /login
    return <RasdSplashScreen message="جاري التحويل لصفحة تسجيل الدخول..." />;
  }

  // Verification completed: AUTHENTICATED
  if (isLoginPage) {
    // Waiting for redirect to dashboard
    return <RasdSplashScreen message="جاري الدخول إلى النظام..." />;
  }

  // Role path enforcement
  if (currentUser?.role === UserRole.SYSTEM_ADMIN && !pathname.startsWith('/admin')) {
    return <RasdSplashScreen message="جاري التحويل للوحة مدير المنصة..." />;
  }
  if (currentUser?.role !== UserRole.SYSTEM_ADMIN && pathname.startsWith('/admin')) {
    return <RasdSplashScreen message="جاري التحويل للرئيسية..." />;
  }

  // Authenticated and route verified: safely render protected children
  return <>{children}</>;
};
