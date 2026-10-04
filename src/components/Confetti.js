'use client';

const COLORS = ['#22c55e', '#4ade80', '#a7f3d0', '#14b8a6', '#facc15', '#60a5fa', '#f472b6'];

/**
 * Fires a short, DOM-only confetti burst from a screen point.
 * Usage: burstConfetti({ x: window.innerWidth / 2, y: 200 })
 */
export function burstConfetti({ x = window.innerWidth / 2, y = window.innerHeight / 3, count = 60 } = {}) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'confetti-piece';
    const angle = Math.random() * Math.PI * 2;
    const velocity = 120 + Math.random() * 260;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.background = COLORS[i % COLORS.length];
    el.style.setProperty('--dx', `${Math.cos(angle) * velocity}px`);
    el.style.setProperty('--dy', `${Math.sin(angle) * velocity + 220}px`); // gravity-ish
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 900}deg`);
    el.style.animationDelay = `${Math.random() * 0.08}s`;
    if (Math.random() > 0.6) el.style.borderRadius = '9999px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}
