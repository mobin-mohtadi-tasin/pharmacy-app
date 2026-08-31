'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Reusable typeahead search for local medicines.
 * Props:
 *   onSelect(medicine) — called when user picks a result
 *   placeholder — input placeholder
 *   groupId — optional filter by group
 *   autoFocus — focus input on mount
 */
export default function MedicineSearch({ onSelect, placeholder = 'Search medicine...', groupId = '', autoFocus = false, className = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const search = useCallback(async (q) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: q, ...(groupId ? { group_id: groupId } : {}) });
      const res = await fetch(`/api/medicines?${params}`);
      const data = await res.json();
      setResults(data.data || []);
      setOpen(true);
      setActiveIdx(0);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [groupId]);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 200);
  };

  const handleKey = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIdx]) {
        handleSelect(results[activeIdx]);
      }
    }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const handleSelect = (med) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect(med);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => query && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="input pr-8"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-40 w-full mt-1 bg-[#0f1812] border border-[#253d28] rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {results.map((med, i) => (
            <button
              key={med.id}
              onMouseDown={() => handleSelect(med)}
              className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${i === activeIdx ? 'bg-brand-600/20 text-brand-300' : 'hover:bg-[#1d3021] text-gray-200'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{med.name}</span>
                  {med.strength && <span className="text-xs text-gray-400 shrink-0">{med.strength}</span>}
                </div>
                <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                  {med.generic_name && <span>{med.generic_name}</span>}
                  {med.group_name && <span className="text-brand-600">· {med.group_name}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-xs font-medium ${med.current_stock <= med.low_stock_threshold ? 'text-red-400' : 'text-gray-400'}`}>
                  Stock: {med.current_stock}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 1 && results.length === 0 && !loading && (
        <div className="absolute z-40 w-full mt-1 bg-[#0f1812] border border-[#253d28] rounded-xl shadow-2xl px-4 py-3 text-sm text-gray-500">
          No medicines found for "{query}"
        </div>
      )}
    </div>
  );
}
