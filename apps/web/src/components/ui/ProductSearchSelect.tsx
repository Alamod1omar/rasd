'use client';

import React, { useState, useEffect, useRef, RefObject } from 'react';
import { api } from '@/lib/api';
import { Product } from '@/types';
import { Search, Loader2, Check, AlertCircle } from 'lucide-react';

interface ProductSearchSelectProps {
  onSelect: (product: {
    productId?: string;
    partNumber: string;
    partName: string;
    brand: string;
    availableBrands?: string[];
  }) => void;
  // Support both old (selectedPartNumber) and new (value) prop names
  selectedPartNumber?: string;
  value?: string;
  onChange?: (val: string) => void;
  selectedBrand?: string;
  brand?: string;
  onBrandChange: (brand: string) => void;
  inputRef?: RefObject<HTMLInputElement>;
}

export const ProductSearchSelect: React.FC<ProductSearchSelectProps> = ({
  onSelect,
  selectedPartNumber,
  value,
  onChange,
  selectedBrand,
  brand,
  onBrandChange,
  inputRef,
}) => {
  // Support both old and new prop naming conventions
  const partNumberValue = value ?? selectedPartNumber ?? '';
  const brandValue = brand ?? selectedBrand ?? '';

  const [query, setQuery] = useState(partNumberValue);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal query with prop when modal opens/clears
  useEffect(() => {
    setQuery(partNumberValue);
    if (!partNumberValue) {
      setAvailableBrands([]);
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [partNumberValue]);

  // Debounced catalog search
  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.get<Product[]>(`/products/search?q=${encodeURIComponent(query.trim())}`);
        setSearchResults(results);
        setHasSearched(true);
      } catch (e) {
        console.error('Failed to search products', e);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = async (product: Product) => {
    setQuery(product.partNumber);
    setIsOpen(false);

    // Fetch brands available for this exact part number
    try {
      const brandsData = await api.get<Product[]>(
        `/products/brands-by-part?partNumber=${encodeURIComponent(product.partNumber)}`,
      );
      const brands = Array.from(new Set(brandsData.map((b) => b.brand)));
      setAvailableBrands(brands);

      const chosenBrand = brands.includes(product.brand) ? product.brand : brands[0] || product.brand;
      onBrandChange(chosenBrand);

      onSelect({
        productId: product.id,
        partNumber: product.partNumber,
        partName: product.partName,
        brand: chosenBrand,
        availableBrands: brands,
      });
    } catch (e) {
      setAvailableBrands([product.brand]);
      onBrandChange(product.brand);
      onSelect({
        productId: product.id,
        partNumber: product.partNumber,
        partName: product.partName,
        brand: product.brand,
        availableBrands: [product.brand],
      });
    }
  };

  return (
    <div className="space-y-3" ref={dropdownRef}>
      {/* Part Number Search Input */}
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          رقم القطعة <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            dir="ltr"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              setIsOpen(true);
              if (onChange) onChange(val);
            }}
            onFocus={() => {
              if (query.trim().length > 0) setIsOpen(true);
            }}
            placeholder="ابحث برقم القطعة (مثال: 7N1234)..."
            className="w-full font-mono text-sm rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pl-10 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Dropdown Results */}
        {isOpen && query.trim().length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            {searchResults.length > 0 ? (
              searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProduct(p)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-right hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex flex-col text-right">
                    <span className="font-mono font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors text-left" dir="ltr">
                      {p.partNumber}
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5">{p.partName}</span>
                    {p.matchedViaAlternative && (
                      <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-1 inline-flex items-center gap-1 self-start">
                        <span>تم العثور بواسطة الرقم البديل:</span>
                        <span className="font-mono font-bold" dir="ltr">
                          {p.matchedViaAlternative}
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                    {p.brand}
                  </span>
                </button>
              ))
            ) : hasSearched && !loading ? (
              <div className="p-3 text-center text-xs text-amber-700 bg-amber-50 rounded-lg flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>القطعة غير موجودة في دليل المنتجات</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Brand Selector - Strictly Filtered to Brands Available for Selected Part */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          الماركة <span className="text-rose-500">*</span>
        </label>
        {availableBrands.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableBrands.map((b) => {
              const isSelected = brandValue === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => onBrandChange(b)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {b}
                  {isSelected && <Check className="w-3 h-3 inline-block mr-1 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type="text"
            value={brandValue}
            onChange={(e) => onBrandChange(e.target.value)}
            placeholder="حدد القطعة أولاً لتصفية الماركات أو اكتب الماركة"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        )}
      </div>
    </div>
  );
};
