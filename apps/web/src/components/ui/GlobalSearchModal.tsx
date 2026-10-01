'use client';

import React, { useState, useEffect } from 'react';
import { RasdModal } from './RasdModal';
import { api } from '@/lib/api';
import { Search, Loader2, ArrowLeft, FileText, AlertTriangle, Box } from 'lucide-react';
import Link from 'next/link';
import { SarAmount } from './SarSymbol';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    products: any[];
    sales: any[];
    shortages: any[];
  }>({ products: [], sales: [], shortages: [] });

  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setResults({ products: [], sales: [], shortages: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data);
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <RasdModal isOpen={isOpen} onClose={onClose} title="البحث الشامل في النظام" maxWidth="xl">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث برقم القطعة، رقم الطلب، اسم العميل، أو رقم الفاتورة..."
            autoFocus
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </div>
        </div>

        {/* Results Sections */}
        <div className="max-h-[60vh] overflow-y-auto space-y-6 pt-2">
          {/* Products */}
          {results.products.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Box className="w-4 h-4 text-slate-400" />
                <span>دليل المنتجات ({results.products.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.products.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-right"
                  >
                    <div>
                      <span className="font-mono font-bold text-sm text-slate-900" dir="ltr">
                        {p.partNumber}
                      </span>
                      <span className="text-xs text-slate-500 mr-2">— {p.partName}</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {p.brand}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sales */}
          {results.sales.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>طلبات المبيعات ({results.sales.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.sales.map((s) => (
                  <Link
                    key={s.id}
                    href={`/sales/${s.id}`}
                    onClick={onClose}
                    className="p-3 bg-white hover:bg-emerald-50/40 border border-slate-100 hover:border-emerald-200 rounded-xl flex items-center justify-between text-right transition-all group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900 group-hover:text-emerald-700" dir="ltr">
                          {s.documentNumber}
                        </span>
                        <span className="text-xs text-slate-400">({s.branchName})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{s.itemsCount} أصناف</span>
                        <span>•</span>
                        <span>{s.totalQuantity} قطع</span>
                        <span>•</span>
                        <SarAmount amount={s.totalAmount} size="sm" />
                        {s.officialInvoiceNumber && (
                          <span className="mr-2 text-emerald-700 font-medium">
                            [فاتورة: {s.officialInvoiceNumber}]
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Shortages */}
          {results.shortages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>طلبات النواقص ({results.shortages.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.shortages.map((sh) => (
                  <Link
                    key={sh.id}
                    href={`/shortages/${sh.id}`}
                    onClick={onClose}
                    className="p-3 bg-white hover:bg-rose-50/40 border border-slate-100 hover:border-rose-200 rounded-xl flex items-center justify-between text-right transition-all group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900 group-hover:text-rose-700" dir="ltr">
                          {sh.documentNumber}
                        </span>
                        <span className="text-xs text-slate-400">({sh.branchName})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {sh.itemsCount} أصناف • {sh.totalQuantity} قطعة مطلوبة
                      </div>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {query.trim().length > 0 &&
            !loading &&
            results.products.length === 0 &&
            results.sales.length === 0 &&
            results.shortages.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-500">
                لا توجد نتائج مطابقة لبحثك
              </div>
            )}
        </div>
      </div>
    </RasdModal>
  );
};
