'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RasdModal } from './RasdModal';
import { RasdButton } from './RasdButton';
import { RasdInput } from './RasdInput';
import { ProductSearchSelect } from './ProductSearchSelect';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { normalizePartNumber, normalizeBrand } from '@/types';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  ExternalLink,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface TempShortageItem {
  tempId: string;
  productId?: string;
  partNumber: string;
  partName: string;
  brand: string;
  quantity: number;
  priority?: string;
  note?: string;
}

interface RegisterShortageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DRAFT_STORAGE_KEY = 'rasd_shortage_draft';

export const RegisterShortageModal: React.FC<RegisterShortageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, activeBranchId } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  // Shortage items list
  const [items, setItems] = useState<TempShortageItem[]>([]);

  // Item Form fields
  const [editingTempId, setEditingTempId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | undefined>();
  const [partNumber, setPartNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Duplicate checks
  const [serverExistingInfo, setServerExistingInfo] = useState<{
    exists: boolean;
    currentQuantity?: number;
    requestDocumentNumber?: string;
    createdByFullName?: string;
  } | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [confirmDuplicateData, setConfirmDuplicateData] = useState<{
    partNumber: string;
    brand: string;
    partName: string;
    quantity: number;
    priority: string;
    note?: string;
    productId?: string;
    existingInfo: any;
  } | null>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<any | null>(null);
  const [hasDraftNotice, setHasDraftNotice] = useState<boolean>(false);

  // Ref for auto-focus
  const partNumberInputRef = useRef<HTMLInputElement>(null);

  // Check duplicate on server
  useEffect(() => {
    if (!partNumber.trim() || !isOpen) {
      setServerExistingInfo(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const branchParam = activeBranchId ? `&branchId=${activeBranchId}` : '';
        const brandParam = brand.trim() ? `&brand=${encodeURIComponent(brand.trim())}` : '';
        const prodParam = productId ? `&productId=${productId}` : '';
        const res: any = await api.get(
          `/shortages/check-item?partNumber=${encodeURIComponent(partNumber.trim())}${brandParam}${branchParam}${prodParam}`
        );
        if (res && res.exists) {
          setServerExistingInfo(res);
        } else {
          setServerExistingInfo(null);
        }
      } catch (err) {
        console.error('Error checking duplicate shortage part:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [partNumber, brand, productId, activeBranchId, isOpen]);

  // Load draft on open
  useEffect(() => {
    if (isOpen) {
      try {
        const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed && parsed.items?.length > 0) {
            setHasDraftNotice(true);
          }
        }
      } catch (e) {
        console.error('Error loading shortage draft:', e);
      }
    }
  }, [isOpen]);

  // Auto-save draft
  useEffect(() => {
    if (!isOpen || savedSuccess) return;

    if (items.length > 0) {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            items,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (e) {
        console.error('Error saving shortage draft:', e);
      }
    }
  }, [items, isOpen, savedSuccess]);

  const handleApplyDraft = () => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.items) setItems(parsed.items);
      }
    } catch (e) {
      console.error(e);
    }
    setHasDraftNotice(false);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setHasDraftNotice(false);
    setItems([]);
  };

  const resetFormFields = () => {
    setEditingTempId(null);
    setProductId(undefined);
    setPartNumber('');
    setPartName('');
    setBrand('');
    setQuantity(1);
    setPriority('MEDIUM');
    setNote('');
    setFormError(null);
    setServerExistingInfo(null);
  };

  const resetEntireModal = () => {
    resetFormFields();
    setItems([]);
    setSavedSuccess(null);
    setDuplicateMessage(null);
    setHasDraftNotice(false);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const handleClose = () => {
    if (items.length > 0 && !savedSuccess) {
      showSuccess('تم الاحتفاظ بقطع النواقص كمسودة محلياً');
    }
    resetFormFields();
    onClose();
  };

  const handleSelectProduct = (p: {
    productId?: string;
    partNumber: string;
    partName: string;
    brand: string;
  }) => {
    setProductId(p.productId);
    setPartNumber(p.partNumber);
    setPartName(p.partName);
    setBrand(p.brand);
  };

  const handleAddOrUpdateItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setDuplicateMessage(null);

    const cleanPart = partNumber.trim();
    const cleanBrand = brand.trim();
    const cleanName = partName.trim() || cleanPart;
    const numQty = typeof quantity === 'number' ? quantity : parseFloat(String(quantity) || '0');

    if (!cleanPart) {
      setFormError('رقم القطعة مطلوب');
      return;
    }
    if (!cleanBrand) {
      setFormError('الماركة مطلوبة');
      return;
    }
    if (numQty <= 0) {
      setFormError('الكمية يجب أن تكون أكبر من 0');
      return;
    }

    // Check if editing
    if (editingTempId) {
      setItems((prev) =>
        prev.map((it) =>
          it.tempId === editingTempId
            ? {
                ...it,
                productId,
                partNumber: cleanPart,
                partName: cleanName,
                brand: cleanBrand,
                quantity: numQty,
                priority,
                note: note.trim() || undefined,
              }
            : it
        )
      );
      resetFormFields();
      setTimeout(() => partNumberInputRef.current?.focus(), 50);
      return;
    }

    // Duplicate Check in local temp items
    const existingIndex = items.findIndex((it) => {
      if (productId && it.productId && it.productId === productId) return true;
      return (
        normalizePartNumber(it.partNumber) === normalizePartNumber(cleanPart) &&
        normalizeBrand(it.brand) === normalizeBrand(cleanBrand)
      );
    });

    if (existingIndex !== -1) {
      const existing = items[existingIndex];
      const newQty = existing.quantity + numQty;

      const updatedList = [...items];
      updatedList[existingIndex] = {
        ...existing,
        quantity: newQty,
        priority: priority || existing.priority,
        note: note.trim() ? `${existing.note ? existing.note + ' | ' : ''}${note.trim()}` : existing.note,
      };

      setItems(updatedList);
      setDuplicateMessage(
        `القطعة (${cleanPart}) مكررة في القائمة المؤقتة. تم دمج الكمية من ${existing.quantity} إلى ${newQty}.`
      );
      resetFormFields();
      setTimeout(() => partNumberInputRef.current?.focus(), 50);
      return;
    }

    // If duplicate in open request, show clear confirmation modal before adding
    if (!editingTempId && serverExistingInfo?.exists) {
      setConfirmDuplicateData({
        partNumber: cleanPart,
        brand: cleanBrand,
        partName: cleanName,
        quantity: numQty,
        priority,
        note: note.trim() || undefined,
        productId,
        existingInfo: serverExistingInfo,
      });
      return;
    }

    executeAddItem({
      partNumber: cleanPart,
      brand: cleanBrand,
      partName: cleanName,
      quantity: numQty,
      priority,
      note: note.trim() || undefined,
      productId,
      existingInfo: serverExistingInfo,
    });
  };

  const executeAddItem = (data: {
    partNumber: string;
    brand: string;
    partName: string;
    quantity: number;
    priority: string;
    note?: string;
    productId?: string;
    existingInfo?: any;
  }) => {
    const newItem: TempShortageItem = {
      tempId: `shortage_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      productId: data.productId,
      partNumber: data.partNumber,
      partName: data.partName,
      brand: data.brand,
      quantity: data.quantity,
      priority: data.priority,
      note: data.note,
    };

    setItems((prev) => [...prev, newItem]);

    if (data.existingInfo?.exists) {
      setDuplicateMessage(
        `تنبيه: القطعة (${data.partNumber}) موجودة في طلب النواقص المفتوح الحالي (${data.existingInfo.requestDocumentNumber}) بكمية ${data.existingInfo.currentQuantity}. سيتم دمج الكمية تلقائياً لتصبح ${Number(data.existingInfo.currentQuantity) + data.quantity}.`
      );
    }

    resetFormFields();
    setTimeout(() => {
      partNumberInputRef.current?.focus();
    }, 50);
  };

  const handleEditItem = (item: TempShortageItem) => {
    setEditingTempId(item.tempId);
    setProductId(item.productId);
    setPartNumber(item.partNumber);
    setPartName(item.partName);
    setBrand(item.brand);
    setQuantity(item.quantity);
    setPriority(item.priority || 'MEDIUM');
    setNote(item.note || '');
    setFormError(null);
    setDuplicateMessage(null);
    setTimeout(() => partNumberInputRef.current?.focus(), 50);
  };

  const handleDeleteItem = (tempId: string) => {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
    if (editingTempId === tempId) {
      resetFormFields();
    }
  };

  const totalItemsCount = items.length;
  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

  const handleFinalSubmit = async () => {
    if (items.length === 0) {
      showError('يجب إضافة صنف واحد على الأقل قبل الحفظ');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showError('لا يوجد اتصال بالإنترنت. تم الاحتفاظ بالطلب كمسودة على جهازك.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        branchId: activeBranchId,
        items: items.map((it) => ({
          productId: it.productId,
          partNumber: it.partNumber,
          partName: it.partName,
          brand: it.brand,
          quantity: it.quantity,
          priority: it.priority,
          note: it.note,
        })),
      };

      const res = await api.post('/shortages', payload);

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setSavedSuccess(res);
      showSuccess(
        res.isNewRequest
          ? `تم إنشاء طلب نواقص مفتوح جديد برقم (${res.documentNumber})`
          : `تمت إضافة القطع إلى طلب النواقص المفتوح (${res.documentNumber}) بنجاح`
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showError(err.message || 'تعذر حفظ طلب النواقص، يرجى المحاولة ثانية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RasdModal
      isOpen={isOpen}
      onClose={handleClose}
      title="تسجيل نقص"
      subtitle="إضافة القطع غير المتوفرة إلى طلب النواقص المفتوح الحالي للفرع"
      maxWidth="2xl"
    >
      {savedSuccess ? (
        <div className="py-8 text-center space-y-5">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-bold text-slate-900">
              {savedSuccess.isNewRequest ? 'تم إنشاء طلب نواقص مفتوح جديد' : 'تمت إضافة القطع بنجاح'}
            </h4>
            <p className="text-sm text-slate-600">
              تم إدراج القطع داخل طلب النواقص المفتوح لفرعك ويمكن متابعتها وإضافة أصناف جديدة في أي وقت
            </p>
          </div>

          <div className="inline-block px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-lg">
            <span className="text-xs text-slate-400 block mb-0.5">رقم الطلب المفتوح</span>
            <span className="font-mono text-xl font-bold tracking-wider" dir="ltr">
              {savedSuccess.documentNumber}
            </span>
          </div>

          <div className="max-w-xs mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-500 block">إجمالي الأصناف</span>
              <span className="font-bold text-slate-900 block mt-0.5 font-mono text-sm">
                {savedSuccess.totalItems} صنف
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">إجمالي الكمية المطلوبة</span>
              <span className="font-bold text-rose-600 block mt-0.5 font-mono text-sm">
                {savedSuccess.totalQuantity} قطعة
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            {user?.role !== 'OPERATOR' && (
              <RasdButton
                variant="primary"
                size="lg"
                icon={<ExternalLink className="w-5 h-5" />}
                onClick={() => {
                  handleClose();
                  router.push(`/shortages/${savedSuccess.id}`);
                }}
              >
                عرض تفاصيل الطلب
              </RasdButton>
            )}

            <RasdButton
              variant="secondary"
              size="lg"
              icon={<RotateCcw className="w-5 h-5" />}
              onClick={resetEntireModal}
            >
              تسجيل نقص جديد
            </RasdButton>

            <RasdButton variant="outline" size="lg" onClick={handleClose}>
              العودة للرئيسية
            </RasdButton>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Draft Notice */}
          {hasDraftNotice && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>لديك مسودة نواقص غير مكتملة محفوظة محلياً</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApplyDraft}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700"
                >
                  استعادة
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-2.5 py-1 bg-white border border-amber-200 text-amber-800 rounded-lg font-bold hover:bg-amber-50"
                >
                  تجاهل
                </button>
              </div>
            </div>
          )}

          {/* Local Duplicate Notice */}
          {duplicateMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-900">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{duplicateMessage}</span>
            </div>
          )}

          {/* Server Active Duplicate Notice (Section 17) */}
          {serverExistingInfo?.exists && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between text-xs text-rose-900 animate-pulse">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  تنبيه: القطعة <strong>({partNumber})</strong> مضافة مسبقاً بواسطة{' '}
                  <strong className="text-slate-900">{serverExistingInfo.createdByFullName || 'أحد الموظفين'}</strong>، والكمية الحالية{' '}
                  <strong className="font-mono text-rose-700">{serverExistingInfo.currentQuantity}</strong>.
                  عند الإضافة ستُدمج لتصبح:{' '}
                  <strong className="font-mono text-emerald-800 font-bold">{Number(serverExistingInfo.currentQuantity) + (Number(quantity) || 1)}</strong>
                </span>
              </div>
            </div>
          )}


          {/* Form */}
          <form
            onSubmit={handleAddOrUpdateItem}
            className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{editingTempId ? 'تعديل بيانات الصنف الناقص' : 'إدخال صنف ناقص جديد'}</span>
              </span>
              {editingTempId && (
                <button
                  type="button"
                  onClick={resetFormFields}
                  className="text-[11px] text-slate-500 hover:text-rose-600 font-bold"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            {/* Part Number Search & Select */}
            <ProductSearchSelect
              onSelect={handleSelectProduct}
              value={partNumber}
              onChange={(val) => setPartNumber(val)}
              brand={brand}
              onBrandChange={(b) => setBrand(b)}
              inputRef={partNumberInputRef}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RasdInput
                label="اسم القطعة"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="وصف القطعة الناقصة..."
              />

              <RasdInput
                label="الماركة *"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="CAT, KOMATSU..."
                ltr
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RasdInput
                label="الكمية المطلوبة *"
                type="number"
                step="any"
                min="0.1"
                ltr
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="1"
                required
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">مستوى الأهمية</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold"
                >
                  <option value="LOW">عادي (Low)</option>
                  <option value="MEDIUM">متوسط (Medium)</option>
                  <option value="HIGH">عاجل جداً (High)</option>
                </select>
              </div>
            </div>

            <RasdInput
              label="ملاحظات العميل أو الطلب (اختياري)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اسم العميل الطالب، سبب النقص، أو أي ملاحظة..."
            />

            {formError && (
              <div className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {formError}
              </div>
            )}

            <div className="pt-1">
              <RasdButton
                type="submit"
                variant={editingTempId ? 'primary' : 'secondary'}
                size="md"
                className="w-full justify-center shadow-sm"
                icon={<Plus className="w-4 h-4" />}
              >
                {editingTempId ? 'تحديث الصنف' : '+ إضافة الصنف لقائمة النواقص'}
              </RasdButton>
            </div>
          </form>

          {/* List of temporary shortage items */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <span>الأصناف المجهزة للحفظ ({items.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-[11px] text-slate-400 hover:text-rose-600 font-bold"
                >
                  مسح الكل
                </button>
              </div>

              {/* Desktop View Table */}
              <div className="hidden sm:block border border-slate-200 rounded-xl overflow-x-auto overflow-y-hidden custom-horizontal-scroll shadow-sm">
                <table className="w-full min-w-[650px] text-right text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">رقم القطعة</th>
                      <th className="py-2.5 px-3">اسم القطعة</th>
                      <th className="py-2.5 px-3">الماركة</th>
                      <th className="py-2.5 px-3 text-center">الكمية</th>
                      <th className="py-2.5 px-3">الأهمية</th>
                      <th className="py-2.5 px-3">ملاحظات</th>
                      <th className="py-2.5 px-3 text-left">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((it, idx) => (
                      <tr key={it.tempId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900" dir="ltr">
                          {it.partNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{it.partName}</td>
                        <td className="py-2.5 px-3">{it.brand}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-rose-600 font-mono">
                          {it.quantity}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              it.priority === 'HIGH'
                                ? 'bg-rose-100 text-rose-700'
                                : it.priority === 'LOW'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {it.priority === 'HIGH' ? 'عاجل' : it.priority === 'LOW' ? 'عادي' : 'متوسط'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{it.note || '—'}</td>
                        <td className="py-2.5 px-3 text-left">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditItem(it)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(it.tempId)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Cards */}
              <div className="sm:hidden space-y-2">
                {items.map((it, idx) => (
                  <div
                    key={it.tempId}
                    className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900" dir="ltr">
                        {it.partNumber}
                      </span>
                      <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        {it.brand}
                      </span>
                    </div>
                    <div className="text-slate-600 text-[11px]">{it.partName}</div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                      <span>الكمية: <strong className="text-rose-600 font-mono text-sm">{it.quantity}</strong></span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditItem(it)}
                          className="text-slate-700 font-bold"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(it.tempId)}
                          className="text-rose-600 font-bold"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sticky Submit Bar */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm pt-3 border-t border-slate-200 mt-4 pb-2 z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 text-white p-3.5 rounded-2xl shadow-lg">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">الأصناف الناقصة</span>
                  <span className="font-bold font-mono text-sm">
                    {totalItemsCount} أصناف • {totalQuantity} قطعة
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <RasdButton
                  type="button"
                  variant="danger"
                  size="md"
                  loading={loading}
                  disabled={items.length === 0}
                  onClick={handleFinalSubmit}
                  className="flex-1 sm:flex-initial justify-center font-bold px-6"
                >
                  حفظ في النواقص
                </RasdButton>
                <RasdButton
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleClose}
                  className="text-slate-300 hover:text-white"
                >
                  إلغاء
                </RasdButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Shortage Item Confirmation Modal (Clear Prompt) */}
      {confirmDuplicateData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">تنبيه: صنف مكرر في طلب النواقص</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                القطعة <strong className="font-mono text-slate-900">({confirmDuplicateData.partNumber})</strong> مضافة مسبقاً في طلب النواقص المفتوح بواسطة{' '}
                <strong className="text-slate-900">{confirmDuplicateData.existingInfo.createdByFullName || 'أحد الموظفين'}</strong>، والكمية الحالية المسجلة هي{' '}
                <strong className="font-mono text-amber-800">{confirmDuplicateData.existingInfo.currentQuantity}</strong> قطعة.
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 mt-2 text-right">
                عند تأكيد الحفظ ستُدمج الكمية المطلوبة الجديدة ({confirmDuplicateData.quantity}) لتصبح الكمية الإجمالية:{' '}
                <strong className="font-mono text-emerald-800 font-bold">
                  {Number(confirmDuplicateData.existingInfo.currentQuantity) + confirmDuplicateData.quantity}
                </strong>{' '}
                قطعة.
              </div>
              <p className="text-xs font-bold text-slate-800 mt-3">
                هل تريد إلغاء الإضافة أم تأكيد وحفظ الزيادة؟
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  executeAddItem(confirmDuplicateData);
                  setConfirmDuplicateData(null);
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                تأكيد وحفظ
              </button>
              <button
                type="button"
                onClick={() => setConfirmDuplicateData(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </RasdModal>
  );
};
