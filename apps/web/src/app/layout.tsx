import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast-context';
import { PwaRegister } from '@/components/PwaRegister';
import { PullToRefresh } from '@/components/PullToRefresh';
import { AuthGuard } from '@/components/auth/AuthGuard';

export const metadata: Metadata = {
  title: 'رَصْد RASD | منصة تسجيل المبيعات والنواقص',
  description: 'نظام رصد المخصص لتسجيل المبيعات السريعة والقطع الناقصة وإدارة الطلبات اليومية لقطع الغيار',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'رَصْد RASD',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="application-name" content="رَصْد RASD" />
      </head>
      <body className="bg-slate-50 min-h-screen text-slate-900 antialiased selection:bg-slate-900 selection:text-white" suppressHydrationWarning>
        <PullToRefresh />
        <PwaRegister />
        <AuthProvider>
          <ToastProvider>
            <AuthGuard>
              {children}
            </AuthGuard>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
