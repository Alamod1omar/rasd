'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, UserRole, UserPermissions, getRolePermissions } from '@/types';
import { api } from './api';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  // Global authentication states as per architecture requirements
  authLoading: boolean;
  isAuthenticated: boolean;
  currentUser: AuthUser | null;

  // Backward-compatible aliases
  user: AuthUser | null;
  loading: boolean;

  hasPermission: (perm: keyof UserPermissions) => boolean;
  activeBranchId: string | null;
  setActiveBranchId: (branchId: string) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authLoading: true,
  isAuthenticated: false,
  currentUser: null,
  user: null,
  loading: true,
  hasPermission: () => false,
  activeBranchId: null,
  setActiveBranchId: () => {},
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const setActiveBranchId = (branchId: string) => {
    setActiveBranchIdState(branchId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rasd_active_branch', branchId);
    }
  };

  const hasPermission = (perm: keyof UserPermissions): boolean => {
    if (!user) return false;
    const perms = user.permissions || getRolePermissions(user.role);
    return !!perms[perm];
  };

  const refreshUser = async () => {
    // If no token exists in storage, finish immediately without wasteful network call
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('rasd_token');
      if (!storedToken) {
        setUser(null);
        setAuthLoading(false);
        return;
      }
    }

    try {
      const data = await api.get<AuthUser>('/auth/me');
      data.permissions = data.permissions || getRolePermissions(data.role);
      setUser(data);
      const savedBranch =
        typeof window !== 'undefined' ? localStorage.getItem('rasd_active_branch') : null;
      if (savedBranch && data.branchIds?.includes(savedBranch)) {
        setActiveBranchIdState(savedBranch);
      } else if (data.currentBranchId) {
        setActiveBranchIdState(data.currentBranchId);
      }
    } catch (e) {
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rasd_token');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ user: AuthUser; accessToken: string }>('/auth/login', {
      username,
      password,
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('rasd_token', res.accessToken);
    }
    const userWithPerms: AuthUser = {
      ...res.user,
      permissions: res.user.permissions || getRolePermissions(res.user.role),
    };
    setUser(userWithPerms);
    setAuthLoading(false);

    if (res.user.currentBranchId) {
      setActiveBranchId(res.user.currentBranchId);
    }
    if (res.user.role === UserRole.SYSTEM_ADMIN) {
      router.push('/admin/companies');
    } else {
      router.push('/');
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rasd_token');
      localStorage.removeItem('rasd_active_branch');
    }
    setUser(null);
    setActiveBranchIdState(null);
    setAuthLoading(false);
    router.push('/login');
  };

  const isAuthenticated = !authLoading && !!user;

  return (
    <AuthContext.Provider
      value={{
        authLoading,
        isAuthenticated,
        currentUser: user,
        user,
        loading: authLoading,
        hasPermission,
        activeBranchId,
        setActiveBranchId,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
