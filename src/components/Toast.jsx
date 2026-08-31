'use client';
import { useEffect, useRef, useState } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  const colors = {
    success: 'bg-brand-900/90 border-brand-600/50 text-brand-300',
    error: 'bg-red-900/90 border-red-600/50 text-red-300',
    warning: 'bg-yellow-900/90 border-yellow-600/50 text-yellow-300',
    info: 'bg-blue-900/90 border-blue-600/50 text-blue-300',
  };
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-2xl text-sm font-medium animate-in slide-in-from-right-5 ${colors[type]}`}>
      <span className="text-base">{icons[type]}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const show = (message, type = 'success') => setToast({ message, type });
  const hide = () => setToast({ message: '', type: 'success' });
  const ToastEl = <Toast message={toast.message} type={toast.type} onClose={hide} />;
  return { show, hide, ToastEl };
}
