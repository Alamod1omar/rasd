'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import { Product, EntityStatus, UserRole, normalizePartNumber } from '@/types';
import { RasdBadge } from '@/components/ui/RasdBadge';
import { RasdButton } from '@/components/ui/RasdButton';
import { RasdModal } from '@/components/ui/RasdModal';
import { RasdInput } from '@/components/ui/RasdInput';
import { RasdLoadingState } from '@/components/ui/RasdLoadingState';
import { RasdEmptyState } from '@/components/ui/RasdEmptyState';
import {
  Search,
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProductsPage() {
  const { user, hasPermission } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Add / Edit Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [partNumber, setPartNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [brand, setBrand] = useState('');
  const [alternativeNumbers, setAlternativeNumbers] = useState<string[]>([]);
  const [newAltNumber, setNewAltNumber] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Excel Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'update' | 'duplicate' | 'error'>('all');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permission check: Redirect if user lacks products.view permission or is SYSTEM_ADMIN
  useEffect(() => {
    if (user) {
      if (user.role === UserRole.SYSTEM_ADMIN) {
        router.push('/admin/companies');
      } else if (!hasPermission('products.view')) {
        router.push('/');
      }
    }
  }, [user, router, hasPermission]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (search) params.set('search', search.trim());
      if (brandFilter) params.set('brand', brandFilter.trim());
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get<{
        items: Product[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/products?${params.toString()}`);

      setProducts(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) {
      console.error('Failed to load products', e);
    } finally {
      setLoading(false);
    }
  }, [page, search, brandFilter, statusFilter]);

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user, fetchProducts]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setPartNumber('');
    setPartName('');
    setBrand('');
    setAlternativeNumbers([]);
    setNewAltNumber('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setPartNumber(p.partNumber);
    setPartName(p.partName);
    setBrand(p.brand);
    setAlternativeNumbers(p.alternativeNumbers ? p.alternativeNumbers.map((a) => a.number) : []);
    setNewAltNumber('');
    setIsFormModalOpen(true);
  };

  const handleAddAlternative = () => {
    const trimmed = newAltNumber.trim();
    if (!trimmed) return;
    const norm = normalizePartNumber(trimmed);
    if (!norm) return;

    if (partNumber && normalizePartNumber(partNumber) === norm) {
      showError('لا يمكن أن يكون الرقم البديل مطابقاً لرقم القطعة الأساسي');
      return;
    }

    if (alternativeNumbers.some((a) => normalizePartNumber(a) === norm)) {
      showError('هذا الرقم البديل مضاف مسبقاً لهذا المنتج');
      return;
    }

    setAlternativeNumbers([...alternativeNumbers, trimmed]);
    setNewAltNumber('');
  };

  const handleRemoveAlternative = (index: number) => {
    setAlternativeNumbers(alternativeNumbers.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partNumber.trim() || !partName.trim() || !brand.trim()) {
      showError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setFormLoading(true);
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, {
          partNumber: partNumber.trim(),
          partName: partName.trim(),
          brand: brand.trim(),
          alternativeNumbers,
        });
        showSuccess('تم تحديث بيانات المنتج بنجاح');
      } else {
        await api.post('/products', {
          partNumber: partNumber.trim(),
          partName: partName.trim(),
          brand: brand.trim(),
          alternativeNumbers,
        });
        showSuccess('تمت إضافة المنتج إلى الدليل بنجاح');
      }
      setIsFormModalOpen(false);
      fetchProducts();
    } catch (e: any) {
      showError(e.message || 'تعذر حفظ بيانات المنتج');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (p: Product) => {
    const newStatus = p.status === EntityStatus.ACTIVE ? EntityStatus.INACTIVE : EntityStatus.ACTIVE;
    try {
      await api.patch(`/products/${p.id}`, { status: newStatus });
      showSuccess(`تم ${newStatus === EntityStatus.ACTIVE ? 'تفعيل' : 'إيقاف'} المنتج بنجاح`);
      fetchProducts();
    } catch (e: any) {
      showError(e.message || 'تعذر تغيير حالة المنتج');
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await api.download(
        '/products/export',
        `RASD_Products_Export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      showSuccess('تم تصدير دليل المنتجات بنجاح');
    } catch (e: any) {
      showError(e.message || 'تعذر تصدير دليل المنتجات');
    } finally {
      setExporting(false);
    }
  };

  // Excel handlers
  const processFile = async (selectedFile: File) => {
    if (!selectedFile) return;

    // Validate extension
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      showError('يرجى اختيار ملف بصيغة Excel (.xlsx, .xls) أو CSV (.csv)');
      return;
    }

    setFile(selectedFile);
    setImporting(true);
    setPreviewData(null);
    setConfirmError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/products/import/preview', formData);
      setPreviewData(res);
      setPreviewFilter('all');
      if (res.validCount === 0) {
        showError('لم يتم العثور على أصناف صالحة للاستيراد في هذا الملف');
      } else {
        showSuccess(`تم فحص الملف: ${res.validCount} صنف جاهز للاستيراد (${res.newCount ?? res.validCount} جديد، ${res.updateCount ?? 0} تحديث)`);
      }
    } catch (err: any) {
      showError(err.message || 'تعذر فحص ملف Excel');
      setFile(null);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDownloadSample = async () => {
    try {
      await api.download('/products/template', 'نموذج_استيراد_المنتجات_رصد.xlsx');
      showSuccess('تم تنزيل النموذج المعتمد بنجاح');
    } catch (e: any) {
      showError(e.message || 'تعذر تنزيل النموذج');
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !previewData.validRows || previewData.validRows.length === 0) {
      showError('لا توجد أصناف صالحة للاستيراد');
      return;
    }

    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await api.post('/products/import/confirm', {
        validRows: previewData.validRows,
      });
      showSuccess(`تم استيراد وتحديث ${res.importedCount} منتج بنجاح`);
      setIsImportModalOpen(false);
      setFile(null);
      setPreviewData(null);
      setConfirmError(null);
      fetchProducts();
    } catch (e: any) {
      console.error('Import confirmation error:', e);
      const msg = e.message || 'فشل تأكيد الاستيراد وحفظ المنتجات';
      setConfirmError(msg);
      showError(msg);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">دليل المنتجات</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              إدارة كتالوج قطع الغيار بدون أسعار أو تكاليف مخزنية مع تصفية الماركات
            </p>
          </div>
          {hasPermission('products.manage') && (
            <div className="flex items-center gap-2">
              <RasdButton
                variant="outline"
                size="md"
                icon={<Download className="w-4 h-4" />}
                loading={exporting}
                onClick={handleExportExcel}
              >
                تصدير Excel
              </RasdButton>
              <RasdButton
                variant="outline"
                size="md"
                icon={<Upload className="w-4 h-4" />}
                onClick={() => {
                  setFile(null);
                  setPreviewData(null);
                  setIsImportModalOpen(true);
                }}
              >
                استيراد Excel
              </RasdButton>
              <RasdButton
                variant="primary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
                onClick={openCreateModal}
              >
                إضافة منتج
              </RasdButton>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ابحث برقم القطعة أو الاسم أو الماركة..."
              className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <input
            type="text"
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value);
              setPage(1);
            }}
            placeholder="تصفية حسب الماركة (مثال: CAT, KOMATSU)..."
            className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">جميع الحالات</option>
            <option value={EntityStatus.ACTIVE}>نشط</option>
            <option value={EntityStatus.INACTIVE}>غير نشط</option>
          </select>
        </div>

        {/* Table View */}
        {loading ? (
          <RasdLoadingState message="جاري استرجاع دليل المنتجات..." />
        ) : products.length === 0 ? (
          <RasdEmptyState
            title="دليل المنتجات فارغ أو لا توجد نتائج مطابقة"
            description="أضف المنتجات يدوياً أو استوردها عبر ملف Excel لتمكين البحث السريع للموظفين"
            action={
              hasPermission('products.manage') ? (
                <RasdButton variant="primary" size="sm" onClick={openCreateModal}>
                  إضافة أول منتج
                </RasdButton>
              ) : undefined
            }
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3.5 px-4">رقم القطعة</th>
                    <th className="py-3.5 px-4">اسم القطعة</th>
                    <th className="py-3.5 px-4">الماركة</th>
                    <th className="py-3.5 px-4">الرقم البديل</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    {hasPermission('products.manage') && (
                      <th className="py-3.5 px-4 text-left">الإجراءات</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm" dir="ltr">
                        {p.partNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{p.partName}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                          {p.brand}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {p.alternativeNumbers && p.alternativeNumbers.length > 0 ? (
                          <div className="flex flex-wrap gap-1" dir="ltr">
                            {p.alternativeNumbers.map((alt) => (
                              <span
                                key={alt.id}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200"
                              >
                                {alt.number}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <RasdBadge status={p.status} />
                      </td>
                      {hasPermission('products.manage') && (
                        <td className="py-3.5 px-4 text-left">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(p)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                                p.status === EntityStatus.ACTIVE
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {p.status === EntityStatus.ACTIVE ? 'إيقاف' : 'تفعيل'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <span className="text-xs text-slate-500 font-medium">
                  إجمالي المنتجات: {total} منتج
                </span>
                <div className="flex items-center gap-1.5">
                  <RasdButton
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </RasdButton>
                  <span className="text-xs font-semibold px-2">
                    صفحة {page} من {totalPages}
                  </span>
                  <RasdButton
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </RasdButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <RasdModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للدليل'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-right">
          <RasdInput
            label="رقم القطعة (Part Number) *"
            ltr
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="مثال: 7N1234"
            required
          />

          <RasdInput
            label="اسم القطعة / الوصف *"
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
            placeholder="مثال: فلتر زيت محرك رئيسي"
            required
          />

          <RasdInput
            label="الماركة / الصانع *"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="مثال: CAT أو KOMATSU أو CTP"
            required
          />

          {/* Alternative Numbers Section */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-bold text-slate-700">
              الرقم البديل (Alternative No.){' '}
              <span className="text-slate-400 font-normal">(اختياري - يدعم عدة أرقام بديلة)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                value={newAltNumber}
                onChange={(e) => setNewAltNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAlternative();
                  }
                }}
                placeholder="مثال: 5P1000"
                className="flex-1 text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-left focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="button"
                onClick={handleAddAlternative}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors shrink-0"
              >
                + إضافة بديل
              </button>
            </div>
            {alternativeNumbers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {alternativeNumbers.map((alt, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-mono font-bold"
                  >
                    <span>{alt}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAlternative(idx)}
                      className="text-amber-500 hover:text-amber-900 text-sm leading-none"
                      title="حذف الرقم البديل"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">لا توجد أرقام بديلة مضافة لهذا الصنف.</p>
            )}
          </div>

          <div className="pt-2 flex gap-3">
            <RasdButton type="submit" variant="primary" size="md" loading={formLoading} className="flex-1">
              حفظ المنتج
            </RasdButton>
            <RasdButton type="button" variant="secondary" size="md" onClick={() => setIsFormModalOpen(false)}>
              إلغاء
            </RasdButton>
          </div>
        </form>
      </RasdModal>

      {/* Excel Import Modal */}
      <RasdModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setFile(null);
          setPreviewData(null);
        }}
        title="استيراد كتالوج المنتجات من Excel"
        subtitle="الهيكل المعتمد: رقم القطعة | اسم القطعة | الماركة | الرقم البديل (4 أعمدة فقط)"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-right">
          {/* Sample Download Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
            <div className="text-slate-600">
              <span className="font-bold text-slate-800">الأعمدة المعتمدة بالترتيب: </span>
              <span className="font-mono text-slate-700">Part No. | Name | Brand | Alternative No.</span>
              <div className="text-[11px] text-slate-400 mt-0.5">يمكن إدخال عدة أرقام بديلة في نفس الخلية مفصولة بفاصلة (,).</div>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 transition-colors shadow-2xs shrink-0"
              title="تنزيل نموذج Excel المعتمد (4 أعمدة)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>تحميل النموذج الرسمي</span>
            </button>
          </div>

          {/* Hidden File Input placed outside clickable box */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* File Picker Drag & Drop Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) processFile(dropped);
            }}
            className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all select-none ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                : 'border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">
              {file ? file.name : 'انقر لاختيار ملف Excel أو CSV أو اسحبه هنا'}
            </p>
            <p className="text-xs text-slate-400 mt-1">يدعم صيغ .xlsx و .xls و .csv (حتى 10,000 صنف)</p>
          </div>

          {importing && <RasdLoadingState message="جاري قراءة وفحص ملف Excel ومطابقة الأرقام والماركات..." />}

          {/* Preview Analysis Results */}
          {previewData && !importing && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-900 font-medium leading-relaxed">
                تم فحص الملف وفق هوية القطعة الموحدة (رقم القطعة + الماركة). الأرقام البديلة مسموحة بالكامل حتى لو كانت أرقاماً أساسية لأصناف أخرى أو متبادلة.
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setPreviewFilter('all')}
                  className={`p-2.5 rounded-xl transition-all text-center ${
                    previewFilter === 'all'
                      ? 'bg-slate-900 text-white ring-2 ring-slate-900 shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${previewFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                    إجمالي الصفوف
                  </div>
                  <div className="text-base font-black font-mono">
                    {previewData.totalRows}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewFilter('valid')}
                  className={`p-2.5 rounded-xl transition-all text-center border ${
                    previewFilter === 'valid'
                      ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500 shadow-sm'
                      : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/70 text-emerald-800'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${previewFilter === 'valid' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                    صالح ({previewData.newCount ?? 0} جديد)
                  </div>
                  <div className="text-base font-black font-mono">
                    {previewData.validCount}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewFilter('update')}
                  className={`p-2.5 rounded-xl transition-all text-center border ${
                    previewFilter === 'update'
                      ? 'bg-sky-600 text-white border-sky-600 ring-2 ring-sky-500 shadow-sm'
                      : 'bg-sky-50 border-sky-100 hover:bg-sky-100/70 text-sky-800'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${previewFilter === 'update' ? 'text-sky-100' : 'text-sky-700'}`}>
                    تحديث موجود
                  </div>
                  <div className="text-base font-black font-mono">
                    {previewData.updateCount ?? 0}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewFilter('duplicate')}
                  className={`p-2.5 rounded-xl transition-all text-center border ${
                    previewFilter === 'duplicate'
                      ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-500 shadow-sm'
                      : 'bg-amber-50 border-amber-100 hover:bg-amber-100/70 text-amber-800'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${previewFilter === 'duplicate' ? 'text-amber-100' : 'text-amber-700'}`}>
                    مكرر بالملف
                  </div>
                  <div className="text-base font-black font-mono">
                    {previewData.duplicateCount ?? 0}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewFilter('error')}
                  className={`p-2.5 rounded-xl transition-all text-center border col-span-2 sm:col-span-1 ${
                    previewFilter === 'error'
                      ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-500 shadow-sm'
                      : 'bg-rose-50 border-rose-200 hover:bg-rose-100/70 text-rose-800'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${previewFilter === 'error' ? 'text-rose-100' : 'text-rose-700'}`}>
                    بيانات ناقصة ⚠
                  </div>
                  <div className="text-base font-black font-mono">
                    {(previewData.missingCount ?? 0) + (previewData.conflictCount ?? 0)}
                  </div>
                </button>
              </div>

              {/* Missing Data Explanation Box */}
              {(previewData.missingCount > 0 || previewData.conflictCount > 0) && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 text-right">
                  <div className="font-bold text-rose-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>يوجد في الملف ({(previewData.missingCount ?? 0) + (previewData.conflictCount ?? 0)} صنف) ببيانات ناقصة (رقم القطعة مفقود):</span>
                    </span>
                    {previewFilter !== 'error' && (
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('error')}
                        className="text-[11px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
                      >
                        عرض صفوف النقص فقط
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-700 font-medium">
                    السطور التي لا تحتوي على رقم قطعة أساسي لا يمكن استيرادها. يرجى ملء رقم القطعة في ملف Excel وإعادة الرفع. الأرقام البديلة مسموحة بالكامل حتى لو كانت أرقاماً أساسية لأصناف أخرى.
                  </p>
                </div>
              )}

              {/* Rows Preview Table */}
              {(() => {
                const all = previewData.allRows || [];
                const filtered = all.filter((r: any) => {
                  if (previewFilter === 'valid') return r.canImport;
                  if (previewFilter === 'update') return r.statusType === 'existing';
                  if (previewFilter === 'duplicate') return r.statusType === 'duplicate';
                  if (previewFilter === 'error') return r.statusType === 'error';
                  return true;
                });

                return (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        عرض {Math.min(filtered.length, 100)} من أصل {filtered.length} صنف{' '}
                        {previewFilter !== 'all' && (
                          <span className="font-bold text-slate-900">
                            (تصفية: {previewFilter === 'error' ? 'التعارض والنقص' : previewFilter === 'duplicate' ? 'المكرر بالملف' : previewFilter === 'update' ? 'تحديث موجود' : 'صالح للاستيراد'})
                          </span>
                        )}
                      </span>
                      {previewFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setPreviewFilter('all')}
                          className="text-xs text-slate-700 hover:text-slate-900 underline font-medium"
                        >
                          إلغاء التصفية وعرض الكل
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">السطر</th>
                            <th className="py-2.5 px-3">رقم القطعة</th>
                            <th className="py-2.5 px-3">الاسم</th>
                            <th className="py-2.5 px-3">الماركة</th>
                            <th className="py-2.5 px-3">الرقم البديل</th>
                            <th className="py-2.5 px-3">الحالة</th>
                            <th className="py-2.5 px-3 min-w-[200px]">الملاحظات والسبب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filtered.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                                لا توجد صفوف تطابق هذا التصنيف
                              </td>
                            </tr>
                          ) : (
                            filtered.slice(0, 100).map((row: any, idx: number) => {
                              let badgeBg = 'bg-slate-100 text-slate-700';
                              if (row.statusType === 'valid') badgeBg = 'bg-emerald-100 text-emerald-800';
                              else if (row.statusType === 'existing') badgeBg = 'bg-sky-100 text-sky-800';
                              else if (row.statusType === 'duplicate') badgeBg = 'bg-amber-100 text-amber-800';
                              else if (row.statusType === 'error') badgeBg = 'bg-rose-100 text-rose-800 font-bold';

                              return (
                                <tr key={idx} className={row.canImport ? 'hover:bg-slate-50' : 'bg-rose-50/30 hover:bg-rose-50/50'}>
                                  <td className="py-2 px-3 text-slate-500 font-mono text-[11px] font-bold">{row.rowNumber}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-slate-900" dir="ltr">
                                    {row.partNumber}
                                  </td>
                                  <td className="py-2 px-3 text-slate-700 max-w-[140px] truncate">{row.partName}</td>
                                  <td className="py-2 px-3 font-bold text-slate-800">{row.brand}</td>
                                  <td className="py-2 px-3 font-mono text-[11px]" dir="ltr">
                                    {row.alternativeNumbers && row.alternativeNumbers.length > 0
                                      ? row.alternativeNumbers.join(', ')
                                      : '-'}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${badgeBg}`}>
                                      {row.status}
                                    </span>
                                  </td>
                                  <td className={`py-2 px-3 text-[11px] ${row.statusType === 'error' ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>
                                    {row.note || '-'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {filtered.length > 100 && (
                      <div className="p-2 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
                        يتم عرض أول 100 منتج من أصل {filtered.length} منتج في هذا التصنيف
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Confirm Error Alert */}
              {confirmError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold">تعذر إتمام عملية الاستيراد والتحديث:</div>
                    <div className="mt-0.5">{confirmError}</div>
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="pt-2 flex gap-3">
                <RasdButton
                  variant="emerald"
                  size="md"
                  loading={confirming}
                  disabled={previewData.validCount === 0}
                  className="flex-1"
                  onClick={handleConfirmImport}
                >
                  تأكيد استيراد وتحديث ({previewData.validCount}) صنف
                </RasdButton>
                <RasdButton
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setFile(null);
                    setPreviewData(null);
                    setConfirmError(null);
                  }}
                >
                  إلغاء
                </RasdButton>
              </div>
            </div>
          )}
        </div>
      </RasdModal>
    </AppShell>
  );
}
