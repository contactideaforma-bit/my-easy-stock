'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie-consent')) setVisible(true);
  }, []);

  function accept(choice: 'all' | 'essential') {
    localStorage.setItem('cookie-consent', choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] flex justify-center no-print">
      <div className="glass-strong max-w-xl w-full p-5 shadow-2xl">
        <p className="font-semibold text-ink text-sm">Cookies &amp; confidentialité</p>
        <p className="text-ink/60 text-sm mt-1 leading-relaxed">
          My Easy Stock n&apos;utilise aucun cookie publicitaire : uniquement des cookies techniques
          indispensables à la connexion et au fonctionnement de l&apos;application.{' '}
          <Link href="/mentions-legales" className="underline text-crystal-700">En savoir plus</Link>
        </p>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary flex-1 !py-2.5 text-sm" onClick={() => accept('all')}>
            J&apos;accepte
          </button>
          <button className="btn-glass flex-1 !py-2.5 text-sm" onClick={() => accept('essential')}>
            Essentiels uniquement
          </button>
        </div>
      </div>
    </div>
  );
}
