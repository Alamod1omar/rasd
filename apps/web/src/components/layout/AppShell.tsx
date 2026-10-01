'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/types';
import {
  LayoutDashboard,
  ShoppingCart,
  AlertTriangle,
  Package,
  History,
  Settings,
  Building2,
  Search,
  LogOut,
  Plus,
  Menu,
  X,
  ChevronDown,
  User as UserIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  RefreshCw,
} from 'lucide-react';
import { RegisterSaleModal } from '../ui/RegisterSaleModal';
import { RegisterShortageModal } from '../ui/RegisterShortageModal';
import { GlobalSearchModal } from '../ui/GlobalSearchModal';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, logout, activeBranchId, setActiveBranchId, hasPermission } = useAuth();
  const pathname = usePathname();

  // mounted ensures role-based rendering only happens client-side
  // preventing SSR/hydration mismatch when user is null on server
  const [mounted, setMounted] = useState(false);

  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isShortageModalOpen, setIsShortageModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobilePlusOpen, setIsMobilePlusOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Set mounted on first client render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load saved sidebar state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rasd_sidebar_collapsed');
      if (saved !== null) {
        setIsSidebarCollapsed(saved === 'true');
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('rasd_sidebar_collapsed', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  if (!user) {
    if (pathname === '/login') {
      return <>{children}</>;
    }
    return null;
  }

  // Role flags — only active after mount to prevent hydration mismatch
  const isSysAdmin = mounted && user?.role === UserRole.SYSTEM_ADMIN;
  const isCompAdmin = mounted && user?.role === UserRole.COMPANY_ADMIN;

  // Stable navigation items structure — all items exist in DOM on both server & client
  // preventing hydration mismatch ("Expected server HTML to contain a matching <a> in <nav>")
  const ALL_SIDEBAR_NAV_ITEMS: {
    label: string;
    href: string;
    icon: any;
    permission: 'sales.view' | 'shortages.view' | 'products.view' | 'settings.view' | 'companies.manage';
    roles?: UserRole[];
  }[] = [
    { label: 'الرئيسية', href: '/', icon: LayoutDashboard, permission: 'sales.view', roles: [UserRole.COMPANY_ADMIN, UserRole.OPERATOR] },
    { label: 'المبيعات', href: '/sales', icon: ShoppingCart, permission: 'sales.view', roles: [UserRole.COMPANY_ADMIN, UserRole.OPERATOR] },
    { label: 'القطع الناقصة', href: '/shortages', icon: AlertTriangle, permission: 'shortages.view', roles: [UserRole.COMPANY_ADMIN, UserRole.OPERATOR] },
    { label: 'المنتجات', href: '/products', icon: Package, permission: 'products.view', roles: [UserRole.COMPANY_ADMIN] },
    { label: 'الإعدادات', href: '/settings', icon: Settings, permission: 'settings.view', roles: [UserRole.COMPANY_ADMIN] },
    { label: 'الشركات', href: '/admin/companies', icon: Building2, permission: 'companies.manage', roles: [UserRole.SYSTEM_ADMIN] },
  ];

  const roleLabel = !mounted || !user
    ? ''
    : user.role === UserRole.SYSTEM_ADMIN
      ? 'مدير المنصة العام'
      : user.role === UserRole.COMPANY_ADMIN
        ? 'مشرف'
        : 'مشغّل النظام';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans print:min-h-0 print:bg-white print:block">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside
        className={`hidden md:flex flex-col bg-white border-l border-slate-200 select-none shrink-0 h-screen sticky top-0 z-30 transition-all duration-200 no-print ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Logo Header */}
        <div className={`p-4 border-b border-slate-100 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href={isSysAdmin ? '/admin/companies' : '/'} className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="رَصْد"
              width={40}
              height={40}
              className="w-10 h-10 object-contain rounded-xl shrink-0"
              style={{ width: 40, height: 40, maxWidth: 40, maxHeight: 40 }}
            />
            {!isSidebarCollapsed && (
              <div className="truncate">
                <h1 className="font-extrabold text-lg text-slate-900 leading-none">رَصْد</h1>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">RASD PLATFORM</span>
              </div>
            )}
          </Link>

          {!isSidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="طي القائمة الجانبية"
              aria-label="طي القائمة"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {isSidebarCollapsed && (
          <div className="p-2 border-b border-slate-100 flex justify-center">
            <button
              onClick={toggleSidebar}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="توسيع القائمة الجانبية"
              aria-label="توسيع القائمة"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Company & Branch Context */}
        {!isSysAdmin && user?.companyName && (
          <div className={`py-3 bg-slate-50/70 border-b border-slate-100 ${isSidebarCollapsed ? 'px-2 text-center' : 'px-5'}`}>
            {!isSidebarCollapsed ? (
              <>
                <p className="text-xs font-bold text-slate-800 truncate">{user.companyName}</p>
                {user.branches && user.branches.length > 1 ? (
                  <div className="mt-1.5">
                    <select
                      value={activeBranchId || ''}
                      onChange={(e) => setActiveBranchId(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    >
                      {user.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : user.branches && user.branches.length === 1 ? (
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{user.branches[0].name}</p>
                ) : null}
              </>
            ) : (
              <span className="text-[10px] font-bold text-slate-500 truncate block" title={user.companyName}>
                {user.companyName.slice(0, 4)}
              </span>
            )}
          </div>
        )}

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 grow overflow-y-auto" suppressHydrationWarning>
          {ALL_SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const isVisible = mounted && user
              ? (item.roles ? item.roles.includes(user.role) : true) && hasPermission(item.permission)
              : (item.permission === 'sales.view' || item.permission === 'shortages.view');

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                suppressHydrationWarning
                className={`${
                  isVisible ? 'flex' : 'hidden'
                } items-center rounded-xl text-sm font-semibold transition-all ${
                  isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'
                } ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Mini Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {user?.fullName.charAt(0)}
              </div>
              {!isSidebarCollapsed && (
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 truncate">{user?.fullName}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{roleLabel}</p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <button
                onClick={logout}
                title="تسجيل الخروج"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT WRAPPER ================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 print:p-0 print:m-0 print:w-full print:block print:bg-white">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-20 no-print">
          {/* Header ├── Main / Navigation Section (Right side in Arabic RTL) */}
          <div className="flex items-center gap-3">
            {/* Mobile Brand / Title & Branch Context */}
            <div className="flex items-center gap-2.5 md:hidden min-w-0">
              <img
                src="/logo.png"
                alt="رَصْد"
                width={32}
                height={32}
                className="w-8 h-8 object-contain rounded-lg shrink-0"
                style={{ width: 32, height: 32, maxWidth: 32, maxHeight: 32 }}
              />
              {!isSysAdmin && user?.companyName ? (
                <div className="flex flex-col justify-center min-w-0 max-w-[150px] sm:max-w-[220px]">
                  <span className="text-[10px] text-slate-400 font-semibold truncate leading-tight">
                    {user.companyName}
                  </span>
                  {user.branches && user.branches.length > 1 ? (
                    <select
                      value={activeBranchId || ''}
                      onChange={(e) => setActiveBranchId(e.target.value)}
                      className="text-[11px] font-bold text-slate-800 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer truncate"
                    >
                      {user.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : user.branches && user.branches.length === 1 ? (
                    <span className="text-[11px] font-bold text-slate-800 truncate">
                      {user.branches[0].name}
                    </span>
                  ) : (
                    <span className="font-extrabold text-sm text-slate-900">رَصْد</span>
                  )}
                </div>
              ) : (
                <span className="font-extrabold text-base text-slate-900">رَصْد</span>
              )}
            </div>

            {/* Desktop Search Button */}
            <div className={`hidden md:flex items-center ${
              !mounted || !hasPermission('sales.view') ? 'invisible pointer-events-none' : ''
            }`}>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="group flex items-center gap-2.5 h-10 w-72 sm:w-80 lg:w-96 px-3.5 bg-slate-100/80 hover:bg-white text-slate-500 hover:text-slate-700 border border-slate-200/80 hover:border-slate-300 rounded-xl text-xs font-medium transition-all shadow-xs hover:shadow-sm"
                title="بحث سريع (Ctrl + K)"
              >
                <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
                <span className="truncate select-none font-medium">
                  بحث سريع عن قطعة أو طلب أو عميل...
                </span>
                <kbd
                  dir="ltr"
                  className="mr-auto shrink-0 inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold text-slate-500 bg-white group-hover:bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs"
                >
                  <span className="text-[11px]">⌘</span>
                  <span>K</span>
                </kbd>
              </button>
            </div>
          </div>

          {/* Header └── Actions Section (Always anchored to the designated LEFT side in Arabic RTL via ms-auto) */}
          <div className="ms-auto flex items-center gap-2.5">
            {/* Mobile Search Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className={`md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors ${
                !mounted || !hasPermission('sales.view') ? 'hidden' : ''
              }`}
              aria-label="بحث سريع"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Quick Action Buttons on Desktop (تسجيل بيع & تسجيل نقص) */}
            <div className="hidden sm:flex items-center gap-2" suppressHydrationWarning>
              {(!mounted || hasPermission('sales.create')) && (
                <button
                  onClick={() => setIsSaleModalOpen(true)}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل بيع</span>
                </button>
              )}
              {(!mounted || hasPermission('shortages.create')) && (
                <button
                  onClick={() => setIsShortageModalOpen(true)}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل نقص</span>
                </button>
              )}
            </div>

            {/* Quick Refresh Button for Mobile Shortcut & Desktop */}
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all active:scale-90"
              aria-label="تحديث الصفحة"
              title="تحديث الصفحة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* User Dropdown Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                aria-label="الملف الشخصي"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  {user?.fullName.charAt(0) || ''}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
              </button>

              {isProfileMenuOpen && (
                <div
                  className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 text-right animate-in fade-in slide-in-from-top-2"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900">{user?.fullName}</p>
                    <p className="text-xs text-slate-500 font-medium">{roleLabel}</p>
                    {user?.companyName && (
                      <p className="text-[11px] text-slate-400 mt-1 truncate">{user.companyName}</p>
                    )}
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full print:p-0 print:m-0 print:max-w-none print:w-full print:bg-white">{children}</main>
      </div>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      {isSysAdmin ? (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-40 px-6 flex items-center justify-around select-none no-print">
          <Link
            href="/admin/companies"
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-bold ${
              pathname.startsWith('/admin/companies') ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <Building2 className="w-5 h-5 mb-0.5" />
            <span>الشركات</span>
          </Link>
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center py-1 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700"
          >
            <LogOut className="w-5 h-5 mb-0.5" />
            <span>تسجيل الخروج</span>
          </button>
        </nav>
      ) : (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-40 px-2 flex items-center justify-around select-none no-print">
          <Link
            href="/"
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl text-[10px] font-bold ${
              pathname === '/' ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>الرئيسية</span>
          </Link>

          <Link
            href="/sales"
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl text-[10px] font-bold ${
              pathname.startsWith('/sales') ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <ShoppingCart className="w-5 h-5 mb-0.5" />
            <span>المبيعات</span>
          </Link>

          {/* Plus action */}
          <div className="relative -top-4">
            <button
              onClick={() => setIsMobilePlusOpen(!isMobilePlusOpen)}
              className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              aria-label="تسجيل جديد"
            >
              <Plus className={`w-7 h-7 transition-transform ${isMobilePlusOpen ? 'rotate-45' : ''}`} />
            </button>
          </div>

          <Link
            href="/shortages"
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl text-[10px] font-bold ${
              pathname.startsWith('/shortages') ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5 mb-0.5" />
            <span>النواقص</span>
          </Link>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center w-14 py-1 rounded-xl text-[10px] font-bold text-slate-400"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span>المزيد</span>
          </button>
        </nav>
      )}


      {/* Mobile Plus Quick Action Sheet */}
      {isMobilePlusOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end justify-center no-print"
          onClick={() => setIsMobilePlusOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-6 space-y-3 pb-8 text-right animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              تسجيل سريع
            </h4>
            <button
              onClick={() => {
                setIsMobilePlusOpen(false);
                setIsSaleModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-900 text-white font-bold text-base shadow-sm active:scale-98 transition-all"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-emerald-400" />
                <div className="text-right">
                  <div className="text-sm font-bold">تسجيل بيع</div>
                  <div className="text-xs text-slate-300 font-normal">قطعة خرجت بدون فاتورة</div>
                </div>
              </div>
              <Plus className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setIsMobilePlusOpen(false);
                setIsShortageModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-rose-600 text-white font-bold text-base shadow-sm active:scale-98 transition-all"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-200" />
                <div className="text-right">
                  <div className="text-sm font-bold">تسجيل نقص</div>
                  <div className="text-xs text-rose-100 font-normal">قطعة طلبها عميل وغير متوفرة</div>
                </div>
              </div>
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Drawer (Admin extra links) */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-start no-print"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-72 bg-white h-full p-6 flex flex-col justify-between text-right animate-in slide-in-from-right overflow-y-auto max-h-screen"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <img
                    src="/logo.png"
                    alt="رَصْد"
                    width={32}
                    height={32}
                    className="w-8 h-8 object-contain rounded-lg"
                    style={{ width: 32, height: 32, maxWidth: 32, maxHeight: 32 }}
                  />
                  <span className="font-extrabold text-base text-slate-900">رَصْد</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Company & Branch Context for Mobile (الشركة والفروع) */}
              {!isSysAdmin && user?.companyName && (
                <div className="py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200/90 text-right space-y-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{user.companyName}</p>
                  {user.branches && user.branches.length > 1 ? (
                    <div>
                      <select
                        value={activeBranchId || ''}
                        onChange={(e) => setActiveBranchId(e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        {user.branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : user.branches && user.branches.length === 1 ? (
                    <p className="text-[11px] font-medium text-slate-500 truncate">{user.branches[0].name}</p>
                  ) : null}
                </div>
              )}

              <div className="space-y-1">
                {ALL_SIDEBAR_NAV_ITEMS.filter((item) =>
                  mounted && user
                    ? (item.roles ? item.roles.includes(user.role) : true) && hasPermission(item.permission)
                    : false
                ).map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold ${
                        isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold text-rose-600 bg-rose-50"
            >
              <LogOut className="w-5 h-5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <RegisterSaleModal isOpen={isSaleModalOpen} onClose={() => setIsSaleModalOpen(false)} />
      <RegisterShortageModal isOpen={isShortageModalOpen} onClose={() => setIsShortageModalOpen(false)} />
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};
