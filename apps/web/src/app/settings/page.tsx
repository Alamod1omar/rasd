'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import { UserRole, EntityStatus } from '@/types';
import { RasdBadge } from '@/components/ui/RasdBadge';
import { RasdButton } from '@/components/ui/RasdButton';
import { RasdModal } from '@/components/ui/RasdModal';
import { RasdInput } from '@/components/ui/RasdInput';
import { RasdLoadingState } from '@/components/ui/RasdLoadingState';
import {
  Building,
  GitBranch,
  Users,
  Hash,
  HardDrive,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  Download,
  Upload,
  RefreshCw,
  FileCheck2,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  Database,
  ShieldCheck,
  Check,
  ChevronLeft,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

type SettingsTab = 'company' | 'branches' | 'users' | 'numbering' | 'backup';

function SettingsContent() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [loading, setLoading] = useState(true);

  // Sync tab with URL search parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab') as SettingsTab;
    if (tabParam && ['company', 'branches', 'users', 'numbering', 'backup'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleSelectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    router.replace(`/settings?tab=${tab}`);
  };

  // Company Data
  const [company, setCompany] = useState<any | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [updatingCompany, setUpdatingCompany] = useState(false);

  // Branches Data
  const [branches, setBranches] = useState<any[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchStatus, setBranchStatus] = useState<EntityStatus>(EntityStatus.ACTIVE);
  const [savingBranch, setSavingBranch] = useState(false);

  // Users Data
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userFullName, setUserFullName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>(UserRole.OPERATOR);
  const [userStatus, setUserStatus] = useState<EntityStatus>(EntityStatus.ACTIVE);
  const [userAuthorizedBranchIds, setUserAuthorizedBranchIds] = useState<string[]>([]);
  const [selectedBranchToAdd, setSelectedBranchToAdd] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Reset Password Modal
  const [resetPasswordModalUser, setResetPasswordModalUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingResetPassword, setSavingResetPassword] = useState(false);

  // Backup System State
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isCreateBackupModalOpen, setIsCreateBackupModalOpen] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Restore State
  const [selectedRestoreFile, setSelectedRestoreFile] = useState<File | null>(null);
  const [validatingBackup, setValidatingBackup] = useState(false);
  const [backupPreview, setBackupPreview] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isConfirmRestoreModalOpen, setIsConfirmRestoreModalOpen] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [targetServerBackupFilename, setTargetServerBackupFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guard: Only COMPANY_ADMIN (SYSTEM_ADMIN redirected to /admin/companies)
  useEffect(() => {
    if (user) {
      if (user.role === UserRole.SYSTEM_ADMIN) {
        router.push('/admin/companies');
      } else if (user.role !== UserRole.COMPANY_ADMIN) {
        router.push('/');
      }
    }
  }, [user, router]);

  const loadSettingsData = useCallback(async () => {
    setLoading(true);
    try {
      const [compData, branchData, uData] = await Promise.all([
        api.get('/companies/current').catch(() => null),
        api.get('/branches').catch(() => []),
        api.get('/users').catch(() => []),
      ]);
      if (compData) {
        setCompany(compData);
        setCompanyName(compData.name);
      }
      setBranches(branchData || []);
      setUsersList(uData || []);
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const data = await api.get('/backup/list');
      setBackupsList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load backup list', e);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.SYSTEM_ADMIN)) {
      loadSettingsData();
      loadBackups();
    }
  }, [user, loadSettingsData, loadBackups]);

  // Company Update
  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingCompany(true);
    try {
      await api.patch('/companies/current', { name: companyName.trim() });
      showSuccess('تم تحديث بيانات الشركة بنجاح');
      loadSettingsData();
    } catch (e: any) {
      showError(e.message || 'تعذر تحديث بيانات الشركة');
    } finally {
      setUpdatingCompany(false);
    }
  };

  // Branch CRUD
  const handleOpenAddBranch = () => {
    setEditingBranch(null);
    setBranchName('');
    setBranchCode('');
    setBranchStatus(EntityStatus.ACTIVE);
    setIsBranchModalOpen(true);
  };

  const handleOpenEditBranch = (b: any) => {
    setEditingBranch(b);
    setBranchName(b.name);
    setBranchCode(b.code);
    setBranchStatus(b.status);
    setIsBranchModalOpen(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim() || !branchCode.trim()) {
      showError('يرجى إدخال اسم ورمز الفرع');
      return;
    }

    setSavingBranch(true);
    try {
      if (editingBranch) {
        await api.patch(`/branches/${editingBranch.id}`, {
          name: branchName.trim(),
          code: branchCode.trim().toUpperCase(),
          status: branchStatus,
        });
        showSuccess('تم تحديث بيانات الفرع بنجاح');
      } else {
        await api.post('/branches', {
          name: branchName.trim(),
          code: branchCode.trim().toUpperCase(),
        });
        showSuccess('تم إضافة الفرع بنجاح');
      }
      setIsBranchModalOpen(false);
      loadSettingsData();
    } catch (e: any) {
      showError(e.message || 'تعذر حفظ بيانات الفرع');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleDeleteBranch = async (b: any) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف أو تعطيل الفرع (${b.name})؟`)) return;
    try {
      const res: any = await api.delete(`/branches/${b.id}`);
      showSuccess(res.message || 'تم تحديث حالة الفرع');
      loadSettingsData();
    } catch (e: any) {
      showError(e.message || 'تعذر تنفيذ الإجراء على الفرع');
    }
  };

  // User CRUD
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFullName('');
    setUserUsername('');
    setUserPassword('');
    setUserRole(UserRole.OPERATOR);
    setUserStatus(EntityStatus.ACTIVE);
    setUserAuthorizedBranchIds(branches.length > 0 ? [branches[0].id] : []);
    setSelectedBranchToAdd('');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: any) => {
    setEditingUser(u);
    setUserFullName(u.fullName);
    setUserUsername(u.username);
    setUserPassword('');
    setUserRole(u.role);
    setUserStatus(u.status);
    setUserAuthorizedBranchIds(u.branches ? u.branches.map((b: any) => b.id) : []);
    setSelectedBranchToAdd('');
    setIsUserModalOpen(true);
  };

  const handleAddBranchToUser = () => {
    if (!selectedBranchToAdd) return;
    if (!userAuthorizedBranchIds.includes(selectedBranchToAdd)) {
      setUserAuthorizedBranchIds([...userAuthorizedBranchIds, selectedBranchToAdd]);
    }
    setSelectedBranchToAdd('');
  };

  const handleRemoveBranchFromUser = (branchId: string) => {
    setUserAuthorizedBranchIds(userAuthorizedBranchIds.filter((id) => id !== branchId));
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFullName.trim() || !userUsername.trim()) {
      showError('يرجى إدخال الاسم واسم المستخدم');
      return;
    }

    if (!editingUser && (!userPassword || userPassword.length < 6)) {
      showError('كلمة المرور مطلوبة وتتكون من 6 خانات على الأقل عند إنشاء المستخدم');
      return;
    }

    setSavingUser(true);
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, {
          fullName: userFullName.trim(),
          role: userRole,
          status: userStatus,
          branchIds: userAuthorizedBranchIds,
          ...(userPassword.trim() ? { password: userPassword.trim() } : {}),
        });
        showSuccess('تم تحديث بيانات المستخدم بنجاح');
      } else {
        await api.post('/users', {
          fullName: userFullName.trim(),
          username: userUsername.trim(),
          password: userPassword,
          role: userRole,
          branchIds: userAuthorizedBranchIds,
        });
        showSuccess('تم إنشاء المستخدم بنجاح');
      }
      setIsUserModalOpen(false);
      loadSettingsData();
    } catch (e: any) {
      showError(e.message || 'تعذر حفظ بيانات المستخدم');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (u: any) => {
    if (u.id === user?.id) {
      showError('لا يمكنك حذف أو تعطيل حسابك الحالي');
      return;
    }
    if (!confirm(`هل أنت متأكد من رغبتك في حذف أو تعطيل حساب المستخدم (${u.fullName})؟`)) return;
    try {
      const res: any = await api.delete(`/users/${u.id}`);
      showSuccess(res.message || 'تم تحديث حساب المستخدم');
      loadSettingsData();
    } catch (e: any) {
      showError(e.message || 'تعذر تنفيذ الإجراء على المستخدم');
    }
  };

  const handleOpenResetPassword = (u: any) => {
    setResetPasswordModalUser(u);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showError('كلمة المرور يجب أن لا تقل عن 6 أحرف');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('كلمتا المرور غير متطابقتين');
      return;
    }

    setSavingResetPassword(true);
    try {
      await api.post(`/users/${resetPasswordModalUser.id}/reset-password`, {
        newPassword: newPassword.trim(),
      });
      showSuccess(`تم إعادة تعيين كلمة المرور للمستخدم (${resetPasswordModalUser.fullName}) بنجاح`);
      setResetPasswordModalUser(null);
    } catch (e: any) {
      showError(e.message || 'تعذر إعادة تعيين كلمة المرور');
    } finally {
      setSavingResetPassword(false);
    }
  };

  // Backup Handlers
  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBackup(true);
    try {
      const res: any = await api.post('/backup/create', { note: backupNote.trim() });
      showSuccess('تم إنشاء النسخة الاحتياطية بنجاح، جاري التحميل...');
      setIsCreateBackupModalOpen(false);
      setBackupNote('');
      if (res.filename) {
        await api.download(`/backup/download/${encodeURIComponent(res.filename)}`, res.filename);
      }
      loadBackups();
    } catch (err: any) {
      showError(err.message || 'تعذر إنشاء النسخة الاحتياطية');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      await api.download(`/backup/download/${encodeURIComponent(filename)}`, filename);
      showSuccess('تم تنزيل النسخة الاحتياطية بنجاح');
    } catch (err: any) {
      showError(err.message || 'تعذر تنزيل الملف');
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف النسخة الاحتياطية (${filename}) نهائياً من الخادم؟`)) return;
    try {
      await api.delete(`/backup/${encodeURIComponent(filename)}`);
      showSuccess('تم حذف النسخة الاحتياطية بنجاح');
      loadBackups();
    } catch (err: any) {
      showError(err.message || 'تعذر حذف النسخة الاحتياطية');
    }
  };

  const handleSelectRestoreFile = async (file: File) => {
    setSelectedRestoreFile(file);
    setTargetServerBackupFilename(null);
    setValidationError(null);
    setBackupPreview(null);
    setValidatingBackup(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res: any = await api.post('/backup/validate', formData);
      const meta = res?.metadata || res?.data?.metadata;
      if (meta && (res?.isValid || res?.valid || res?.success !== false)) {
        setBackupPreview({
          format: 'RASD_BACKUP',
          filename: file.name,
          version: meta.rasdBackupVersion || meta.appVersion || '1.0',
          createdAt: meta.createdAt,
          createdBy: meta.createdByName || meta.createdById || 'مدير النظام',
          note: meta.note || '',
          counts: meta.recordCounts || meta.counts || {},
        });
        showSuccess('تم التحقق من سلامة ملف النسخة الاحتياطية بنجاح');
      } else {
        throw new Error(res?.message || 'ملف النسخة الاحتياطية غير صالح');
      }
    } catch (err: any) {
      setValidationError(err.message || 'فشل التحقق من ملف النسخة الاحتياطية');
      showError(err.message || 'فشل التحقق من ملف النسخة الاحتياطية');
    } finally {
      setValidatingBackup(false);
    }
  };

  const handleTriggerServerBackupRestore = (b: any) => {
    setSelectedRestoreFile(null);
    setTargetServerBackupFilename(b.filename);
    setValidationError(null);
    setBackupPreview({
      format: 'RASD_BACKUP',
      filename: b.filename,
      version: b.version || '1.0',
      createdAt: b.createdAt,
      createdBy: b.createdByName || b.createdBy || 'مدير النظام',
      note: b.note || '',
      counts: b.recordCounts || b.counts || {},
    });
    setIsConfirmRestoreModalOpen(true);
  };

  const handleExecuteRestore = async () => {
    setRestoringBackup(true);
    try {
      if (selectedRestoreFile) {
        const formData = new FormData();
        formData.append('file', selectedRestoreFile);
        const res = await api.post('/backup/restore', formData);
        showSuccess(res.message || 'تمت استعادة النسخة الاحتياطية بنجاح');
      } else if (targetServerBackupFilename) {
        const res = await api.post('/backup/restore', { filename: targetServerBackupFilename });
        showSuccess(res.message || 'تمت استعادة النسخة الاحتياطية بنجاح');
      }
      setIsConfirmRestoreModalOpen(false);
      setSelectedRestoreFile(null);
      setBackupPreview(null);
      setTargetServerBackupFilename(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadSettingsData();
      await loadBackups();
    } catch (err: any) {
      showError(err.message || 'تعذر استعادة النسخة الاحتياطية، تم الحفاظ على بيانات النظام');
    } finally {
      setRestoringBackup(false);
    }
  };

  // Shared Settings Categories Configuration
  const SETTINGS_CATEGORIES: {
    id: SettingsTab;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    {
      id: 'company',
      title: 'بيانات الشركة',
      description: 'بيانات وتعريف الشركة',
      icon: Building,
    },
    {
      id: 'branches',
      title: 'الفروع',
      description: 'إدارة فروع الشركة التشغيلية',
      icon: GitBranch,
      count: branches.length,
    },
    {
      id: 'users',
      title: 'المستخدمون',
      description: 'المستخدمون وصلاحيات الوصول',
      icon: Users,
      count: usersList.length,
    },
    {
      id: 'numbering',
      title: 'ترقيم الطلبات',
      description: 'صيغ وترقيم المستندات المركزية',
      icon: Hash,
    },
    {
      id: 'backup',
      title: 'النسخ الاحتياطية',
      description: 'إنشاء أو استعادة نسخة احتياطية',
      icon: HardDrive,
      count: backupsList.length,
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        {/* Page Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">إعدادات النظام</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            إدارة بيانات الشركة، الفروع، المستخدمين، ترقيم المستندات، والنسخ الاحتياطية
          </p>
        </div>

        {/* 
          Shared Navigation Categories:
          Visible and reachable on ALL screen widths.
          On mobile, renders as responsive category cards/grid so Company & Branches never disappear!
        */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {SETTINGS_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectTab(cat.id)}
                className={`py-2 px-3 rounded-xl border text-right transition-all flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                    {cat.title}
                  </span>
                </div>
                {cat.count !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <RasdLoadingState message="جاري استرجاع الإعدادات..." />
        ) : (
          <div className="pt-2">
            {/* 1. COMPANY TAB */}
            {activeTab === 'company' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">بيانات الشركة</h3>
                    <p className="text-xs text-slate-500">الملف الأساسي والرمز التعريفي للشركة</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateCompany} className="space-y-4 pt-2">
                  <RasdInput
                    label="اسم الشركة *"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">رمز الشركة (Code)</label>
                    <input
                      type="text"
                      disabled
                      value={company?.code || ''}
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-mono text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-[11px] text-slate-400">رمز الشركة فريد ولا يمكن تعديله</p>
                  </div>

                  <RasdButton type="submit" variant="primary" size="md" loading={updatingCompany}>
                    حفظ التغييرات
                  </RasdButton>
                </form>
              </div>
            )}

            {/* 2. BRANCHES TAB */}
            {activeTab === 'branches' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">فروع الشركة</h3>
                    <p className="text-xs text-slate-500">إدارة فروع الشركة التشغيلية وحالتها ورموزها</p>
                  </div>
                  <RasdButton
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={handleOpenAddBranch}
                  >
                    إضافة فرع جديد
                  </RasdButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {branches.map((b) => (
                    <div
                      key={b.id}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-base text-slate-900">{b.name}</h4>
                          <RasdBadge status={b.status} />
                        </div>
                        <p className="font-mono text-xs text-slate-500" dir="ltr">
                          Code: <span className="font-bold text-slate-700">{b.code}</span>
                        </p>
                      </div>

                      <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[11px] text-slate-500">
                          <span>{b._count?.salesRequests || 0} مبيعات</span>
                          <span className="mx-1">•</span>
                          <span>{b._count?.shortageRequests || 0} نواقص</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditBranch(b)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="تعديل الفرع"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBranch(b)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="تعطيل / حذف الفرع"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. USERS TAB */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">مستخدمو الشركة</h3>
                    <p className="text-xs text-slate-500">
                      إدارة حسابات المشرفين والموظفين، وتعيين الفروع المخولة لكل مستخدم
                    </p>
                  </div>
                  <RasdButton
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={handleOpenAddUser}
                  >
                    إضافة مستخدم جديد
                  </RasdButton>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <tr>
                          <th className="py-3.5 px-4">#</th>
                          <th className="py-3.5 px-4">الاسم الكامل</th>
                          <th className="py-3.5 px-4">اسم المستخدم</th>
                          <th className="py-3.5 px-4">الدور</th>
                          <th className="py-3.5 px-4">الفروع المخولة</th>
                          <th className="py-3.5 px-4">الحالة</th>
                          <th className="py-3.5 px-4 text-left">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersList.map((u, idx) => (
                          <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">{u.fullName}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-600" dir="ltr">
                              {u.username}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                  u.role === UserRole.COMPANY_ADMIN
                                    ? 'bg-purple-50 text-purple-700'
                                    : u.role === UserRole.SYSTEM_ADMIN
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {u.role === UserRole.COMPANY_ADMIN
                                  ? 'مشرف'
                                  : u.role === UserRole.SYSTEM_ADMIN
                                  ? 'مدير المنصة'
                                  : 'مشغّل'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {u.branches && u.branches.length > 0 ? (
                                  u.branches.map((b: any) => (
                                    <span
                                      key={b.id}
                                      className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium"
                                    >
                                      {b.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400">لا يوجد فرع</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <RasdBadge status={u.status} />
                            </td>
                            <td className="py-3.5 px-4 text-left">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenResetPassword(u)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors"
                                  title="إعادة تعيين كلمة المرور"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  <span>كلمة المرور</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="تعديل المستخدم"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {u.id !== user?.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="تعطيل / حذف المستخدم"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 4. DOCUMENT NUMBERING TAB */}
            {activeTab === 'numbering' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">صيغ ترقيم المستندات المركزية</h3>
                    <p className="text-xs text-slate-500">قواعد الترقيم التلقائي المحمية ضد التكرار والتداخل</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 block mb-1">طلبات المبيعات:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm" dir="ltr">
                      SL-YYYYMMDD-XXX
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">مثال: SL-20260930-001</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 block mb-1">طلبات النواقص:</span>
                    <span className="font-mono font-bold text-rose-600 text-sm" dir="ltr">
                      SH-YYYYMMDD-XXX
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">مثال: SH-20260930-001</p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. BACKUP TAB */}
            {activeTab === 'backup' && (
              <div className="space-y-6">
                {/* Header Information Banner */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">إدارة النسخ الاحتياطية واسترجاع البيانات</h3>
                    </div>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      يتيح لك النظام تصدير نسخة احتياطية كاملة (.rasdbackup) لبيانات الشركة، الفروع، المستخدمين،
                      المنتجات، وطلبات المبيعات والنواقص، والاحتفاظ بها محلياً على جهازك، فلاشة USB أو قرص خارجي،
                      واستعادتها في أي وقت بأمان تام.
                    </p>
                  </div>
                  <RasdButton
                    variant="primary"
                    size="md"
                    className="bg-white text-slate-900 hover:bg-slate-100 font-bold whitespace-nowrap shadow-md"
                    icon={<Download className="w-4 h-4 text-slate-900" />}
                    onClick={() => {
                      setBackupNote('');
                      setIsCreateBackupModalOpen(true);
                    }}
                  >
                    إنشاء نسخة احتياطية
                  </RasdButton>
                </div>

                {/* Two Main Cards: Create & Import */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card 1: Create Backup */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900">إنشاء نسخة احتياطية جديدة</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        توليد ملف نسخة احتياطية فوري بصيغة <code>.rasdbackup</code> وتحميله مباشرة إلى جهازك
                        للاحتفاظ به محلياً أو نقله عبر فلاش ميموري (USB).
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <RasdButton
                        type="button"
                        variant="secondary"
                        size="md"
                        className="w-full justify-center"
                        icon={<Download className="w-4 h-4" />}
                        onClick={() => {
                          setBackupNote('');
                          setIsCreateBackupModalOpen(true);
                        }}
                      >
                        إنشاء وتحميل نسخة احتياطية
                      </RasdButton>
                    </div>
                  </div>

                  {/* Card 2: Import & Restore Backup */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900">استيراد واستعادة نسخة احتياطية</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        اختر ملف نسخة احتياطية من جهازك، سطح المكتب، أو وحدة تخزين خارجية، ليتم فحصه واستعراض
                        محتوياته قبل تأكيد الاستعادة.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".rasdbackup,.json"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleSelectRestoreFile(e.target.files[0]);
                          }
                        }}
                      />
                      <RasdButton
                        type="button"
                        variant="secondary"
                        size="md"
                        className="w-full justify-center"
                        icon={<Upload className="w-4 h-4" />}
                        loading={validatingBackup}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        اختيار ملف واستيراده
                      </RasdButton>
                    </div>
                  </div>
                </div>

                {/* Backup Validation Preview Card */}
                {backupPreview && (
                  <div className="bg-white rounded-2xl border border-blue-200 shadow-md p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileCheck2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-slate-900">
                            معاينة النسخة الاحتياطية قبل الاستعادة
                          </h4>
                          <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ملف النسخة سليم ومتوافق مع إصدار النظام
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <RasdButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setBackupPreview(null);
                            setSelectedRestoreFile(null);
                            setTargetServerBackupFilename(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          إلغاء
                        </RasdButton>
                        <RasdButton
                          type="button"
                          variant="danger"
                          size="sm"
                          icon={<RefreshCw className="w-4 h-4" />}
                          onClick={() => setIsConfirmRestoreModalOpen(true)}
                        >
                          استعادة النسخة
                        </RasdButton>
                      </div>
                    </div>

                    {/* Metadata Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[11px] mb-1">اسم النسخة</span>
                        <span className="font-mono font-bold text-slate-800 break-all" dir="ltr">
                          {backupPreview.filename || selectedRestoreFile?.name || 'RASD_Backup'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[11px] mb-1">تاريخ النسخة</span>
                        <span className="font-bold text-slate-800">
                          {backupPreview.createdAt
                            ? new Date(backupPreview.createdAt).toLocaleString('ar-SA')
                            : '-'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[11px] mb-1">الإصدار</span>
                        <span className="font-mono font-bold text-slate-800">
                          {backupPreview.version || '1.0'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[11px] mb-1">أنشئت بواسطة</span>
                        <span className="font-bold text-slate-800">
                          {backupPreview.createdBy || 'مدير النظام'}
                        </span>
                      </div>
                    </div>

                    {backupPreview.note && (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <span className="font-bold">ملاحظة النسخة: </span>
                        <span>{backupPreview.note}</span>
                      </div>
                    )}

                    {/* Counts Grid */}
                    <div>
                      <h5 className="text-xs font-bold text-slate-700 mb-2">إحصائيات وسجلات النسخة:</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-lg font-black text-slate-900 block">
                            {backupPreview.counts?.products ?? 0}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">المنتجات</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-lg font-black text-slate-900 block">
                            {backupPreview.counts?.users ?? 0}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">المستخدمون</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-lg font-black text-slate-900 block">
                            {backupPreview.counts?.branches ?? 0}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">الفروع</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-lg font-black text-slate-900 block">
                            {backupPreview.counts?.salesRequests ?? 0}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">طلبات المبيعات</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-lg font-black text-slate-900 block">
                            {backupPreview.counts?.shortageRequests ?? 0}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">طلبات النواقص</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Server Backup History Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
                  <div className="p-5 pb-2 flex justify-between items-center border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-base text-slate-900">سجل النسخ الاحتياطية على الخادم</h4>
                      <p className="text-xs text-slate-500">
                        النسخ المحفوظة على خادم رَصْد مع إمكانية التنزيل أو الاستعادة المباشرة
                      </p>
                    </div>
                    <RasdButton
                      variant="secondary"
                      size="sm"
                      icon={<RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />}
                      onClick={loadBackups}
                    >
                      تحديث السجل
                    </RasdButton>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <tr>
                          <th className="py-3 px-4">اسم النسخة</th>
                          <th className="py-3 px-4">التاريخ والوقت</th>
                          <th className="py-3 px-4">الحجم</th>
                          <th className="py-3 px-4">الملاحظة</th>
                          <th className="py-3 px-4">أنشأ بواسطة</th>
                          <th className="py-3 px-4">الإصدار</th>
                          <th className="py-3 px-4 text-left">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {backupsList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">
                              لا توجد نسخ احتياطية مسجلة حالياً على الخادم. يمكنك إنشاء نسخة جديدة الآن.
                            </td>
                          </tr>
                        ) : (
                          backupsList.map((b) => (
                            <tr key={b.filename} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-slate-900" dir="ltr">
                                {b.filename}
                              </td>
                              <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                {new Date(b.createdAt).toLocaleString('ar-SA')}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {(b.size / 1024).toFixed(1)} KB
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                                {b.note || '-'}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {b.createdBy || 'مدير النظام'}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {b.version || '1.0'}
                              </td>
                              <td className="py-3 px-4 text-left whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadBackup(b.filename)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors"
                                    title="تنزيل النسخة"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>تنزيل</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerServerBackupRestore(b)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors"
                                    title="استعادة هذه النسخة"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>استعادة</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBackup(b.filename)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="حذف النسخة من الخادم"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Create Backup with Optional Note */}
      <RasdModal
        isOpen={isCreateBackupModalOpen}
        onClose={() => !creatingBackup && setIsCreateBackupModalOpen(false)}
        title="إنشاء نسخة احتياطية جديدة"
        subtitle="سيتم تجميع كافة السجلات وقواعد البيانات في ملف موحد جاهز للتحميل"
        maxWidth="md"
      >
        <form onSubmit={handleCreateBackup} className="space-y-4 text-right">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800 leading-relaxed">
            <span className="font-bold block mb-1">محتويات النسخة:</span>
            بيانات الشركة، الفروع، المستخدمين وصلاحياتهم، المنتجات، طلبات المبيعات وعناصرها، طلبات
            النواقص وتاريخها، سجلات التدقيق وإعدادات الترقيم.
          </div>

          <RasdInput
            label="ملاحظة النسخة (اختياري)"
            value={backupNote}
            onChange={(e) => setBackupNote(e.target.value)}
            placeholder="مثال: نسخة قبل تحديث الأسعار، نسخة نهاية الشهر..."
          />

          <div className="pt-2 flex gap-3">
            <RasdButton
              type="submit"
              variant="primary"
              size="md"
              loading={creatingBackup}
              className="flex-1"
              icon={<Download className="w-4 h-4" />}
            >
              {creatingBackup ? 'جاري إنشاء النسخة وتحميلها...' : 'إنشاء وتحميل الآن'}
            </RasdButton>
            <RasdButton
              type="button"
              variant="secondary"
              size="md"
              disabled={creatingBackup}
              onClick={() => setIsCreateBackupModalOpen(false)}
            >
              إلغاء
            </RasdButton>
          </div>
        </form>
      </RasdModal>

      {/* Modal: Strong Warning Confirmation for Restore */}
      <RasdModal
        isOpen={isConfirmRestoreModalOpen}
        onClose={() => !restoringBackup && setIsConfirmRestoreModalOpen(false)}
        title="تأكيد استعادة النسخة الاحتياطية"
        maxWidth="md"
      >
        <div className="space-y-4 text-right">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1.5">
              <span className="font-bold text-sm block">تحذير بالغ الأهمية:</span>
              <p>
                سيؤدي استعادة النسخة الاحتياطية إلى استبدال بيانات النظام الحالية ببيانات النسخة
                المختارة. هل تريد المتابعة؟
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>نسخة أمان تلقائية (Automatic Safety Backup):</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              لحماية بياناتك، سيقوم النظام تلقائياً بأخذ نسخة احتياطية لكافة بيانات النظام الحالية
              (Pre-Restore Backup) قبل تطبيق أي تغييرات، لضمان استرجاعها فوراً في حال حدوث أي خطأ.
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <RasdButton
              type="button"
              variant="danger"
              size="md"
              loading={restoringBackup}
              className="flex-1 font-bold"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleExecuteRestore}
            >
              {restoringBackup ? 'جاري تأمين واستعادة البيانات...' : 'تأكيد واستعادة النسخة'}
            </RasdButton>
            <RasdButton
              type="button"
              variant="secondary"
              size="md"
              disabled={restoringBackup}
              onClick={() => setIsConfirmRestoreModalOpen(false)}
            >
              إلغاء
            </RasdButton>
          </div>
        </div>
      </RasdModal>

      {/* Add / Edit Branch Modal */}
      <RasdModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        title={editingBranch ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveBranch} className="space-y-4 text-right">
          <RasdInput
            label="اسم الفرع *"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="مثال: فرع الدمام"
            required
          />

          <RasdInput
            label="رمز الفرع (Code) *"
            ltr
            value={branchCode}
            onChange={(e) => setBranchCode(e.target.value)}
            placeholder="BR-DMM"
            required
          />

          {editingBranch && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">حالة الفرع *</label>
              <select
                value={branchStatus}
                onChange={(e) => setBranchStatus(e.target.value as EntityStatus)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value={EntityStatus.ACTIVE}>نشط (متاح للعمليات)</option>
                <option value={EntityStatus.INACTIVE}>معطّل (متوقف مؤقتاً)</option>
              </select>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <RasdButton type="submit" variant="primary" size="md" loading={savingBranch} className="flex-1">
              {editingBranch ? 'تحديث الفرع' : 'حفظ الفرع'}
            </RasdButton>
            <RasdButton type="button" variant="secondary" size="md" onClick={() => setIsBranchModalOpen(false)}>
              إلغاء
            </RasdButton>
          </div>
        </form>
      </RasdModal>

      {/* Add / Edit User Modal */}
      <RasdModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? `تعديل بيانات المستخدم: ${editingUser.fullName}` : 'إضافة مستخدم جديد'}
        subtitle="تحديد البيانات الشخصية، الدور الوظيفي، وتعيين الفروع المخولة"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveUser} className="space-y-4 text-right">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RasdInput
              label="الاسم الكامل *"
              value={userFullName}
              onChange={(e) => setUserFullName(e.target.value)}
              placeholder="مثال: محمد سعيد"
              required
            />

            <RasdInput
              label="اسم المستخدم (Username) *"
              ltr
              value={userUsername}
              disabled={!!editingUser}
              onChange={(e) => setUserUsername(e.target.value)}
              placeholder="msaeed"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">الدور الوظيفي *</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as UserRole)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value={UserRole.OPERATOR}>مشغّل (تسجيل بيع ونقص فقط)</option>
                <option value={UserRole.COMPANY_ADMIN}>مشرف (إشراف تشغيلي وإداري)</option>
              </select>
            </div>

            {editingUser && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">حالة الحساب *</label>
                <select
                  value={userStatus}
                  onChange={(e) => setUserStatus(e.target.value as EntityStatus)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value={EntityStatus.ACTIVE}>نشط</option>
                  <option value={EntityStatus.INACTIVE}>معطّل</option>
                </select>
              </div>
            )}
          </div>

          <RasdInput
            label={editingUser ? 'كلمة المرور الجديدة (اختياري - اتركه فارغاً للإبقاء على الحالية)' : 'كلمة المرور *'}
            type="password"
            ltr
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            placeholder={editingUser ? '••••••••' : '6 أحرف على الأقل'}
            required={!editingUser}
          />

          {/* Section 5: Authorized Branches with Multi-select & Explicit Table */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  الفروع المخولة للعمل عليها *
                </label>
                <p className="text-[11px] text-slate-400">
                  حدد الفروع التي يستطيع هذا المستخدم الوصول إليها وتسجيل العمليات بها
                </p>
              </div>
            </div>

            {/* Branch Selector Dropdown + Add Button */}
            <div className="flex gap-2">
              <select
                value={selectedBranchToAdd}
                onChange={(e) => setSelectedBranchToAdd(e.target.value)}
                className="grow text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">-- اختر فرعاً لإضافته --</option>
                {branches
                  .filter((b) => !userAuthorizedBranchIds.includes(b.id))
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
              </select>
              <RasdButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddBranchToUser}
                disabled={!selectedBranchToAdd}
              >
                إضافة الفرع
              </RasdButton>
            </div>

            {/* Selected Branches Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">الفرع</th>
                    <th className="py-2.5 px-3">الكود</th>
                    <th className="py-2.5 px-3 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userAuthorizedBranchIds.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400 text-[11px]">
                        لم يتم اختيار أي فرع مخول حتى الآن. يرجى اختيار فرع واحد على الأقل.
                      </td>
                    </tr>
                  ) : (
                    userAuthorizedBranchIds.map((branchId) => {
                      const branchObj = branches.find((b) => b.id === branchId);
                      return (
                        <tr key={branchId} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {branchObj?.name || 'فرع غير معروف'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600" dir="ltr">
                            {branchObj?.code || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-left">
                            <button
                              type="button"
                              onClick={() => handleRemoveBranchFromUser(branchId)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 flex gap-3 border-t border-slate-100">
            <RasdButton type="submit" variant="primary" size="md" loading={savingUser} className="flex-1">
              {editingUser ? 'تحديث المستخدم' : 'حفظ المستخدم'}
            </RasdButton>
            <RasdButton type="button" variant="secondary" size="md" onClick={() => setIsUserModalOpen(false)}>
              إلغاء
            </RasdButton>
          </div>
        </form>
      </RasdModal>

      {/* Reset Password Modal */}
      {resetPasswordModalUser && (
        <RasdModal
          isOpen={true}
          onClose={() => setResetPasswordModalUser(null)}
          title={`إعادة تعيين كلمة المرور: ${resetPasswordModalUser.fullName}`}
          subtitle={`اسم المستخدم: ${resetPasswordModalUser.username}`}
          maxWidth="sm"
        >
          <form onSubmit={handleSaveResetPassword} className="space-y-4 text-right">
            <RasdInput
              label="كلمة المرور الجديدة *"
              type="password"
              ltr
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6 خانات على الأقل"
              required
            />

            <RasdInput
              label="تأكيد كلمة المرور *"
              type="password"
              ltr
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد إدخال كلمة المرور"
              required
            />

            <div className="pt-2 flex gap-3">
              <RasdButton
                type="submit"
                variant="primary"
                size="md"
                loading={savingResetPassword}
                className="flex-1"
              >
                تأكيد التغيير
              </RasdButton>
              <RasdButton
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setResetPasswordModalUser(null)}
              >
                إلغاء
              </RasdButton>
            </div>
          </form>
        </RasdModal>
      )}
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<RasdLoadingState message="جاري استرجاع الإعدادات..." />}>
      <SettingsContent />
    </Suspense>
  );
}
