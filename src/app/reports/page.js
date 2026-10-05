'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

const today = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { show, ToastEl } = useToast();

  useEffect(() => {
    let ignore = false;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ from, to });
        const res = await fetch(`/api/reports/daily?${params}`);
        const json = await res.json();
        if (!ignore) {
          setData(json.data);
        }
      } catch (err) {
        console.error('Failed to load report:', err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    fetchReport();
    return () => { ignore = true; };
  }, [from, to]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/export?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const label = from === to ? from : `${from}_to_${to}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report_${label}.xlsx`;
      a.click();
      show('Report downloaded!', 'success');
    } catch (e) {
      show(e.message, 'error');
    } finally { setExporting(false); }
  };

  const setQuick = (period) => {
    const t = new Date();
    const t0 = new Date();
    if (period === 'today') { setFrom(today()); setTo(today()); }
    else if (period === 'week') { t0.setDate(t.getDate() - 6); setFrom(t0.toISOString().slice(0, 10)); setTo(today()); }
    else if (period === 'month') { t0.setDate(1); setFrom(t0.toISOString().slice(0, 10)); setTo(today()); }
  };

  const summary = data?.summary || {};
  const paymentSummary = data?.payment_summary || [];
  const items = data?.items || [];

  return (
    <div>
      {ToastEl}
      <div className="page-header">
        <h1 className="page-title">Reports & Export</h1>
        <button onClick={handleExport} disabled={exporting} className="btn-blue">
          {exporting ? '⏳ Exporting…' : '⬇ Download Excel'}
        </button>
      </div>

      {/* Date picker + quick shortcuts */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-40" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-40" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2 self-end">
          <button onClick={() => setQuick('today')} className="btn-sm rounded-lg font-medium border transition-all hover:-translate-y-0.5 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100">Today</button>
          <button onClick={() => setQuick('week')} className="btn-sm rounded-lg font-medium border transition-all hover:-translate-y-0.5 bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100">This Week</button>
          <button onClick={() => setQuick('month')} className="btn-sm rounded-lg font-medium border transition-all hover:-translate-y-0.5 bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100">This Month</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Revenue', value: `৳${Number(summary.total_revenue || 0).toFixed(2)}`, color: 'text-emerald-700', bg: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200' },
              { label: 'Total Cost', value: `৳${Number(summary.total_cost || 0).toFixed(2)}`, color: 'text-rose-700', bg: 'bg-gradient-to-br from-rose-50 to-white border-rose-200' },
              { label: 'Total Profit', value: `৳${Number(summary.total_profit || 0).toFixed(2)}`, color: 'text-teal-700', bg: 'bg-gradient-to-br from-teal-50 to-white border-teal-200' },
              { label: 'Margin', value: `${summary.margin_percent || 0}%`, color: 'text-amber-700', bg: 'bg-gradient-to-br from-amber-50 to-white border-amber-200' },
            ].map(s => (
              <div key={s.label} className={`card p-4 ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Payment summary */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-600 mb-4">Payment Breakdown</h2>
              {paymentSummary.length === 0 ? (
                <p className="text-sm text-slate-500">No data</p>
              ) : (
                <div className="space-y-3">
                  {paymentSummary.map(p => {
                    const totalRev = summary.total_revenue || 1;
                    const pct = ((p.total / totalRev) * 100).toFixed(1);
                    return (
                      <div key={p.payment_method}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">{p.payment_method}</span>
                          <span className="text-brand-600">৳{Number(p.total).toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className="bg-gradient-to-r from-indigo-500 to-sky-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{p.invoice_count} invoices · {pct}%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="lg:col-span-2 card p-5">
              <h2 className="text-sm font-semibold text-slate-600 mb-4">Period Summary</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Invoices', value: summary.invoice_count || 0 },
                  { label: 'Units Sold', value: summary.total_units_sold || 0 },
                  { label: 'Avg Revenue/Invoice', value: summary.invoice_count ? `৳${(summary.total_revenue / summary.invoice_count).toFixed(2)}` : '—' },
                  { label: 'Avg Profit/Invoice', value: summary.invoice_count ? `৳${(summary.total_profit / summary.invoice_count).toFixed(2)}` : '—' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-slate-800">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sales detail table */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-600">Sales Detail ({items.length} line items)</h2>
            </div>
            <div className="table-wrap border-0 rounded-none rounded-b-xl">
              <table className="data-table">
                <thead><tr><th>Invoice</th><th>Medicine</th><th>Group</th><th>Qty</th><th>Cost</th><th>Selling Price</th><th>Revenue</th><th>Profit</th><th>Payment</th></tr></thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-slate-500">No sales in this period</td></tr>
                  ) : items.map((item, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs text-slate-500">{item.invoice_no}</td>
                      <td className="font-medium text-slate-700">{item.medicine_name}</td>
                      <td><span className="badge-green">{item.group_name || '—'}</span></td>
                      <td>{item.quantity}</td>
                      <td className="text-slate-500">৳{Number(item.cost_price_snapshot).toFixed(2)}</td>
                      <td className="text-slate-600">৳{Number(item.selling_price).toFixed(2)}</td>
                      <td className="text-brand-600">৳{Number(item.revenue).toFixed(2)}</td>
                      <td className="text-teal-600">৳{Number(item.profit).toFixed(2)}</td>
                      <td><span className="badge-blue text-[10px]">{item.payment_method}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
