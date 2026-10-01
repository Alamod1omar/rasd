'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RasdModal } from './RasdModal';
import { RasdButton } from './RasdButton';
import { RasdInput } from './RasdInput';
import { ProductSearchSelect } from './ProductSearchSelect';
import { CustomerCombobox, SelectedCustomer } from './CustomerCombobox';
import { SarSymbol, SarAmount } from './SarSymbol';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { normalizePartNumber, normalizeBrand } from '@/types';
import {
  ShoppingCart,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface TempSaleItem {
  tempId: string;
  productId?: string;
  partNumber: string;
  partName: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  soldTo: string;
  note?: string;
}

interface RegisterSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DRAFT_STORAGE_KEY = 'rasd_sale_draft';

export const RegisterSaleModal: React.FC<RegisterSaleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, activeBranchId } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const hasNoBranch = !activeBranchId && (!user?.branches || user.branches.length === 0) && (!user?.branchIds || user.branchIds.length === 0);

  // Active Customer for Item entry (persists across items in current session as default)
  const [currentCustomer, setCurrentCustomer] = useState<SelectedCustomer | null>(null);
  const [customerError, setCustomerError] = useState<string | undefined>();
  const [items, setItems] = useState<TempSaleItem[]>([]);

  // Item Form Level
  const [editingTempId, setEditingTempId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | undefined>();
  const [partNumber, setPartNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Duplicate Alerts
  const [serverExistingInfo, setServerExistingInfo] = useState<{
    exists: boolean;
    currentQuantity?: number;
    requestDocumentNumber?: string;
    createdByFullName?: string;
  } | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<any | null>(null);
  const [hasDraftNotice, setHasDraftNotice] = useState<boolean>(false);

  // Ref for Part Number auto-focus
  const partNumberInputRef = useRef<HTMLInputElement>(null);

  // Check duplicate on server when part number or brand changes
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
          `/sales/check-item?partNumber=${encodeURIComponent(partNumber.trim())}${brandParam}${branchParam}${prodParam}`
        );
        if (res && res.exists) {
          setServerExistingInfo(res);
        } else {
          setServerExistingInfo(null);
        }
      } catch (err) {
        console.error('Error checking duplicate part:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [partNumber, brand, productId, activeBranchId, isOpen]);

  // Load draft from localStorage on open
  useEffect(() => {
    if (isOpen) {
      try {
        const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed && (parsed.items?.length > 0 || parsed.currentCustomer)) {
            setHasDraftNotice(true);
          }
        }
      } catch (e) {
        console.error('Error loading sale draft:', e);
      }
    }
  }, [isOpen]);

  // Auto-save draft
  useEffect(() => {
    if (!isOpen || savedSuccess) return;

    if (items.length > 0 || currentCustomer) {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            currentCustomer,
            items,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (e) {
        console.error('Error saving sale draft:', e);
      }
    }
  }, [items, currentCustomer, isOpen, savedSuccess]);

  const handleApplyDraft = () => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.currentCustomer) setCurrentCustomer(parsed.currentCustomer);
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
    setUnitPrice('');
    setNote('');
    setFormError(null);
    setServerExistingInfo(null);
  };

  const resetEntireModal = () => {
    resetFormFields();
    setCurrentCustomer(null);
    setCustomerError(undefined);
    setItems([]);
    setSavedSuccess(null);
    setDuplicateMessage(null);
    setHasDraftNotice(false);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const handleClose = () => {
    if (items.length > 0 && !savedSuccess) {
      showSuccess('تم الاحتفاظ بالأصناف كمسودة محلياً');
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
    setCustomerError(undefined);

    const cleanPart = partNumber.trim();
    const cleanBrand = brand.trim();
    const cleanName = partName.trim() || cleanPart;
    const numQty = typeof quantity === 'number' ? quantity : parseFloat(String(quantity) || '0');
    const numPrice = typeof unitPrice === 'number' ? unitPrice : parseFloat(String(unitPrice) || '0');
    const soldToName = currentCustomer?.name?.trim() || 'عميل نقدي';

    if (hasNoBranch) {
      setFormError('أنت غير مرتبط بأي فرع حالياً، لا يمكن إضافة أصناف');
      showError('أنت غير مرتبط بأي فرع حالياً، لا يمكنك تسجيل المبيعات. يرجى مراجعة إدارة الشركة لربط حسابك بفرع.');
      return;
    }

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
    if (numPrice < 0) {
      setFormError('سعر الوحدة يجب أن يكون صفر أو أكبر');
      return;
    }

    const lineTotal = numQty * numPrice;

    // Check if editing an existing temporary item
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
                unitPrice: numPrice,
                lineTotal,
                soldTo: soldToName,
                note: note.trim() || undefined,
              }
            : it
        )
      );
      resetFormFields();
      setTimeout(() => partNumberInputRef.current?.focus(), 50);
      return;
    }

    // Check for duplicate part inside the local temporary list
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
      const newLineTotal = newQty * (numPrice || existing.unitPrice);

      const updatedList = [...items];
      updatedList[existingIndex] = {
        ...existing,
        quantity: newQty,
        unitPrice: numPrice || existing.unitPrice,
        lineTotal: newLineTotal,
        soldTo: soldToName !== 'عميل نقدي' ? soldToName : existing.soldTo,
        note: note.trim() ? `${existing.note ? existing.note + ' | ' : ''}${note.trim()}` : existing.note,
      };

      setItems(updatedList);
      setDuplicateMessage(
        `المنتج (${cleanPart}) مكرر في القائمة المؤقتة. تم دمج الكمية من ${existing.quantity} إلى ${newQty}.`
      );
      resetFormFields();
      setTimeout(() => partNumberInputRef.current?.focus(), 50);
      return;
    }

    // Add new item
    const newItem: TempSaleItem = {
      tempId: `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      productId,
      partNumber: cleanPart,
      partName: cleanName,
      brand: cleanBrand,
      quantity: numQty,
      unitPrice: numPrice,
      lineTotal,
      soldTo: soldToName,
      note: note.trim() || undefined,
    };

    setItems((prev) => [...prev, newItem]);

    if (serverExistingInfo?.exists) {
      setDuplicateMessage(
        `تنبيه: القطعة (${cleanPart}) موجودة أيضاً في الطلب المفتوح الحالي (${serverExistingInfo.requestDocumentNumber}) بكمية ${serverExistingInfo.currentQuantity}. سيتم دمج الكمية تلقائياً عند الحفظ لتصبح ${Number(serverExistingInfo.currentQuantity) + numQty}.`
      );
    }

    resetFormFields();
    setTimeout(() => {
      partNumberInputRef.current?.focus();
    }, 50);
  };

  const handleEditItem = (item: TempSaleItem) => {
    setEditingTempId(item.tempId);
    setProductId(item.productId);
    setPartNumber(item.partNumber);
    setPartName(item.partName);
    setBrand(item.brand);
    setQuantity(item.quantity);
    setUnitPrice(item.unitPrice);
    setNote(item.note || '');
    if (item.soldTo && item.soldTo !== 'عميل نقدي') {
      setCurrentCustomer({ name: item.soldTo });
    }
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

  // Summary calculations
  const totalItemsCount = items.length;
  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
  const totalAmount = items.reduce((sum, it) => sum + it.lineTotal, 0);

  // Final Submit
  const handleFinalSubmit = async () => {
    if (!activeBranchId || hasNoBranch) {
      showError('أنت غير مرتبط بأي فرع حالياً، لا يمكنك تسجيل المبيعات. يرجى مراجعة إدارة الشركة لربط حسابك بفرع.');
      return;
    }

    if (items.length === 0) {
      showError('يجب إضافة صنف واحد على الأقل قبل الحفظ');
      return;
    }

    // Offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showError('لا يوجد اتصال بالإنترنت. تم الاحتفاظ بالأصناف كمسودة على جهازك.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        branchId: activeBranchId,
        customer: currentCustomer
          ? {
              id: currentCustomer.id,
              name: currentCustomer.name.trim(),
              phone: currentCustomer.phone?.trim() || undefined,
            }
          : undefined,
        items: items.map((it) => ({
          productId: it.productId,
          partNumber: it.partNumber,
          partName: it.partName,
          brand: it.brand,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          soldTo: it.soldTo,
          note: it.note,
        })),
      };

      const res = await api.post('/sales', payload);

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setSavedSuccess(res);
      showSuccess(
        res.isNewRequest
          ? `تم إنشاء طلب بيع مفتوح جديد برقم (${res.documentNumber})`
          : `تمت إضافة الأصناف إلى طلب البيع المفتوح (${res.documentNumber}) بنجاح`
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showError(err.message || 'تعذر حفظ طلب البيع، يرجى المحاولة ثانية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RasdModal
      isOpen={isOpen}
      onClose={handleClose}
      title="تسجيل بيع"
      subtitle="إضافة الأصناف إلى طلب البيع المفتوح الحالي للفرع وتوثيق العمليات"
      maxWidth="2xl"
    >
      {savedSuccess ? (
        <div className="py-8 text-center space-y-5">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-bold text-slate-900">
              {savedSuccess.isNewRequest ? 'تم إنشاء طلب بيع مفتوح جديد' : 'تمت إضافة الأصناف بنجاح'}
            </h4>
            <p className="text-sm text-slate-600">
              تم توثيق المنتجات داخل الطلب المفتوح للفرع ويمكن إضافة أصناف أخرى في أي وقت
            </p>
          </div>

          {/* Request Badge */}
          <div className="inline-block px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-lg">
            <span className="text-xs text-slate-400 block mb-0.5">رقم الطلب المفتوح</span>
            <span className="font-mono text-xl font-bold tracking-wider" dir="ltr">
              {savedSuccess.documentNumber}
            </span>
          </div>

          {/* Summary Box */}
          <div className="max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-500 block">إجمالي الأصناف</span>
              <span className="font-bold text-slate-900 block mt-0.5 font-mono text-sm">
                {savedSuccess.totalItems} صنف
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">إجمالي الكمية</span>
              <span className="font-bold text-slate-900 block mt-0.5 font-mono text-sm">
                {savedSuccess.totalQuantity} قطعة
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">إجمالي المبلغ</span>
              <div className="mt-0.5">
                <SarAmount
                  amount={savedSuccess.totalAmount}
                  size="lg"
                  symbolClassName="text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            {user?.role !== 'OPERATOR' && (
              <RasdButton
                variant="primary"
                size="lg"
                icon={<ExternalLink className="w-5 h-5" />}
                onClick={() => {
                  handleClose();
                  router.push(`/sales/${savedSuccess.id}`);
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
              تسجيل بيع جديد
            </RasdButton>

            <RasdButton variant="outline" size="lg" onClick={handleClose}>
              العودة للرئيسية
            </RasdButton>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* No Branch Warning */}
          {hasNoBranch && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900 text-xs sm:text-sm leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">أنت غير مرتبط بأي فرع حالياً!</p>
                <p className="mt-1 text-rose-700">
                  لا يمكنك تسجيل عمليات البيع لأن حسابك غير مربوط بأي فرع في النظام. يرجى التواصل مع مشرف الشركة لربط حسابك بالفرع التابع له لتتمكن من إضافة المبيعات.
                </p>
              </div>
            </div>
          )}

          {/* Draft Restoration Notice */}
          {hasDraftNotice && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>لديك مسودة غير مكتملة محفوظة على جهازك</span>
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

          {/* Duplicate Part Notice */}
          {duplicateMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-900">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{duplicateMessage}</span>
            </div>
          )}

          {/* Server Active Duplicate Notice (Section 17) */}
          {serverExistingInfo?.exists && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 animate-pulse">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  تنبيه: القطعة <strong>({partNumber})</strong> مضافة مسبقاً بواسطة{' '}
                  <strong className="text-slate-900">{serverExistingInfo.createdByFullName || 'أحد الموظفين'}</strong>، والكمية الحالية{' '}
                  <strong className="font-mono text-amber-800">{serverExistingInfo.currentQuantity}</strong>.
                  عند الإضافة ستُدمج لتصبح:{' '}
                  <strong className="font-mono text-emerald-800 font-bold">{Number(serverExistingInfo.currentQuantity) + (Number(quantity) || 1)}</strong>
                </span>
              </div>
            </div>
          )}


          {/* Product Entry Form Card */}
          <form
            onSubmit={handleAddOrUpdateItem}
            className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <span>{editingTempId ? 'تعديل الصنف المحدد' : 'إدخال صنف جديد'}</span>
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

            {/* Customer Search / Selection ("لمن تم البيع") */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                لمن تم البيع (العميل)
              </label>
              <CustomerCombobox
                selectedCustomer={currentCustomer}
                onSelect={(cust) => {
                  setCurrentCustomer(cust);
                  setCustomerError(undefined);
                }}
                required={false}
                error={customerError}
              />
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

            {/* Part Name & Brand Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RasdInput
                label="اسم القطعة"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="وصف أو اسم القطعة"
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

            {/* Quantity and Unit Price Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RasdInput
                label="الكمية *"
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
                <label className="block text-xs font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1 font-bold">
                    <span>سعر الوحدة</span>
                    <span className="text-slate-500 font-normal">
                      (<SarSymbol size="1.15em" />)
                    </span>
                    <span>*</span>
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  dir="ltr"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  required
                />
              </div>
            </div>

            {/* Note */}
            <RasdInput
              label="ملاحظات الصنف (اختياري)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="أي ملاحظات إضافية على هذا الصنف..."
            />

            {formError && (
              <div className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {formError}
              </div>
            )}

            {/* Add Button */}
            <div className="pt-1">
              <RasdButton
                type="submit"
                variant={editingTempId ? 'primary' : 'secondary'}
                size="md"
                className="w-full justify-center shadow-sm"
                icon={<Plus className="w-4 h-4" />}
              >
                {editingTempId ? 'تحديث بيانات الصنف' : '+ إضافة الصنف للطلب'}
              </RasdButton>
            </div>
          </form>

          {/* Temporary Items Table / Cards */}
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
                <table className="w-full min-w-[700px] text-right text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">رقم القطعة</th>
                      <th className="py-2.5 px-3">اسم القطعة</th>
                      <th className="py-2.5 px-3">الماركة</th>
                      <th className="py-2.5 px-3 text-center">الكمية</th>
                      <th className="py-2.5 px-3">سعر الوحدة</th>
                      <th className="py-2.5 px-3">الإجمالي</th>
                      <th className="py-2.5 px-3">العميل</th>
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
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 font-mono">
                          {it.quantity}
                        </td>
                        <td className="py-2.5 px-3" dir="ltr">
                          <SarAmount amount={it.unitPrice} size="sm" />
                        </td>
                        <td className="py-2.5 px-3" dir="ltr">
                          <SarAmount amount={it.lineTotal} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{it.soldTo}</td>
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
                      <div>
                        <span>{it.quantity} × </span>
                        <SarAmount amount={it.unitPrice} size="sm" />
                      </div>
                      <SarAmount amount={it.lineTotal} size="sm" />
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span>العميل: {it.soldTo}</span>
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

          {/* Sticky Summary & Submit Bar */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm pt-3 border-t border-slate-200 mt-4 pb-2 z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 text-white p-3.5 rounded-2xl shadow-lg">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">الأصناف / القطع</span>
                  <span className="font-bold font-mono">
                    {totalItemsCount} أصناف • {totalQuantity} قطعة
                  </span>
                </div>
                <div className="border-r border-slate-700 pr-4">
                  <span className="text-slate-400 block text-[10px]">المبلغ الإجمالي</span>
                  <SarAmount amount={totalAmount} size="lg" symbolClassName="text-white" />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <RasdButton
                  type="button"
                  variant="emerald"
                  size="md"
                  loading={loading}
                  disabled={items.length === 0 || hasNoBranch}
                  onClick={handleFinalSubmit}
                  className="flex-1 sm:flex-initial justify-center font-bold px-6"
                >
                  حفظ الأصناف
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
    </RasdModal>
  );
};
