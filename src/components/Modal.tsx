'use client';

import { useEffect } from 'react';
import { IconX } from './Icons';

export default function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/30 backdrop-blur-[2px] no-print" onMouseDown={onClose}>
      <div
        className={`bg-paper w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-pop`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-paper/95 backdrop-blur border-b border-paper-line">
          <h2 className="font-display text-xl">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-paper-deep" aria-label="Fermer"><IconX /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
