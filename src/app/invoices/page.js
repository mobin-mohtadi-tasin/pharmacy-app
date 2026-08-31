'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const PAYMENT_COLORS = {
  Cash: 'badge-green', Card: 'badge-blue', bKash: 'badge-yellow', Nagad: 'badge-yellow', 'Bank Transfer': 'badge-blue',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 30;

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data.data?.invoices || []);
    setTotal(data.data?.total || 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to, page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Invoice History</h1>
        <Link href="/billing" className="btn-primary">+ New Sale</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">From Date</label>
          <input type="date" className="input w-40" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" className="input w-40" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
        </div>
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); setPage(1); }} className="btn-secondary btn-sm self-end">Clear</button>
        )}
        <div className="ml-auto self-end text-sm text-gray-500">{total} invoice{total !== 1 ? 's' : ''}</div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Payment</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-500">Loading…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-500">No invoices found</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id}>
                <td className="font-mono text-sm text-gray-200">{inv.invoice_no}</td>
                <td className="text-gray-400">{inv.date}</td>
                <td><span className={PAYMENT_COLORS[inv.payment_method] || 'badge'}>{inv.payment_method}</span></td>
                <td className="font-semibold text-brand-400">৳{Number(inv.total_amount).toFixed(2)}</td>
                <td>
                  <Link href={`/invoices/${inv.id}`} className="btn-secondary btn-sm">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">← Prev</button>
          <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary btn-sm">Next →</button>
        </div>
      )}
    </div>
  );
}
