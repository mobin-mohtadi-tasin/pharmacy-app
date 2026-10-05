'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AnimatedNumber from '@/components/AnimatedNumber';

const taka = (n) => `৳${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({ label, value, format, sub, color = 'brand', icon, delay = 0 }) {
  const colors = {
    brand: 'from-emerald-50 to-white border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-500/20',
    teal: 'from-teal-50 to-white border-teal-200 hover:border-teal-400 hover:shadow-teal-500/20',
    yellow: 'from-amber-50 to-white border-amber-200 hover:border-amber-400 hover:shadow-amber-500/20',
    blue: 'from-indigo-50 to-white border-indigo-200 hover:border-indigo-400 hover:shadow-indigo-500/20',
  };
  const orbs = { brand: 'bg-emerald-400', teal: 'bg-teal-400', yellow: 'bg-amber-400', blue: 'bg-indigo-400' };
  const values = { brand: 'text-emerald-700', teal: 'text-teal-700', yellow: 'text-amber-700', blue: 'text-indigo-700' };
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 cursor-default animate-fade-up hover-lift hover:shadow-2xl ${colors[color]}`}
    >
      {/* Glow orb that blooms on hover */}
      <span className={`pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-20 transition-all duration-500 group-hover:opacity-50 group-hover:scale-150 ${orbs[color]}`} />
      <div className="relative flex items-start justify-between mb-3">
        <span className="text-2xl inline-block transition-transform duration-300 group-hover:animate-wiggle">{icon}</span>
        {sub && <span className="text-xs text-slate-600 bg-white/70 border border-slate-200 px-2 py-0.5 rounded-full">{sub}</span>}
      </div>
      <p className={`relative text-3xl font-bold ${values[color]}`}>
        <AnimatedNumber value={value} format={format} />
      </p>
      <p className="relative text-xs text-slate-500 mt-1 transition-colors group-hover:text-slate-700">{label}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="flex justify-between mb-6">
        <div className="space-y-2"><div className="skeleton h-7 w-40" /><div className="skeleton h-4 w-56" /></div>
        <div className="flex gap-3"><div className="skeleton h-9 w-28" /><div className="skeleton h-9 w-28" /></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-32" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="skeleton h-48 lg:col-span-2" />
        <div className="skeleton h-48" />
      </div>
    </div>
  );
}

function SalesChart({ data }) {
  if (!data || data.length === 0) return <p className="text-sm text-slate-500 text-center py-8">No sales data in the last 7 days</p>;
  const max = Math.max(...data.map(d => d.revenue), 1);
  const allDates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    allDates.push(d.toISOString().slice(0, 10));
  }
  const map = Object.fromEntries(data.map(d => [d.date, d.revenue]));

  return (
    <div className="flex items-end gap-2 h-36 px-2 pt-6">
      {allDates.map((date, i) => {
        const rev = map[date] || 0;
        const heightPct = Math.round((rev / max) * 100);
        const isToday = date === new Date().toISOString().slice(0, 10);
        return (
          <div key={date} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
            <div className="w-full relative flex items-end" style={{ height: '100px' }}>
              <div
                className={`w-full rounded-t-md origin-bottom transition-all duration-300 group-hover:brightness-125 group-hover:scale-x-110
                  ${isToday
                    ? 'bg-gradient-to-t from-emerald-500 to-teal-300 shadow-[0_6px_18px_-4px_rgb(16_185_129/0.5)]'
                    : 'bg-gradient-to-t from-indigo-200 to-sky-100 group-hover:from-indigo-500 group-hover:to-sky-300'}`}
                style={{
                  height: `${Math.max(heightPct, 3)}%`,
                  animation: `bar-grow 0.8s cubic-bezier(0.34,1.56,0.64,1) ${i * 70}ms backwards`,
                }}
              />
              <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 translate-y-1 opacity-0 scale-90 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200 bg-white text-xs text-indigo-700 font-semibold px-2 py-0.5 rounded-md whitespace-nowrap border border-indigo-200 shadow-lg z-10">
                ৳{rev.toFixed(0)}
              </div>
            </div>
            <span className={`text-[9px] transition-colors ${isToday ? 'text-emerald-600 font-semibold' : 'text-slate-400 group-hover:text-indigo-600'}`}>{date.slice(5)}</span>
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

  if (loading) return <DashboardSkeleton />;

  const stats = data?.stats || {};
  const alerts = data?.low_stock_alerts || [];
  const recent = data?.recent_invoices || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">{new Date().toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/billing" className="btn-primary group">
            <span className="inline-block transition-transform group-hover:animate-wiggle">🧾</span> New Sale
          </Link>
          <Link href="/stock-in" className="btn-amber group">
            <span className="inline-block transition-transform group-hover:animate-wiggle">📦</span> Stock In
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard delay={0} icon="💰" label="Today's Revenue" value={stats.total_revenue || 0} format={taka} color="brand" />
        <StatCard delay={80} icon="📈" label="Today's Profit" value={stats.total_profit || 0} format={taka} sub={`${stats.margin_percent || 0}% margin`} color="teal" />
        <StatCard delay={160} icon="🧾" label="Invoices Today" value={stats.invoice_count || 0} color="blue" />
        <StatCard delay={240} icon="⚠️" label="Low Stock Items" value={alerts.length} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales chart */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
            <span>📊</span> 7-Day Sales Trend
          </h2>
          <SalesChart data={data?.seven_day_sales} />
        </div>

        {/* Recent invoices */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
            <span>🕐</span> Recent Invoices
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No invoices today</p>
          ) : (
            <div className="space-y-1.5">
              {recent.map((inv, i) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  style={{ animationDelay: `${200 + i * 60}ms` }}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-transparent hover:border-sky-200 hover:bg-sky-50 hover:translate-x-1 transition-all duration-300 group animate-fade-up"
                >
                  <div>
                    <p className="text-xs font-medium text-slate-700 group-hover:text-slate-800">{inv.invoice_no}</p>
                    <p className="text-[10px] text-slate-500">{inv.payment_method}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                    ৳{Number(inv.total_amount).toFixed(2)}
                    <span className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">→</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alerts */}
      {alerts.length > 0 && (
        <div className="card mt-6">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-600 flex items-center gap-2">
              <span>⚠️</span> Low Stock Alerts ({alerts.length})
            </h2>
            <Link href="/medicines?low_stock=true" className="text-xs text-slate-500 hover:text-brand-600 transition-colors">View all →</Link>
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
                      <div className="font-medium text-slate-700">{med.name}</div>
                      <div className="text-xs text-slate-500">{med.strength}</div>
                    </td>
                    <td><span className="badge-green">{med.group_name || '—'}</span></td>
                    <td>
                      <span className={`font-bold ${med.current_stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {med.current_stock}
                      </span>
                    </td>
                    <td className="text-slate-500">{med.low_stock_threshold}</td>
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
