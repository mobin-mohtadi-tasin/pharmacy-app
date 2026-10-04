'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: '◉', label: 'Dashboard' },
  { href: '/billing', icon: '🧾', label: 'Billing / POS' },
  { href: '/stock-in', icon: '📦', label: 'Stock In' },
  { href: '/medicines', icon: '💊', label: 'Medicines' },
  { href: '/groups', icon: '🗂', label: 'Groups' },
  { href: '/invoices', icon: '📄', label: 'Invoices' },
  { href: '/reports', icon: '📊', label: 'Reports' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const handleBackup = async () => {
    const a = document.createElement('a');
    a.href = '/api/backup';
    a.download = '';
    a.click();
  };

  return (
    <aside className="w-56 min-h-screen flex flex-col bg-[#0c1610]/90 backdrop-blur-xl border-r border-[#1d3021] flex-shrink-0 relative z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1d3021]">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-brand-900/60 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:rotate-[360deg] group-hover:scale-110 animate-glow-pulse">
            ℞
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight transition-colors group-hover:text-brand-300">PharmaCare</p>
            <p className="text-[10px] text-gray-500">Billing System</p>
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
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ease-[var(--ease-out-expo)] group animate-fade-up
                ${active
                  ? 'bg-gradient-to-r from-brand-600/25 to-brand-600/5 text-brand-300 border border-brand-600/30 shadow-[0_0_20px_-6px_rgb(34_197_94/0.45)]'
                  : 'text-gray-400 border border-transparent hover:text-gray-100 hover:bg-[#1d3021] hover:translate-x-1'
                }`}
            >
              {/* Active accent bar */}
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-brand-400 transition-all duration-300 ${active ? 'h-5 opacity-100' : 'h-0 opacity-0 group-hover:h-3 group-hover:opacity-60'}`}
              />
              <span className="text-base w-5 text-center inline-block transition-transform group-hover:animate-wiggle">{item.icon}</span>
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 animate-glow-pulse" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-[#1d3021] space-y-1">
        <button
          onClick={handleBackup}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-[#1d3021] hover:translate-x-1 transition-all duration-300 group"
        >
          <span className="text-base w-5 text-center inline-block group-hover:animate-wiggle">💾</span>
          <span>Backup DB</span>
        </button>
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          <p className="text-[10px] text-gray-600">Local-only · All data on this PC</p>
        </div>
      </div>
    </aside>
  );
}
