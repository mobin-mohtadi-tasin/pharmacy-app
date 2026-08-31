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
    <aside className="w-56 min-h-screen flex flex-col bg-[#0c1610] border-r border-[#1d3021] flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1d3021]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white text-base font-bold shadow-lg shadow-brand-900/50">
            ℞
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">PharmaCare</p>
            <p className="text-[10px] text-gray-500">Billing System</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                ${active
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-[#1d3021]'
                }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-[#1d3021] space-y-1">
        <button
          onClick={handleBackup}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-[#1d3021] transition-all"
        >
          <span className="text-base w-5 text-center">💾</span>
          <span>Backup DB</span>
        </button>
        <div className="px-3 py-2">
          <p className="text-[10px] text-gray-600">Local-only · All data on this PC</p>
        </div>
      </div>
    </aside>
  );
}
