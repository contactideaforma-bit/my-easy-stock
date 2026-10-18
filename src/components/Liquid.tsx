'use client';

import { useEffect } from 'react';

/** Fond animé + reflet de lumière qui suit le pointeur sur les surfaces en verre. */
export default function Liquid() {
  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.querySelectorAll<HTMLElement>('.glass').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (e.clientY < r.top - 200 || e.clientY > r.bottom + 200) return;
          el.style.setProperty('--mx', `${e.clientX - r.left}px`);
          el.style.setProperty('--my', `${e.clientY - r.top}px`);
        });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <div className="liquid-bg" aria-hidden>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="blob b4" />
      <div className="blob b5" />
      <div className="grain" />
    </div>
  );
}
