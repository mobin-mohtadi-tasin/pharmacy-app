'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function StatCard({ label, value, sub, color = 'brand', icon }) {
  const colors = {
    brand: 'from-brand-900/40 to-brand-800/20 border-brand-700/30 text-brand-400',
    teal: 'from-teal-900/40 to-teal-800/20 border-teal-700/30 text-teal-400',
    yellow: 'from-yellow-900/40 to-yellow-800/20 border-yellow-700/30 text-yellow-400',
    blue: 'from-blue-900/40 to-blue-800/20 border-blue-700/30 text-blue-400',
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 ${colors[color]}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {sub && <span className="text-xs text-gray-400 bg-[#0f1812]/60 px-2 py-0.5 rounded-full">{sub}</span>}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function SalesChart({ data }) {
  if (!data || data.length === 0) return <p className="text-sm text-gray-500 text-center py-8">No sales data in the last 7 days</p>;
  const max = Math.max(...data.map(d => d.revenue), 1);
  const allDates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    allDates.push(d.toISOString().slice(0, 10));
  }
  const map = Object.fromEntries(data.map(d => [d.date, d.revenue]));

  return (
    <div className="flex items-end gap-2 h-28 px-2">
      {allDates.map(date => {
        const rev = map[date] || 0;
        const heightPct = Math.round((rev / max) * 100);
        const isToday = date === new Date().toISOString().slice(0, 10);
        return (
          <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full relative flex items-end" style={{ height: '90px' }}>
              <div
                className={`w-full rounded-t-sm transition-all duration-500 ${isToday ? 'bg-brand-500' : 'bg-[#253d28] group-hover:bg-brand-700'}`}
                style={{ height: `${Math.max(heightPct, 3)}%` }}
              />
              {rev > 0 && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#0f1812] text-xs text-brand-400 px-1.5 py-0.5 rounded whitespace-nowrap border border-[#253d28]">
                  ৳{rev.toFixed(0)}
                </div>
              )}
            </div>
            <span className="text-[9px] text-gray-600">{date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const stats = data?.stats || {};
  const alerts = data?.low_stock_alerts || [];
  const recent = data?.recent_invoices || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/billing" className="btn-primary">
            <span>🧾</span> New Sale
          </Link>
          <Link href="/stock-in" className="btn-secondary">
            <span>📦</span> Stock In
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="💰" label="Today's Revenue" value={`৳${(stats.total_revenue || 0).toFixed(2)}`} color="brand" />
        <StatCard icon="📈" label="Today's Profit" value={`৳${(stats.total_profit || 0).toFixed(2)}`} sub={`${stats.margin_percent || 0}% margin`} color="teal" />
        <StatCard icon="🧾" label="Invoices Today" value={stats.invoice_count || 0} color="blue" />
        <StatCard icon="⚠️" label="Low Stock Items" value={alerts.length} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales chart */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <span>📊</span> 7-Day Sales Trend
          </h2>
          <SalesChart data={data?.seven_day_sales} />
        </div>

        {/* Recent invoices */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <span>🕐</span> Recent Invoices
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No invoices today</p>
          ) : (
            <div className="space-y-2">
              {recent.map(inv => (
                <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#1d3021] transition-colors group">
                  <div>
                    <p className="text-xs font-medium text-gray-200">{inv.invoice_no}</p>
                    <p className="text-[10px] text-gray-500">{inv.payment_method}</p>
                  </div>
                  <span className="text-sm font-semibold text-brand-400">৳{Number(inv.total_amount).toFixed(2)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alerts */}
      {alerts.length > 0 && (
        <div className="card mt-6">
          <div className="px-5 py-4 border-b border-[#1d3021] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
              <span>⚠️</span> Low Stock Alerts ({alerts.length})
            </h2>
            <Link href="/medicines?low_stock=true" className="text-xs text-gray-400 hover:text-brand-400 transition-colors">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Group</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(med => (
                  <tr key={med.id}>
                    <td>
                      <div className="font-medium text-gray-200">{med.name}</div>
                      <div className="text-xs text-gray-500">{med.strength}</div>
                    </td>
                    <td><span className="badge-green">{med.group_name || '—'}</span></td>
                    <td>
                      <span className={`font-bold ${med.current_stock === 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {med.current_stock}
                      </span>
                    </td>
                    <td className="text-gray-500">{med.low_stock_threshold}</td>
                    <td>
                      <Link href="/stock-in" className="btn-secondary btn-sm">+ Stock In</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
