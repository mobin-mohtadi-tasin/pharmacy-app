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
    unit_type: 'strip', group_id: '', source_url: '', mrp: '',
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
    if (!localQuery || localQuery.length < 1) { setLocalResults([]); return; }
    const t = setTimeout(async () => {
      setLocalLoading(true);
      const res = await fetch(`/api/medicines?search=${encodeURIComponent(localQuery)}`);
      const data = await res.json();
      setLocalResults(data.data || []);
      setLocalLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [localQuery]);

  const fillFromExternal = async (result) => {
    // Check if exists locally
    const res = await fetch(`/api/medicines?search=${encodeURIComponent(result.name)}`);
    const data = await res.json();
    const existing = (data.data || []).find(m =>
      m.name.toLowerCase() === result.name.toLowerCase() &&
      (!result.strength || m.strength === result.strength)
    );

    if (existing) {
      setForm(f => ({
        ...f, medicine_id: existing.id,
        name: existing.name, generic_name: existing.generic_name || result.generic_name,
        manufacturer: existing.manufacturer || result.manufacturer,
        strength: existing.strength || result.strength,
        dosage_form: existing.dosage_form || result.dosage_form,
        unit_type: existing.unit_type, group_id: existing.group_id || '',
        source_url: existing.source_url || result.source_url,
        isNew: false,
      }));
      show(`Found in local inventory — adding to existing stock`, 'info');
    } else {
      setForm(f => ({
        ...f, medicine_id: '',
        name: result.name, generic_name: result.generic_name,
        manufacturer: result.manufacturer, strength: result.strength,
        dosage_form: result.dosage_form, source_url: result.source_url,
        isNew: true,
      }));
    }
    window.scrollTo({ top: document.getElementById('stock-form')?.offsetTop - 20, behavior: 'smooth' });
  };

  const fillFromLocal = (med) => {
    setForm(f => ({
      ...f, medicine_id: med.id,
      name: med.name, generic_name: med.generic_name || '',
      manufacturer: med.manufacturer || '', strength: med.strength || '',
      dosage_form: med.dosage_form || '', unit_type: med.unit_type,
      group_id: med.group_id || '', source_url: med.source_url || '',
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
          <div className="flex rounded-lg overflow-hidden border border-[#253d28]">
            <button
              onClick={() => setTab('local')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'local' ? 'bg-brand-600 text-white' : 'bg-[#131f17] text-gray-400 hover:text-gray-200'}`}
            >📦 Local Inventory</button>
            <button
              onClick={() => setTab('external')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'external' ? 'bg-brand-600 text-white' : 'bg-[#131f17] text-gray-400 hover:text-gray-200'}`}
            >🌐 Search MedEx</button>
          </div>

          {tab === 'local' && (
            <div className="card p-4 space-y-3">
              <label className="label">Search existing medicines</label>
              <input
                type="text" className="input" placeholder="Type medicine name…"
                value={localQuery} onChange={e => setLocalQuery(e.target.value)}
              />
              {localLoading && <div className="text-xs text-gray-500">Searching…</div>}
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {localResults.map(med => (
                  <button key={med.id} onClick={() => fillFromLocal(med)}
                    className="w-full text-left p-3 rounded-lg hover:bg-[#1d3021] transition-colors border border-transparent hover:border-[#253d28]">
                    <div className="text-sm font-medium text-gray-100">{med.name} {med.strength && <span className="text-gray-400 font-normal">{med.strength}</span>}</div>
                    <div className="text-xs text-gray-500">Stock: {med.current_stock} · Avg cost: ৳{Number(med.avg_cost_price).toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'external' && (
            <div className="card p-4 space-y-3">
              <label className="label">Search MedEx (requires internet)</label>
              <div className="flex gap-2">
                <input
                  type="text" className="input" placeholder="e.g. Napa, Sergel, Ciprocin…"
                  value={extQuery} onChange={e => setExtQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchExternal()}
                />
                <button onClick={searchExternal} disabled={extLoading} className="btn-primary px-4">
                  {extLoading ? '…' : '🔍'}
                </button>
              </div>
              {extError && <p className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded">⚠ {extError}</p>}
              {extFromCache && <p className="text-[10px] text-gray-500">Showing cached results</p>}
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {extResults.map((r, i) => (
                  <button key={i} onClick={() => fillFromExternal(r)}
                    className="w-full text-left p-3 rounded-lg hover:bg-[#1d3021] transition-colors border border-transparent hover:border-[#253d28]">
                    <div className="text-sm font-medium text-gray-100">{r.name} <span className="text-gray-400 font-normal text-xs">{r.strength}</span></div>
                    <div className="text-xs text-gray-500">{r.generic_name} · {r.manufacturer}</div>
                    <div className="text-[10px] text-gray-600">{r.dosage_form}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Stock-In form */}
        <div className="xl:col-span-3">
          <form id="stock-form" onSubmit={handleSubmit} className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-200 flex items-center gap-2">
              {form.isNew ? '➕ New Medicine + Stock In' : '📦 Add Stock to Existing Medicine'}
            </h2>

            {priceWarning && (
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 text-xs text-yellow-300">
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
              </div>

              <div className="col-span-2 border-t border-[#1d3021] pt-3">
                <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Stock-In Details</p>
              </div>

              <div>
                <label className="label">Cost Price / Unit (৳) *</label>
                <input required type="number" step="0.01" min="0" className="input" value={form.cost_price} onChange={e => setF('cost_price', e.target.value)} placeholder="0.00" />
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
                  <a href={form.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline break-all">{form.source_url} ↗</a>
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
            <p className="text-lg font-semibold text-white">{successModal.medicine.name}</p>
            <p className="text-gray-400 text-sm">{successModal.qty} units added</p>
            <p className="text-brand-400 font-medium">New stock: {successModal.medicine.current_stock}</p>
            <button onClick={() => setSuccessModal(null)} className="btn-primary w-full justify-center mt-4">Done</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
