'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useState, useEffect } from 'react';

// Each tab gets its own accent color. Full class strings are listed so Tailwind can detect them.
const navItems = [
  { href: '/', icon: '◉', label: 'Dashboard', active: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: 'bg-indigo-500', hover: 'hover:bg-indigo-50 hover:text-indigo-700' },
  { href: '/billing', icon: '🧾', label: 'Billing / POS', active: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', hover: 'hover:bg-emerald-50 hover:text-emerald-700' },
  { href: '/stock-in', icon: '📦', label: 'Stock In', active: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500', hover: 'hover:bg-amber-50 hover:text-amber-700' },
  { href: '/medicines', icon: '💊', label: 'Medicines', active: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-500', hover: 'hover:bg-rose-50 hover:text-rose-700' },
  { href: '/groups', icon: '🗂', label: 'Groups', active: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500', hover: 'hover:bg-violet-50 hover:text-violet-700' },
  { href: '/invoices', icon: '📄', label: 'Invoices', active: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-500', hover: 'hover:bg-sky-50 hover:text-sky-700' },
  { href: '/reports', icon: '📊', label: 'Reports', active: 'bg-teal-50 text-teal-700 border-teal-200', bar: 'bg-teal-500', hover: 'hover:bg-teal-50 hover:text-teal-700' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expiringCount, setExpiringCount] = useState(0);

  useEffect(() => {
    fetch('/api/medicines?expiring_soon=true')
      .then(r => r.json())
      .then(res => {
        if (res.data) setExpiringCount(res.data.length);
      })
      .catch(() => {});
  }, [pathname]);

  const handleBackup = async () => {
    const a = document.createElement('a');
    a.href = '/api/backup';
    a.download = '';
    a.click();
  };

  return (
    <aside className="w-56 min-h-screen flex flex-col bg-white/85 backdrop-blur-xl border-r border-slate-200 shadow-[4px_0_24px_-12px_rgb(15_23_42/0.08)] flex-shrink-0 relative z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-200">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-500 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-teal-500/30 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:rotate-[360deg] group-hover:scale-110 animate-glow-pulse">
            ℞
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight transition-colors group-hover:text-brand-700">PharmaCare</p>
            <p className="text-[10px] text-slate-500">Billing System</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item, i) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all duration-300 ease-[var(--ease-out-expo)] group animate-fade-up
                ${active
                  ? `${item.active} shadow-sm`
                  : `text-slate-500 border-transparent hover:translate-x-1 ${item.hover}`
                }`}
            >
              {/* Active accent bar */}
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full ${item.bar} transition-all duration-300 ${active ? 'h-5 opacity-100' : 'h-0 opacity-0 group-hover:h-3 group-hover:opacity-60'}`}
              />
              <span className="text-base w-5 text-center inline-block transition-transform group-hover:animate-wiggle">{item.icon}</span>
              <span>{item.label}</span>
              {item.href === '/medicines' && expiringCount > 0 ? (
                <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {expiringCount}
                </span>
              ) : (
                active && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${item.bar} animate-pulse`} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-slate-200 space-y-1">
        <button
          onClick={handleBackup}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 hover:translate-x-1 transition-all duration-300 group"
        >
          <span className="text-base w-5 text-center inline-block group-hover:animate-wiggle">💾</span>
          <span>Backup DB</span>
        </button>
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          <p className="text-[10px] text-slate-400">Local-only · All data on this PC</p>
        </div>
      </div>
    </aside>
  );
}
