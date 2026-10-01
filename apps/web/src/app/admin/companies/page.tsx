'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Building2, Plus, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SystemAdminCompaniesPage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Company Modal
  const [isCreateCompOpen, setIsCreateCompOpen] = useState(false);
  const [compName, setCompName] = useState('');
  const [compCode, setCompCode] = useState('');
  const [savingComp, setSavingComp] = useState(false);

  // Create First Admin Modal
  const [isFirstAdminOpen, setIsFirstAdminOpen] = useState(false);
  const [selectedCompForAdmin, setSelectedCompForAdmin] = useState<any | null>(null);
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  // View Branches Modal
  const [viewBranchesModal, setViewBranchesModal] = useState<{
    companyName: string;
    branches: any[];
    loading: boolean;
  } | null>(null);

  // View Users Modal
  const [viewUsersModal, setViewUsersModal] = useState<{
    companyName: string;
    users: any[];
    loading: boolean;
  } | null>(null);

  const handleOpenCompanyBranches = async (c: any) => {
    setViewBranchesModal({
      companyName: c.name,
      branches: [],
      loading: true,
    });
    try {
      const data = await api.get(`/companies/${c.id}/branches`);
      setViewBranchesModal({
        companyName: c.name,
        branches: data,
        loading: false,
      });
    } catch (e: any) {
      showError(e.message || 'تعذر تحميل فروع الشركة');
      setViewBranchesModal(null);
    }
  };

  const handleOpenCompanyUsers = async (c: any) => {
    setViewUsersModal({
      companyName: c.name,
      users: [],
      loading: true,
    });
    try {
      const data = await api.get(`/companies/${c.id}/users`);
      setViewUsersModal({
        companyName: c.name,
        users: data,
        loading: false,
      });
    } catch (e: any) {
      showError(e.message || 'تعذر تحميل مستخدمي الشركة');
      setViewUsersModal(null);
    }
  };

  // Guard: Only SYSTEM_ADMIN
  useEffect(() => {
    if (user && user.role !== UserRole.SYSTEM_ADMIN) {
      router.push('/');
    }
  }, [user, router]);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/companies');
      setCompanies(data);
    } catch (e) {
      console.error('Failed to load companies', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === UserRole.SYSTEM_ADMIN) {
      fetchCompanies();
    }
  }, [user, fetchCompanies]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim() || !compCode.trim()) {
      showError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setSavingComp(true);
    try {
      const created = await api.post('/companies', {
        name: compName.trim(),
        code: compCode.trim(),
      });
      showSuccess(`تم إنشاء شركة (${created.name}) بنجاح`);
      setIsCreateCompOpen(false);
      setCompName('');
      setCompCode('');
      fetchCompanies();

      // Open initial admin modal for this company
      setSelectedCompForAdmin(created);
      setIsFirstAdminOpen(true);
    } catch (e: any) {
      showError(e.message || 'تعذر إنشاء الشركة');
    } finally {
      setSavingComp(false);
    }
  };

  const handleCreateFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompForAdmin) return;

    setSavingAdmin(true);
    try {
      await api.post(`/companies/${selectedCompForAdmin.id}/initial-admin`, {
        fullName: adminFullName.trim(),
        username: adminUsername.trim(),
        password: adminPassword,
      });
      showSuccess(`تم إنشاء حساب المشرف (${adminFullName}) بنجاح`);
      setIsFirstAdminOpen(false);
      setSelectedCompForAdmin(null);
      setAdminFullName('');
      setAdminUsername('');
      setAdminPassword('');
      fetchCompanies();
    } catch (e: any) {
      showError(e.message || 'تعذر إنشاء حساب المشرف');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleToggleStatus = async (comp: any) => {
    const newStatus =
      comp.status === EntityStatus.ACTIVE ? EntityStatus.INACTIVE : EntityStatus.ACTIVE;
    try {
      await api.patch(`/companies/${comp.id}`, { status: newStatus });
      showSuccess(`تم ${newStatus === EntityStatus.ACTIVE ? 'تفعيل' : 'إيقاف'} الشركة`);
      fetchCompanies();
    } catch (e: any) {
      showError(e.message || 'تعذر تعديل حالة الشركة');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              إدارة الشركات (مدير المنصة العام)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              إدارة اشتراكات الشركات المستأجرة، وتعيين المدراء الأساسيين، وتفعيل الحسابات
            </p>
          </div>
          <RasdButton
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateCompOpen(true)}
          >
            إضافة شركة جديدة
          </RasdButton>
        </div>

        {loading ? (
          <RasdLoadingState message="جاري استرجاع قائمة الشركات..." />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3.5 px-4">اسم الشركة</th>
                    <th className="py-3.5 px-4">رمز الشركة</th>
                    <th className="py-3.5 px-4">المشرف المسؤول</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                    <th className="py-3.5 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">{c.name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 font-bold" dir="ltr">
                        {c.code}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.admins && c.admins.length > 0 ? (
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{c.admins[0].fullName}</p>
                            <p className="text-[10px] text-slate-400 font-mono" dir="ltr">@{c.admins[0].username}</p>
                          </div>
                        ) : (
                          <span className="inline-block text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            لم يُعيّن مشرف بعد
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <RasdBadge status={c.status} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedCompForAdmin(c);
                              setIsFirstAdminOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{c.admins && c.admins.length > 0 ? 'إضافة مشرف' : 'تعيين مشرف'}</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(c)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                              c.status === EntityStatus.ACTIVE
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200/60'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/60'
                            }`}
                          >
                            {c.status === EntityStatus.ACTIVE ? 'إيقاف' : 'تفعيل'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Company Modal */}
      <RasdModal
        isOpen={isCreateCompOpen}
        onClose={() => setIsCreateCompOpen(false)}
        title="إضافة شركة جديدة للمنصة"
        maxWidth="md"
      >
        <form onSubmit={handleCreateCompany} className="space-y-4 text-right">
          <RasdInput
            label="اسم الشركة *"
            value={compName}
            onChange={(e) => setCompName(e.target.value)}
            placeholder="مثال: شركة الرمال لمعدات الحفر"
            required
          />

          <RasdInput
            label="رمز الشركة الفريد (Code) *"
            ltr
            value={compCode}
            onChange={(e) => setCompCode(e.target.value)}
            placeholder="مثال: SANDS-01"
            required
          />

          <div className="pt-2 flex gap-3">
            <RasdButton type="submit" variant="primary" size="md" loading={savingComp} className="flex-1">
              إنشاء الشركة
            </RasdButton>
            <RasdButton type="button" variant="secondary" size="md" onClick={() => setIsCreateCompOpen(false)}>
              إلغاء
            </RasdButton>
          </div>
        </form>
      </RasdModal>

      {/* Create First Admin Modal */}
      {selectedCompForAdmin && (
        <RasdModal
          isOpen={isFirstAdminOpen}
          onClose={() => {
            setIsFirstAdminOpen(false);
            setSelectedCompForAdmin(null);
          }}
          title={`تعيين مشرف لشركة (${selectedCompForAdmin.name})`}
          subtitle="إنشاء حساب مشرف للشركة لتمكين إدارة الفروع والموظفين والعمليات التشغيلية"
          maxWidth="md"
        >
          <form onSubmit={handleCreateFirstAdmin} className="space-y-4 text-right">
            <RasdInput
              label="الاسم الكامل للمشرف *"
              value={adminFullName}
              onChange={(e) => setAdminFullName(e.target.value)}
              placeholder="مثال: عبدالمحسن القحطاني"
              required
            />

            <RasdInput
              label="اسم المستخدم (Username) *"
              ltr
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="alqahtani"
              required
            />

            <RasdInput
              label="كلمة المرور الأولية *"
              type="password"
              ltr
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <div className="pt-2 flex gap-3">
              <RasdButton type="submit" variant="primary" size="md" loading={savingAdmin} className="flex-1">
                تأكيد تعيين المشرف
              </RasdButton>
              <RasdButton
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setIsFirstAdminOpen(false);
                  setSelectedCompForAdmin(null);
                }}
              >
                إلغاء
              </RasdButton>
            </div>
          </form>
        </RasdModal>
      )}

      {/* View Company Branches Modal */}
      {viewBranchesModal && (
        <RasdModal
          isOpen={true}
          onClose={() => setViewBranchesModal(null)}
          title={`فروع شركة (${viewBranchesModal.companyName})`}
          subtitle="قائمة الفروع التابعة للشركة وحالتها التشغيلية"
          maxWidth="lg"
        >
          {viewBranchesModal.loading ? (
            <RasdLoadingState message="جاري استرجاع فروع الشركة..." />
          ) : viewBranchesModal.branches.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">
              لا توجد فروع مسجلة لهذه الشركة حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">اسم الفرع</th>
                    <th className="py-2.5 px-3">رمز الفرع</th>
                    <th className="py-2.5 px-3 text-center">العمليات</th>
                    <th className="py-2.5 px-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewBranchesModal.branches.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{b.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600" dir="ltr">{b.code}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {b._count ? `${b._count.salesRequests || 0} مبيعات / ${b._count.shortageRequests || 0} نواقص` : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <RasdBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pt-4 flex justify-end">
            <RasdButton variant="secondary" size="sm" onClick={() => setViewBranchesModal(null)}>
              إغلاق
            </RasdButton>
          </div>
        </RasdModal>
      )}

      {/* View Company Users Modal */}
      {viewUsersModal && (
        <RasdModal
          isOpen={true}
          onClose={() => setViewUsersModal(null)}
          title={`مستخدمو شركة (${viewUsersModal.companyName})`}
          subtitle="قائمة المستخدمين التابعين للشركة وصلاحيات فروعهم"
          maxWidth="xl"
        >
          {viewUsersModal.loading ? (
            <RasdLoadingState message="جاري استرجاع مستخدمي الشركة..." />
          ) : viewUsersModal.users.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">
              لا يوجد مستخدمون مسجلون لهذه الشركة حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">الاسم الكامل</th>
                    <th className="py-2.5 px-3">اسم المستخدم</th>
                    <th className="py-2.5 px-3">الدور</th>
                    <th className="py-2.5 px-3">الفروع المخولة</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    <th className="py-2.5 px-3">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewUsersModal.users.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{u.fullName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600" dir="ltr">{u.username}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {u.role === UserRole.COMPANY_ADMIN ? 'مشرف' : u.role === UserRole.SYSTEM_ADMIN ? 'مدير منصة' : 'مشغّل'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {u.branches && u.branches.length > 0 ? (
                            u.branches.map((b: any) => (
                              <span key={b.id} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                {b.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px]">كافة الفروع</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <RasdBadge status={u.status} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString('ar-SA')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pt-4 flex justify-end">
            <RasdButton variant="secondary" size="sm" onClick={() => setViewUsersModal(null)}>
              إغلاق
            </RasdButton>
          </div>
        </RasdModal>
      )}
    </AppShell>
  );
}

