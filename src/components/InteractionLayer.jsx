'use client';
import { useEffect } from 'react';

/**
 * Global, zero-markup interaction effects:
 *  - Material-style ripple on any button / .btn-* element when clicked
 *  - Cursor-following spotlight on .card elements (sets --mx / --my)
 * Mounted once in the root layout.
 */
const RIPPLE_SELECTOR = 'button, .btn, .btn-primary, .btn-secondary, .btn-danger';

export default function InteractionLayer() {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onPointerDown = (e) => {
      if (reduceMotion) return;
      const target = e.target.closest?.(RIPPLE_SELECTOR);
      if (!target || target.disabled) return;

      const style = getComputedStyle(target);
      if (style.position === 'static') target.style.position = 'relative';
      if (style.overflow !== 'hidden') target.style.overflow = 'hidden';

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    };

    let frame = 0;
    const onPointerMove = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const card = e.target.closest?.('.card');
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--my', `${e.clientY - rect.top}px`);
      });
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
