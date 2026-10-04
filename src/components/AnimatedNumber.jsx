'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly counts from the previous value to `value`.
 * `format` turns the in-flight number into display text.
 */
export default function AnimatedNumber({ value = 0, duration = 900, format = (n) => Math.round(n).toString() }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) { setDisplay(to); return; }

    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); fromRef.current = to; };
  }, [value, duration]);

  return <span className="tabular-nums">{format(display)}</span>;
}
