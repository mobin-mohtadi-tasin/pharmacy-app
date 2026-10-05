'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

export default function StockInPage() {
  const [tab, setTab] = useState('local'); // 'external' | 'local'
  const [groups, setGroups] = useState([]);
  const [extQuery, setExtQuery] = useState('');
  const [extResults, setExtResults] = useState([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState('');
  const [extFromCache, setExtFromCache] = useState(false);

  // Local medicine search
  const [localQuery, setLocalQuery] = useState('');
  const [localResults, setLocalResults] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);

  const [form, setForm] = useState({
    medicine_id: '',
    name: '', generic_name: '', manufacturer: '', strength: '', dosage_form: '',
    unit_type: 'strip', group_id: '', source_url: '', mrp: '', selling_price: '',
    cost_price: '', quantity: '', batch_no: '', expiry_date: '', supplier: '',
    date: new Date().toISOString().slice(0, 10),
    isNew: true,
  });
  const [priceWarning, setPriceWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const { show, ToastEl } = useToast();

  useEffect(() => {
    fetch('/api/groups').then(r => r.json()).then(r => setGroups(r.data || []));
  }, []);

  // External search
  const searchExternal = async () => {
    if (!extQuery.trim() || extQuery.length < 2) return;
    setExtLoading(true); setExtError(''); setExtResults([]);
    try {
      const res = await fetch(`/api/medicines/search-external?q=${encodeURIComponent(extQuery)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtResults(data.data.results || []);
      setExtFromCache(data.data.fromCache);
      if (data.data.error) setExtError(data.data.error);
    } catch (e) {
      setExtError(e.message || 'Search failed');
    } finally { setExtLoading(false); }
  };

  // Local search
  useEffect(() => {
    if (!localQuery || localQuery.length < 1) return;
    const t = setTimeout(async () => {
      setLocalLoading(true);
      const res = await fetch(`/api/medicines?search=${encodeURIComponent(localQuery)}`);
      const data = await res.json();
      setLocalResults(data.data || []);
      setLocalLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [localQuery]);

  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [autoFilledInfo, setAutoFilledInfo] = useState(null);

  const fillFromExternal = async (result) => {
    setFetchingDetails(true);
    setAutoFilledInfo(null);

    // Initial immediate populate with basic info
    setForm(f => ({
      ...f,
      medicine_id: '',
      name: result.name || '',
      generic_name: result.generic_name || '',
      manufacturer: result.manufacturer || '',
      strength: result.strength || '',
      dosage_form: result.dosage_form || '',
      source_url: result.source_url || '',
      isNew: true,
    }));

    try {
      // 1. Check if exists locally in DB
      let existing = null;
      try {
        const res = await fetch(`/api/medicines?search=${encodeURIComponent(result.name)}`);
        const data = await res.json();
        existing = (data.data || []).find(m =>
          m.name.toLowerCase() === result.name.toLowerCase() &&
          (!result.strength || m.strength === result.strength)
        );
      } catch (err) {
        console.warn('Local search lookup failed:', err);
      }

      // If exists locally, pre-populate existing data
      if (existing) {
        setForm(f => ({
          ...f,
          medicine_id: existing.id,
          name: existing.name,
          generic_name: existing.generic_name || result.generic_name || '',
          manufacturer: existing.manufacturer || result.manufacturer || '',
          strength: existing.strength || result.strength || '',
          dosage_form: existing.dosage_form || result.dosage_form || '',
          unit_type: existing.unit_type || 'strip',
          group_id: existing.group_id || '',
          source_url: existing.source_url || result.source_url || '',
          mrp: existing.mrp ? String(existing.mrp) : '',
          selling_price: existing.last_selling_price ? String(existing.last_selling_price) : '',
          cost_price: existing.avg_cost_price ? String(existing.avg_cost_price) : '',
          isNew: false,
        }));
      }

      // 2. Fetch live MedEx details (pricing, therapeutic group, unit type)
      if (result.source_url) {
        const extRes = await fetch(
          `/api/medicines/fetch-external?url=${encodeURIComponent(result.source_url)}&name=${encodeURIComponent(result.name || '')}&generic_name=${encodeURIComponent(result.generic_name || '')}`
        );
        const extData = await extRes.json();
        if (extRes.ok && extData.data) {
          const d = extData.data;

          setForm(f => ({
            ...f,
            // Group: if not set locally or is new, use auto-matched group
            group_id: (!existing || !f.group_id) && d.group_id ? d.group_id : f.group_id,
            // Cost price: if new or no cost price yet, auto-fill trade cost price (~88% MRP)
            cost_price: (!existing || !f.cost_price) && d.cost_price ? String(d.cost_price) : f.cost_price,
            // Selling price: MRP/unit price
            selling_price: (!existing || !f.selling_price) && d.selling_price ? String(d.selling_price) : f.selling_price,
            // MRP
            mrp: (!existing || !f.mrp) && d.mrp ? String(d.mrp) : f.mrp,
            // Unit type: strip, bottle, piece
            unit_type: (!existing) && d.unit_type ? d.unit_type : f.unit_type,
            dosage_form: f.dosage_form || d.dosage_form || '',
            strength: f.strength || d.strength || '',
            manufacturer: f.manufacturer || d.manufacturer || '',
          }));

          setAutoFilledInfo({
            group_name: d.group_name,
            cost_price: d.cost_price,
            mrp: d.mrp,
            unit_price: d.unit_price,
            unit_type: d.unit_type,
          });

          const summaryParts = [];
          if (d.group_name) summaryParts.push(`Group: ${d.group_name}`);
          if (d.cost_price) summaryParts.push(`Cost: ৳${d.cost_price}`);
          if (d.selling_price) summaryParts.push(`Selling: ৳${d.selling_price}`);

          show(
            `⚡ Auto-filled: ${summaryParts.join(' · ') || 'MedEx details loaded'}`,
            'success'
          );
        } else if (existing) {
          show('Found in local inventory — adding to existing stock', 'info');
        }
      } else if (existing) {
        show('Found in local inventory — adding to existing stock', 'info');
      }
    } catch (e) {
      console.error('Error fetching external details:', e);
      show('Could not fetch MedEx details: ' + e.message, 'warning');
    } finally {
      setFetchingDetails(false);
    }

    window.scrollTo({ top: (document.getElementById('stock-form')?.offsetTop || 0) - 20, behavior: 'smooth' });
  };

  const fillFromLocal = (med) => {
    setAutoFilledInfo(null);
    setForm(f => ({
      ...f, medicine_id: med.id,
      name: med.name, generic_name: med.generic_name || '',
      manufacturer: med.manufacturer || '', strength: med.strength || '',
      dosage_form: med.dosage_form || '', unit_type: med.unit_type,
      group_id: med.group_id || '', source_url: med.source_url || '',
      mrp: med.mrp || '', selling_price: med.last_selling_price || '',
      isNew: false,
    }));
    setLocalQuery(''); setLocalResults([]);
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cost_price || !form.quantity) return show('Cost price and quantity are required', 'error');
    if (parseFloat(form.quantity) <= 0) return show('Quantity must be positive', 'error');
    setSubmitting(true); setPriceWarning(null);

    try {
      // Step 1: Create medicine if new
      let medicineId = form.medicine_id;
      if (form.isNew || !medicineId) {
        if (!form.name.trim()) return show('Medicine name is required', 'error');
        const res = await fetch('/api/medicines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name, generic_name: form.generic_name,
            manufacturer: form.manufacturer, strength: form.strength,
            dosage_form: form.dosage_form, unit_type: form.unit_type,
            group_id: form.group_id || null, source_url: form.source_url,
            mrp: form.mrp ? parseFloat(form.mrp) : null,
            selling_price: form.selling_price ? parseFloat(form.selling_price) : (form.mrp ? parseFloat(form.mrp) : null),
            avg_cost_price: parseFloat(form.cost_price),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error?.includes('already exists')) {
            show('Medicine exists — select it from local search instead', 'warning');
          } else throw new Error(data.error);
          return;
        }
        medicineId = data.data.id;
      }

      // Step 2: Stock in
      const res = await fetch('/api/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicine_id: medicineId,
          quantity: parseInt(form.quantity),
          cost_price: parseFloat(form.cost_price),
          batch_no: form.batch_no || undefined,
          expiry_date: form.expiry_date || undefined,
          supplier: form.supplier || undefined,
          date: form.date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.data.price_change_warning) {
        setPriceWarning({ old: data.data.old_avg_cost, new: data.data.new_avg_cost });
      }

      setSuccessModal({ medicine: data.data.medicine, qty: parseInt(form.quantity) });
      setAutoFilledInfo(null);
      // Reset form fields (keep group)
      setForm(f => ({ ...f, medicine_id: '', name: '', generic_name: '', manufacturer: '', strength: '', dosage_form: '', source_url: '', cost_price: '', quantity: '', batch_no: '', expiry_date: '', supplier: '', isNew: true }));
    } catch (e) {
      show(e.message, 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      {ToastEl}
      <div className="page-header">
        <h1 className="page-title">Stock In</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left: Medicine search */}
        <div className="xl:col-span-2 space-y-4">
          {/* Tab switch */}
          <div className="flex gap-1 p-1 rounded-xl bg-white border border-slate-200 shadow-sm">
            <button
              onClick={() => setTab('local')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${tab === 'local' ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md shadow-sky-500/30' : 'text-slate-500 hover:text-sky-700 hover:bg-sky-50'}`}
            >📦 Local Inventory</button>
            <button
              onClick={() => setTab('external')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${tab === 'external' ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/30' : 'text-slate-500 hover:text-violet-700 hover:bg-violet-50'}`}
            >🌐 Search MedEx</button>
          </div>

          {tab === 'local' && (
            <div className="card p-4 space-y-3">
              <label className="label">Search existing medicines</label>
              <input
                type="text" className="input" placeholder="Type medicine name…"
                value={localQuery} onChange={e => { setLocalQuery(e.target.value); if (!e.target.value) setLocalResults([]); }}
              />
              {localLoading && <div className="text-xs text-slate-500">Searching…</div>}
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {localResults.map(med => (
                  <button key={med.id} onClick={() => fillFromLocal(med)}
                    className="w-full text-left p-3 rounded-lg hover:bg-sky-50 transition-colors border border-transparent hover:border-sky-200">
                    <div className="text-sm font-medium text-slate-800">{med.name} {med.strength && <span className="text-slate-500 font-normal">{med.strength}</span>}</div>
                    <div className="text-xs text-slate-500">Stock: {med.current_stock} · Avg cost: ৳{Number(med.avg_cost_price).toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'external' && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="label mb-0">Search MedEx (requires internet)</label>
                <span className="text-[10px] text-brand-600 font-medium bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                  Auto Group & Cost
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text" className="input" placeholder="e.g. Napa, Sergel, Ciprocin…"
                  value={extQuery} onChange={e => setExtQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchExternal()}
                />
                <button onClick={searchExternal} disabled={extLoading} className="btn-violet px-4">
                  {extLoading ? '…' : '🔍'}
                </button>
              </div>
              {extError && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">⚠ {extError}</p>}
              {extFromCache && <p className="text-[10px] text-slate-500">Showing cached results</p>}
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {extResults.map((r, i) => (
                  <button key={i} onClick={() => fillFromExternal(r)} disabled={fetchingDetails}
                    className="w-full text-left p-3 rounded-lg hover:bg-violet-50 transition-colors border border-transparent hover:border-violet-200 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-slate-800 group-hover:text-violet-700 transition-colors">
                        {r.name} <span className="text-slate-500 font-normal text-xs">{r.strength}</span>
                      </div>
                      <span className="text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200 opacity-80 group-hover:opacity-100">
                        ⚡ Auto-fill
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{r.generic_name} · {r.manufacturer}</div>
                    <div className="text-[10px] text-slate-400">{r.dosage_form}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Stock-In form */}
        <div className="xl:col-span-3">
          <form id="stock-form" onSubmit={handleSubmit} className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-2">
                {form.isNew ? '➕ New Medicine + Stock In' : '📦 Add Stock to Existing Medicine'}
              </span>
              {fetchingDetails && (
                <span className="text-xs font-normal bg-brand-50 text-brand-700 border border-brand-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping"></span>
                  Fetching MedEx Group & Cost…
                </span>
              )}
            </h2>

            {priceWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-600">
                ⚠ Cost price changed significantly: Old avg ৳{Number(priceWarning.old).toFixed(2)} → New avg ৳{Number(priceWarning.new).toFixed(2)}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Medicine Name *</label>
                <input required className="input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Napa" readOnly={!form.isNew && !!form.medicine_id} />
              </div>
              <div>
                <label className="label">Generic Name</label>
                <input className="input" value={form.generic_name} onChange={e => setF('generic_name', e.target.value)} placeholder="e.g. Paracetamol" />
              </div>
              <div>
                <label className="label">Manufacturer</label>
                <input className="input" value={form.manufacturer} onChange={e => setF('manufacturer', e.target.value)} placeholder="e.g. Beximco" />
              </div>
              <div>
                <label className="label">Strength</label>
                <input className="input" value={form.strength} onChange={e => setF('strength', e.target.value)} placeholder="e.g. 500 mg" />
              </div>
              <div>
                <label className="label">Dosage Form</label>
                <input className="input" value={form.dosage_form} onChange={e => setF('dosage_form', e.target.value)} placeholder="Tablet, Syrup…" />
              </div>
              <div>
                <label className="label">Unit Type</label>
                <select className="input" value={form.unit_type} onChange={e => setF('unit_type', e.target.value)}>
                  {['strip', 'piece', 'box', 'bottle'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Group</label>
                <select className="input" value={form.group_id} onChange={e => setF('group_id', e.target.value)}>
                  <option value="">— Select group —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                {autoFilledInfo?.group_name && form.group_id && (
                  <div className="text-[11px] text-brand-600 flex items-center gap-1 mt-1 font-medium">
                    ⚡ Auto-matched: {autoFilledInfo.group_name}
                  </div>
                )}
              </div>

              <div className="col-span-2 border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wide">Stock-In Details</p>
              </div>

              <div>
                <label className="label">Cost Price / Unit (৳) *</label>
                <input required type="number" step="0.01" min="0" className="input" value={form.cost_price} onChange={e => setF('cost_price', e.target.value)} placeholder="0.00" />
                {autoFilledInfo?.cost_price && form.cost_price && (
                  <div className="text-[11px] text-brand-600 flex items-center gap-1 mt-1 font-medium">
                    ⚡ Auto-filled trade cost (~88% of MedEx MRP ৳{autoFilledInfo.mrp || autoFilledInfo.unit_price})
                  </div>
                )}
              </div>
              <div>
                <label className="label">Selling Price / Unit (৳)</label>
                <input type="number" step="0.01" min="0" className="input" value={form.selling_price} onChange={e => setF('selling_price', e.target.value)} placeholder="Optional" />
                {autoFilledInfo?.selling_price && form.selling_price && (
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                    ⚡ Retail MRP from MedEx: ৳{autoFilledInfo.selling_price}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Quantity *</label>
                <input required type="number" min="1" className="input" value={form.quantity} onChange={e => setF('quantity', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="label">MRP / Unit (৳)</label>
                <input type="number" step="0.01" min="0" className="input" value={form.mrp} onChange={e => setF('mrp', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={form.date} onChange={e => setF('date', e.target.value)} />
              </div>
              <div>
                <label className="label">Batch Number</label>
                <input className="input" value={form.batch_no} onChange={e => setF('batch_no', e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="label">Expiry Date</label>
                <input type="date" className="input" value={form.expiry_date} onChange={e => setF('expiry_date', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Supplier</label>
                <input className="input" value={form.supplier} onChange={e => setF('supplier', e.target.value)} placeholder="Supplier name (optional)" />
              </div>
              {form.source_url && (
                <div className="col-span-2">
                  <label className="label">Source URL</label>
                  <a href={form.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline break-all">{form.source_url} ↗</a>
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full btn-lg justify-center">
              {submitting ? 'Saving…' : '✓ Save Stock In'}
            </button>
          </form>
        </div>
      </div>

      <Modal isOpen={!!successModal} onClose={() => setSuccessModal(null)} title="Stock In Recorded!" size="sm">
        {successModal && (
          <div className="text-center space-y-3">
            <div className="text-5xl">✅</div>
            <p className="text-lg font-semibold text-slate-800">{successModal.medicine.name}</p>
            <p className="text-slate-500 text-sm">{successModal.qty} units added</p>
            <p className="text-brand-600 font-medium">New stock: {successModal.medicine.current_stock}</p>
            <button onClick={() => setSuccessModal(null)} className="btn-primary w-full justify-center mt-4">Done</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
