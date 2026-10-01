'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Search, UserCheck, UserPlus, X, AlertCircle } from 'lucide-react';

export interface SelectedCustomer {
  id?: string;
  name: string;
  phone?: string;
  isNew?: boolean;
}

interface CustomerItem {
  id: string;
  name: string;
  phone?: string | null;
  taxNumber?: string | null;
  city?: string | null;
}

interface CustomerComboboxProps {
  selectedCustomer: SelectedCustomer | null;
  onSelect: (customer: SelectedCustomer | null) => void;
  required?: boolean;
  error?: string;
}

export const CustomerCombobox: React.FC<CustomerComboboxProps> = ({
  selectedCustomer,
  onSelect,
  required = true,
  error,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const term = searchTerm.trim();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get<{ customers: CustomerItem[] }>(
          `/customers/search?q=${encodeURIComponent(term)}&limit=10`
        );
        setResults(res.customers || []);
      } catch (err) {
        console.error('Customer search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen]);

  const handleSelectExisting = (customer: CustomerItem) => {
    onSelect({
      id: customer.id,
      name: customer.name,
      phone: customer.phone || undefined,
      isNew: false,
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleSelectNew = () => {
    const trimmed = searchTerm.replace(/\s+/g, ' ').trim();
    if (!trimmed) return;
    onSelect({
      name: trimmed,
      isNew: true,
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onSelect(null);
    setSearchTerm('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const exactMatchExists = results.some(
    (c) => c.name.trim().toLowerCase() === searchTerm.trim().toLowerCase()
  );

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-xs font-semibold text-slate-700">
        العميل {required && <span className="text-red-500">*</span>}
      </label>

      {selectedCustomer ? (
        <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              {selectedCustomer.isNew ? (
                <UserPlus className="w-4 h-4" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 truncate">
                  {selectedCustomer.name}
                </span>
                {selectedCustomer.isNew && (
                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    عميل جديد (سيُحفظ مع الطلب)
                  </span>
                )}
              </div>
              {selectedCustomer.phone && (
                <p className="text-xs text-slate-500 font-mono" dir="ltr">
                  {selectedCustomer.phone}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
            title="تغيير العميل"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="اكتب اسم العميل للبحث أو لإضافته..."
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 ps-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                error
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
              }`}
            />
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {isOpen && (
            <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              {loading && (
                <div className="p-3 text-center text-xs text-slate-500">
                  جاري البحث في قاعدة العملاء...
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="divide-y divide-slate-100">
                  <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    العملاء المسجلون
                  </div>
                  {results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectExisting(c)}
                      className="w-full text-right px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition-colors group"
                    >
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 group-hover:text-slate-950 truncate">
                          {c.name}
                        </span>
                        {c.city && (
                          <span className="text-xs text-slate-400">{c.city}</span>
                        )}
                      </div>
                      {c.phone && (
                        <span className="text-xs text-slate-500 font-mono" dir="ltr">
                          {c.phone}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Add New Customer Option */}
              {searchTerm.trim().length > 1 && !exactMatchExists && (
                <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                  <button
                    type="button"
                    onClick={handleSelectNew}
                    className="w-full text-right p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      + استخدام &quot;{searchTerm.trim()}&quot; كعميل جديد
                    </span>
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1 px-1">
                    * سيتم إنشاء العميل في النظام فقط عند حفظ طلب البيع النهائي.
                  </p>
                </div>
              )}

              {!loading && results.length === 0 && searchTerm.trim().length <= 1 && (
                <div className="p-3 text-center text-xs text-slate-400">
                  ابدأ بالكتابة للبحث عن عميل أو إدخال عميل جديد...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
