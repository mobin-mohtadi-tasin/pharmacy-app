'use client';
import { useCallback, useEffect, useState } from 'react';

const DURATION = 3500;

export default function Toast({ message, type = 'success', onClose, id }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, DURATION);
    return () => clearTimeout(t);
  }, [message, id, onClose]);

  if (!message) return null;

  const colors = {
    success: 'bg-emerald-50/95 border-emerald-200 text-emerald-800',
    error: 'bg-rose-50/95 border-rose-200 text-rose-800',
    warning: 'bg-amber-50/95 border-amber-200 text-amber-800',
    info: 'bg-sky-50/95 border-sky-200 text-sky-800',
  };
  const bars = { success: 'bg-emerald-400', error: 'bg-rose-400', warning: 'bg-amber-400', info: 'bg-sky-400' };
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  return (
    <div
      key={id}
      role="status"
      className={`fixed top-4 right-4 z-[60] overflow-hidden flex items-center gap-3 pl-3 pr-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl shadow-slate-900/10 text-sm font-medium animate-slide-in-right hover:scale-[1.02] transition-transform ${colors[type]}`}
    >
      <span className="w-6 h-6 rounded-full bg-white/70 flex items-center justify-center text-sm animate-pop">{icons[type]}</span>
      <span>{message}</span>
      <button onClick={onClose} aria-label="Dismiss" className="ml-2 opacity-60 hover:opacity-100 hover:rotate-90 transition-all text-lg leading-none">×</button>
      {/* Countdown bar */}
      <span
        className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${bars[type]}`}
        style={{ animation: `toast-progress ${DURATION}ms linear forwards` }}
      />
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState({ message: '', type: 'success', id: 0 });
  // `id` changes on every show() so repeated messages re-animate and reset the timer.
  const show = useCallback((message, type = 'success') => setToast(t => ({ message, type, id: t.id + 1 })), []);
  const hide = useCallback(() => setToast(t => ({ ...t, message: '' })), []);
  const ToastEl = <Toast key={toast.id} id={toast.id} message={toast.message} type={toast.type} onClose={hide} />;
  return { show, hide, ToastEl };
}
