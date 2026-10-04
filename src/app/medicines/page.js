'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, med: null });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [historyModal, setHistoryModal] = useState({ open: false, med: null, history: [] });
  const { show, ToastEl } = useToast();

  const loadMedicines = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (groupFilter) params.set('group_id', groupFilter);
    if (lowStock) params.set('low_stock', 'true');
    const res = await fetch(`/api/medicines?${params}`);
    const data = await res.json();
    setMedicines(data.data || []);
    setLoading(false);
  }, [search, groupFilter, lowStock]);

  useEffect(() => {
    let ignore = false;
    const fetchMeds = async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (groupFilter) params.set('group_id', groupFilter);
      if (lowStock) params.set('low_stock', 'true');
      const res = await fetch(`/api/medicines?${params}`);
      const data = await res.json();
      if (!ignore) {
        setMedicines(data.data || []);
        setLoading(false);
      }
    };
    fetchMeds();
    return () => { ignore = true; };
  }, [search, groupFilter, lowStock]);

  useEffect(() => {
    fetch('/api/groups').then(r => r.json()).then(r => setGroups(r.data || []));
  }, []);

  const handleEdit = async (e) => {
    e.preventDefault();
    const f = editModal.med;
    const res = await fetch(`/api/medicines/${f.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    const data = await res.json();
    if (!res.ok) return show(data.error, 'error');
    show('Medicine updated', 'success');
    setEditModal({ open: false, med: null });
    loadMedicines();
  };

  const handleDelete = async (id) => {
    const res = await fetch(`/api/medicines/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return show(data.error, 'error');
    show('Medicine deleted', 'success');
    setDeleteConfirm(null);
    loadMedicines();
  };

  const showHistory = async (med) => {
    const res = await fetch(`/api/stock-in/history?medicine_id=${med.id}`);
    const data = await res.json();
    setHistoryModal({ open: true, med, history: data.data || [] });
  };

  const setMedField = (k, v) => setEditModal(prev => ({ ...prev, med: { ...prev.med, [k]: v } }));

  const stockColor = (med) => {
    if (med.current_stock === 0) return 'text-red-400 font-bold';
    if (med.current_stock <= med.low_stock_threshold) return 'text-yellow-400 font-bold';
    return 'text-brand-400';
  };

  return (
    <div>
      {ToastEl}
      <div className="page-header">
        <h1 className="page-title">Medicines</h1>
        <Link href="/stock-in" className="btn-primary">+ Add Medicine</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40">
          <label className="label">Search</label>
          <input className="input" placeholder="Name, generic, manufacturer…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="w-44">
          <label className="label">Group</label>
          <select className="input" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-0.5">
          <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} className="rounded text-brand-600" />
          <span className="text-sm text-gray-300">Low stock only</span>
        </label>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Generic</th>
              <th>Group</th>
              <th>Unit</th>
              <th>Stock</th>
              <th>Avg Cost</th>
              <th>Selling Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-500">Loading…</td></tr>
            ) : medicines.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-500">No medicines found</td></tr>
            ) : medicines.map(med => (
              <tr key={med.id}>
                <td>
                  <div className="font-medium text-gray-100">{med.name}</div>
                  <div className="text-xs text-gray-500">{med.strength} {med.dosage_form && `· ${med.dosage_form}`}</div>
                  {med.manufacturer && <div className="text-[10px] text-gray-600">{med.manufacturer}</div>}
                  {med.source_url && (
                    <a href={med.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-600 hover:underline">MedEx ↗</a>
                  )}
                </td>
                <td className="text-gray-400 text-sm">{med.generic_name || '—'}</td>
                <td>{med.group_name ? <span className="badge-green">{med.group_name}</span> : <span className="text-gray-600">—</span>}</td>
                <td className="text-gray-400 text-xs">{med.unit_type}</td>
                <td>
                  <span className={stockColor(med)}>{med.current_stock}</span>
                  {med.current_stock <= med.low_stock_threshold && (
                    <span className="ml-1 text-[10px] text-yellow-600">low</span>
                  )}
                </td>
                <td className="text-gray-300">৳{Number(med.avg_cost_price).toFixed(2)}</td>
                <td className="text-gray-300">{med.last_selling_price ? `৳${Number(med.last_selling_price).toFixed(2)}` : '—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => showHistory(med)} className="btn-secondary btn-sm" title="Stock history">📋</button>
                    <button onClick={() => setEditModal({ open: true, med: { ...med } })} className="btn-secondary btn-sm">Edit</button>
                    <button onClick={() => setDeleteConfirm(med)} className="btn-danger btn-sm">Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editModal.open} onClose={() => setEditModal({ open: false, med: null })} title="Edit Medicine" size="lg">
        {editModal.med && (
          <form onSubmit={handleEdit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Name</label><input required className="input" value={editModal.med.name} onChange={e => setMedField('name', e.target.value)} /></div>
            <div><label className="label">Generic Name</label><input className="input" value={editModal.med.generic_name || ''} onChange={e => setMedField('generic_name', e.target.value)} /></div>
            <div><label className="label">Manufacturer</label><input className="input" value={editModal.med.manufacturer || ''} onChange={e => setMedField('manufacturer', e.target.value)} /></div>
            <div><label className="label">Strength</label><input className="input" value={editModal.med.strength || ''} onChange={e => setMedField('strength', e.target.value)} /></div>
            <div><label className="label">Dosage Form</label><input className="input" value={editModal.med.dosage_form || ''} onChange={e => setMedField('dosage_form', e.target.value)} /></div>
            <div><label className="label">Unit Type</label>
              <select className="input" value={editModal.med.unit_type} onChange={e => setMedField('unit_type', e.target.value)}>
                {['strip','piece','box','bottle'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="label">Group</label>
              <select className="input" value={editModal.med.group_id || ''} onChange={e => setMedField('group_id', e.target.value)}>
                <option value="">— None —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div><label className="label">MRP</label><input type="number" step="0.01" className="input" value={editModal.med.mrp || ''} onChange={e => setMedField('mrp', e.target.value)} /></div>
            <div><label className="label">Selling Price</label><input type="number" step="0.01" className="input" value={editModal.med.last_selling_price || ''} onChange={e => setMedField('last_selling_price', e.target.value)} placeholder="0.00" /></div>
            <div><label className="label">Low Stock Threshold</label><input type="number" className="input" value={editModal.med.low_stock_threshold || 10} onChange={e => setMedField('low_stock_threshold', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Source URL</label><input className="input" value={editModal.med.source_url || ''} onChange={e => setMedField('source_url', e.target.value)} /></div>
            <div className="col-span-2 flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1 justify-center">Save Changes</button>
              <button type="button" onClick={() => setEditModal({ open: false, med: null })} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Medicine" size="sm">
        <p className="text-gray-300 mb-4">Delete <strong className="text-white">{deleteConfirm?.name}</strong>? This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={() => handleDelete(deleteConfirm.id)} className="btn-danger flex-1 justify-center">Delete</button>
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={historyModal.open} onClose={() => setHistoryModal(p => ({ ...p, open: false }))} title={`Stock History — ${historyModal.med?.name}`} size="lg">
        {historyModal.history.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No stock-in records</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Qty</th><th>Cost/Unit</th><th>Batch</th><th>Expiry</th><th>Supplier</th></tr></thead>
              <tbody>
                {historyModal.history.map(h => (
                  <tr key={h.id}>
                    <td>{h.date}</td>
                    <td className="text-brand-400 font-medium">+{h.quantity}</td>
                    <td>৳{Number(h.cost_price).toFixed(2)}</td>
                    <td className="text-gray-400">{h.batch_no || '—'}</td>
                    <td className="text-gray-400">{h.expiry_date || '—'}</td>
                    <td className="text-gray-400">{h.supplier || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
