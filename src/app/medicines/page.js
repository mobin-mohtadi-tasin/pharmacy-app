'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

export function getExpiryInfo(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = expiryDate.split('-');
  if (parts.length < 2) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;
  const exp = new Date(year, month, day);
  exp.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return {
      status: 'expired',
      days: diffDays,
      badgeText: `Expired (${daysAgo}d ago)`,
      badgeClass: 'bg-red-50 text-red-700 border-red-300 font-semibold',
      dotClass: 'bg-red-500',
      isWithin3Months: true,
      isExpired: true,
    };
  }

  if (diffDays <= 30) {
    return {
      status: 'critical',
      days: diffDays,
      badgeText: diffDays === 0 ? 'Expires today!' : `Expires in ${diffDays}d`,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold animate-pulse',
      dotClass: 'bg-rose-500',
      isWithin3Months: true,
      isExpired: false,
    };
  }

  if (diffDays <= 90) {
    const approxMonths = Math.max(1, Math.round(diffDays / 30));
    return {
      status: 'warning',
      days: diffDays,
      badgeText: `Expires in ${diffDays}d (~${approxMonths} mo${approxMonths > 1 ? 's' : ''})`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-medium',
      dotClass: 'bg-amber-500',
      isWithin3Months: true,
      isExpired: false,
    };
  }

  return {
    status: 'safe',
    days: diffDays,
    badgeText: 'Safe',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    dotClass: 'bg-emerald-400',
    isWithin3Months: false,
    isExpired: false,
  };
}

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [expiringSoonFilter, setExpiringSoonFilter] = useState(false);
  const [hideAlertBanner, setHideAlertBanner] = useState(false);
  const [showExpiringQuickList, setShowExpiringQuickList] = useState(false);
  const [expiringSummary, setExpiringSummary] = useState({ list: [], count: 0, expired: 0, critical: 0, upcoming: 0 });
  const [editModal, setEditModal] = useState({ open: false, med: null });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [historyModal, setHistoryModal] = useState({ open: false, med: null, history: [] });
  const { show, ToastEl } = useToast();

  const refreshExpiring = useCallback(() => {
    fetch('/api/medicines?expiring_soon=true')
      .then(r => r.json())
      .then(data => {
        const list = data.data || [];
        let expired = 0, critical = 0, upcoming = 0;
        list.forEach(m => {
          const info = getExpiryInfo(m.expiry_date);
          if (info?.isExpired) expired++;
          else if (info?.status === 'critical') critical++;
          else if (info?.status === 'warning') upcoming++;
        });
        setExpiringSummary({ list, count: list.length, expired, critical, upcoming });
      })
      .catch((e) => console.error('Error fetching expiring medicines:', e));
  }, []);

  const loadMedicines = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (groupFilter) params.set('group_id', groupFilter);
    if (lowStock) params.set('low_stock', 'true');
    if (expiringSoonFilter) params.set('expiring_soon', 'true');

    const res = await fetch(`/api/medicines?${params}`);
    const data = await res.json();
    setMedicines(data.data || []);
    setLoading(false);
  }, [search, groupFilter, lowStock, expiringSoonFilter]);

  useEffect(() => {
    let ignore = false;
    const fetchMeds = async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (groupFilter) params.set('group_id', groupFilter);
      if (lowStock) params.set('low_stock', 'true');
      if (expiringSoonFilter) params.set('expiring_soon', 'true');

      const res = await fetch(`/api/medicines?${params}`);
      const data = await res.json();
      if (!ignore) {
        setMedicines(data.data || []);
        setLoading(false);
      }
    };
    fetchMeds();
    return () => { ignore = true; };
  }, [search, groupFilter, lowStock, expiringSoonFilter]);

  useEffect(() => {
    let ignore = false;
    fetch('/api/groups')
      .then(r => r.json())
      .then(r => {
        if (!ignore) setGroups(r.data || []);
      })
      .catch(() => {});

    fetch('/api/medicines?expiring_soon=true')
      .then(r => r.json())
      .then(data => {
        if (ignore) return;
        const list = data.data || [];
        let expired = 0, critical = 0, upcoming = 0;
        list.forEach(m => {
          const info = getExpiryInfo(m.expiry_date);
          if (info?.isExpired) expired++;
          else if (info?.status === 'critical') critical++;
          else if (info?.status === 'warning') upcoming++;
        });
        setExpiringSummary({ list, count: list.length, expired, critical, upcoming });
      })
      .catch(() => {});

    return () => { ignore = true; };
  }, []);

  const [fetchingMedex, setFetchingMedex] = useState(false);

  const handleFetchFromMedex = async () => {
    const url = editModal.med?.source_url?.trim();
    if (!url || !url.startsWith('http')) {
      return show('Please enter a valid MedEx link starting with http', 'warning');
    }
    setFetchingMedex(true);
    try {
      const res = await fetch(`/api/medicines/fetch-external?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const d = data.data;
      setEditModal(prev => ({
        ...prev,
        med: {
          ...prev.med,
          name: d.name || prev.med.name,
          generic_name: d.generic_name || prev.med.generic_name,
          manufacturer: d.manufacturer || prev.med.manufacturer,
          strength: d.strength || prev.med.strength,
          dosage_form: d.dosage_form || prev.med.dosage_form,
          unit_type: d.unit_type || prev.med.unit_type,
          group_id: d.group_id || prev.med.group_id,
          mrp: d.mrp != null ? d.mrp : prev.med.mrp,
          last_selling_price: d.selling_price != null ? d.selling_price : prev.med.last_selling_price,
          source_url: d.source_url || url,
        }
      }));
      show('⚡ Live details loaded from MedEx!', 'success');
    } catch (e) {
      show('Failed to fetch from MedEx: ' + e.message, 'error');
    } finally {
      setFetchingMedex(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const f = editModal.med;
    const res = await fetch(`/api/medicines/${f.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    const data = await res.json();
    if (!res.ok) return show(data.error, 'error');
    show('Medicine updated', 'success');
    setEditModal({ open: false, med: null });
    loadMedicines();
    refreshExpiring();
  };

  const handleDelete = async (id, force = false) => {
    try {
      const url = force ? `/api/medicines/${id}?force=true` : `/api/medicines/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && !force) {
          if (window.confirm((data.error || 'Medicine has sales records.') + '\n\nDo you want to permanently delete this medicine and its sales history anyway?')) {
            return handleDelete(id, true);
          }
        }
        return show(data.error || 'Failed to delete medicine', 'error');
      }
      show('Medicine deleted successfully', 'success');
      setDeleteConfirm(null);
      loadMedicines();
      refreshExpiring();
    } catch (err) {
      show(err.message || 'Error deleting medicine', 'error');
    }
  };

  const showHistory = async (med) => {
    const res = await fetch(`/api/stock-in/history?medicine_id=${med.id}`);
    const data = await res.json();
    setHistoryModal({ open: true, med, history: data.data || [] });
  };

  const setMedField = (k, v) => setEditModal(prev => ({ ...prev, med: { ...prev.med, [k]: v } }));

  const stockColor = (med) => {
    if (med.current_stock === 0) return 'text-red-600 font-bold';
    if (med.current_stock <= med.low_stock_threshold) return 'text-amber-600 font-bold';
    return 'text-brand-600';
  };

  return (
    <div>
      {ToastEl}
      <div className="page-header">
        <div>
          <h1 className="page-title">Medicines</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage medicine catalog, stock levels, and expiration dates</p>
        </div>
        <Link href="/stock-in" className="btn-primary">+ Add Medicine</Link>
      </div>

      {/* Expiry Notification Alert Banner */}
      {expiringSummary.count > 0 && !hideAlertBanner && (
        <div className="relative mb-6 overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50 p-5 shadow-lg shadow-amber-500/10 transition-all duration-300">
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-36 w-36 rounded-full bg-rose-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-6 -top-6 h-36 w-36 rounded-full bg-amber-400/20 blur-2xl" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white text-xl shadow-md shadow-rose-500/25 flex-shrink-0 animate-pulse">
                ⏰
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-800">
                    Expiry Notification: {expiringSummary.count} medicine{expiringSummary.count > 1 ? 's' : ''} expiring within 3 months!
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /> Action Needed
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                  Sell or prioritize these items before their expiration date to protect your revenue and avoid stock waste.
                </p>

                {/* Expiry Breakdown Badges */}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  {expiringSummary.expired > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                      🚨 {expiringSummary.expired} Already Expired
                    </span>
                  )}
                  {expiringSummary.critical > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-rose-100 text-rose-800 border border-rose-300">
                      ⏱️ {expiringSummary.critical} Expiring in &lt; 30 days
                    </span>
                  )}
                  {expiringSummary.upcoming > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300">
                      📅 {expiringSummary.upcoming} Expiring in 1–3 months
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Banner Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 self-start md:self-center">
              <button
                type="button"
                onClick={() => {
                  setExpiringSoonFilter(prev => !prev);
                  setSearch('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 flex items-center gap-1.5 ${
                  expiringSoonFilter
                    ? 'bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-400'
                    : 'bg-white text-amber-900 hover:bg-amber-100/80 border border-amber-300'
                }`}
              >
                <span>{expiringSoonFilter ? '✓ Viewing Expiring Only' : '🔍 Filter Expiring Medicines'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExpiringQuickList(prev => !prev)}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-white/80 hover:bg-white text-slate-700 border border-slate-200 transition-colors"
              >
                {showExpiringQuickList ? '▲ Hide List' : '▼ Quick Sell List'}
              </button>

              <button
                type="button"
                onClick={() => setHideAlertBanner(true)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-xl transition-colors text-sm"
                title="Dismiss banner"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Sell Dropdown Drawer */}
          {showExpiringQuickList && expiringSummary.list.length > 0 && (
            <div className="mt-4 pt-4 border-t border-amber-200/80">
              <p className="text-xs font-semibold text-slate-700 mb-2">Expiring Medicines Ready to Sell:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {expiringSummary.list.map(m => {
                  const info = getExpiryInfo(m.expiry_date);
                  return (
                    <div key={m.id} className="p-2.5 rounded-xl bg-white border border-amber-200 shadow-sm flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{m.name} {m.strength && `(${m.strength})`}</div>
                        <div className="text-[11px] text-slate-500">Stock: <strong className="text-slate-700">{m.current_stock}</strong> · ৳{m.last_selling_price || m.mrp || 0}</div>
                        {info && (
                          <span className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-medium mt-0.5 border ${info.badgeClass}`}>
                            {info.badgeText}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/billing?medicine_id=${m.id}`}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex-shrink-0 transition-all hover:scale-105 active:scale-95 shadow-sm"
                        title="Add to Billing Cart"
                      >
                        ⚡ Sell
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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

        {/* Low Stock Filter */}
        <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
          <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} className="rounded text-brand-600" />
          <span className="text-sm text-slate-600">Low stock only</span>
        </label>

        {/* Expiring Soon Filter */}
        <button
          type="button"
          onClick={() => setExpiringSoonFilter(prev => !prev)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all select-none border mb-0.5 ${
            expiringSoonFilter
              ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-sm ring-1 ring-rose-400'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <span>⏰</span>
          <span>Expiring Soon (≤ 3 mos)</span>
          {expiringSummary.count > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              expiringSoonFilter ? 'bg-rose-200 text-rose-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {expiringSummary.count}
            </span>
          )}
        </button>
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
              <th>Expiry Date</th>
              <th>Avg Cost</th>
              <th>Selling Price</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-500">Loading…</td></tr>
            ) : medicines.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-500">
                  {expiringSoonFilter
                    ? '🎉 No medicines expiring within the next 3 months!'
                    : 'No medicines found'}
                </td>
              </tr>
            ) : medicines.map(med => {
              const expInfo = getExpiryInfo(med.expiry_date);
              const isUrgent = expInfo?.isWithin3Months && med.current_stock > 0;
              return (
                <tr
                  key={med.id}
                  className={`transition-colors ${
                    isUrgent
                      ? expInfo?.isExpired
                        ? 'bg-red-50/60 hover:bg-red-100/60'
                        : expInfo?.status === 'critical'
                        ? 'bg-rose-50/60 hover:bg-rose-100/60'
                        : 'bg-amber-50/50 hover:bg-amber-100/50'
                      : ''
                  }`}
                >
                  <td>
                    <div className="font-medium text-slate-800 flex items-center gap-1.5">
                      <span>{med.name}</span>
                      {isUrgent && (
                        <span className="text-xs" title="Expiring soon — prioritize selling!">
                          ⚠️
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{med.strength} {med.dosage_form && `· ${med.dosage_form}`}</div>
                    {med.manufacturer && <div className="text-[10px] text-slate-400">{med.manufacturer}</div>}
                    {med.source_url && (
                      <a href={med.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-600 hover:underline">MedEx ↗</a>
                    )}
                  </td>
                  <td className="text-slate-500 text-sm">{med.generic_name || '—'}</td>
                  <td>{med.group_name ? <span className="badge-green">{med.group_name}</span> : <span className="text-slate-400">—</span>}</td>
                  <td className="text-slate-500 text-xs">{med.unit_type}</td>
                  <td>
                    <span className={stockColor(med)}>{med.current_stock}</span>
                    {med.current_stock <= med.low_stock_threshold && (
                      <span className="ml-1 text-[10px] text-amber-600">low</span>
                    )}
                  </td>
                  <td>
                    {med.expiry_date ? (
                      <div>
                        <div className="font-mono text-xs font-semibold text-slate-700">{med.expiry_date}</div>
                        {expInfo && (
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] mt-0.5 border ${expInfo.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${expInfo.dotClass}`} />
                            <span>{expInfo.badgeText}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="text-slate-600">৳{Number(med.avg_cost_price).toFixed(2)}</td>
                  <td className="text-slate-600">{med.last_selling_price ? `৳${Number(med.last_selling_price).toFixed(2)}` : '—'}</td>
                  <td>
                    <div className="flex gap-1.5 justify-end items-center">
                      {med.current_stock > 0 && (
                        <Link
                          href={`/billing?medicine_id=${med.id}`}
                          className={`btn-sm font-semibold transition-all flex items-center gap-1 ${
                            isUrgent
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm hover:scale-105 active:scale-95'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-300'
                          }`}
                          title={`Sell ${med.name} in POS Billing`}
                        >
                          <span>⚡</span>
                          <span>Sell</span>
                        </Link>
                      )}
                      <button onClick={() => showHistory(med)} className="btn-secondary btn-sm" title="Stock history">📋</button>
                      <button onClick={() => setEditModal({ open: true, med: { ...med } })} className="btn-secondary btn-sm">Edit</button>
                      <button onClick={() => setDeleteConfirm(med)} className="btn-danger btn-sm">Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
            <div><label className="label">Expiry Date</label><input type="date" className="input" value={editModal.med.expiry_date || ''} onChange={e => setMedField('expiry_date', e.target.value)} /></div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Source URL (MedEx link)</label>
                {editModal.med.source_url && editModal.med.source_url.startsWith('http') && (
                  <a href={editModal.med.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">
                    Open MedEx ↗
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  placeholder="https://medex.com.bd/brands/..."
                  value={editModal.med.source_url || ''}
                  onChange={e => setMedField('source_url', e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleFetchFromMedex}
                  disabled={fetchingMedex || !editModal.med.source_url}
                  className="btn-secondary text-xs whitespace-nowrap px-3 py-1.5 flex items-center gap-1.5"
                >
                  {fetchingMedex ? <span className="animate-spin text-xs">⏳</span> : '⚡'}
                  Fetch from MedEx
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Enter any valid MedEx brand URL (e.g. <code>https://medex.com.bd/brands/26177/...</code>) to pull live name, generic, strength, manufacturer &amp; MRP.
              </p>
            </div>
            <div className="col-span-2 flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1 justify-center">Save Changes</button>
              <button type="button" onClick={() => setEditModal({ open: false, med: null })} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Medicine" size="sm">
        <p className="text-slate-600 mb-4">Delete <strong className="text-slate-800">{deleteConfirm?.name}</strong>? This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={() => handleDelete(deleteConfirm.id)} className="btn-danger flex-1 justify-center">Delete</button>
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={historyModal.open} onClose={() => setHistoryModal(p => ({ ...p, open: false }))} title={`Stock History — ${historyModal.med?.name}`} size="lg">
        {historyModal.history.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No stock-in records</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Qty</th><th>Cost/Unit</th><th>Batch</th><th>Expiry</th><th>Supplier</th></tr></thead>
              <tbody>
                {historyModal.history.map(h => (
                  <tr key={h.id}>
                    <td>{h.date}</td>
                    <td className="text-brand-600 font-medium">+{h.quantity}</td>
                    <td>৳{Number(h.cost_price).toFixed(2)}</td>
                    <td className="text-slate-500">{h.batch_no || '—'}</td>
                    <td className="text-slate-500">{h.expiry_date || '—'}</td>
                    <td className="text-slate-500">{h.supplier || '—'}</td>
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
