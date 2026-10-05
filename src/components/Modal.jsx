'use client';
import { useEffect, useRef, useState } from 'react';

const EXIT_MS = 180;

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const overlayRef = useRef(null);
  // Keep the modal mounted briefly after close so it can animate out.
  const [rendered, setRendered] = useState(isOpen);
  // Mount immediately on open (state adjustment during render is the React-recommended pattern).
  if (isOpen && !rendered) setRendered(true);
  const closing = rendered && !isOpen;

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setRendered(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose();
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!rendered) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4 transition-opacity duration-200 ${closing ? 'opacity-0' : 'animate-fade-in'}`}
    >
      <div
        className={`w-full ${sizes[size]} bg-white/95 border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/10 ring-1 ring-brand-500/10 transition-all duration-200
          ${closing ? 'opacity-0 scale-95 translate-y-2' : 'animate-scale-in'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 text-xl hover:text-slate-800 hover:bg-red-50 hover:rotate-90 transition-all duration-300"
          >×</button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
