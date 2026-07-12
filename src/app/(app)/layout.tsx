'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconHome, IconBox, IconCash, IconUsers, IconDots } from '@/components/Icons';

// Navigation pensée grossiste : les revendeurs sont le cœur de l'activité (bouton central).
// La vente au détail (Caisse) reste accessible via « Plus » et l'accueil, sans être mise en avant.
const tabs: { href: string; label: string; icon: (p: { className?: string }) => JSX.Element; big?: boolean }[] = [
  { href: '/app', label: 'Accueil', icon: IconHome },
  { href: '/produits', label: 'Produits', icon: IconBox },
  { href: '/vendeurs', label: 'Revendeurs', icon: IconUsers, big: true },
  { href: '/ventes', label: 'Ventes', icon: IconCash },
  { href: '/plus', label: 'Plus', icon: IconDots },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Mode hors-ligne de base : met en cache l'application (les pages restent
  // consultables sans réseau avec les dernières données chargées).
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!data.session) router.replace('/login');
        else setReady(true);
      });
    const { data: sub } = supabase().auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!ready)
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="glass px-8 py-6 animate-pulse text-crystal-800">Chargement…</div>
      </div>
    );

  return (
    <div className="min-h-dvh pb-28">
      <main className="mx-auto max-w-lg px-4 pt-4">{children}</main>

      <nav className="bottom-nav no-print fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-end gap-1 rounded-3xl px-3 py-2 w-[calc(100%-1.5rem)] max-w-lg">
        {tabs.map((t) => {
          const active = t.href === '/app' ? pathname === '/app' : pathname.startsWith(t.href);
          const Icon = t.icon;
          if (t.big)
            return (
              <Link key={t.href} href={t.href} className="flex-1 flex flex-col items-center -mt-6">
                <span
                  className={`flex items-center justify-center w-14 h-14 rounded-2xl text-white transition active:scale-95 ${
                    active ? 'ring-2 ring-crystal-300/60' : ''
                  }`}
                  style={{
                    background: 'linear-gradient(135deg,#ff8a55,#f05e23)',
                    boxShadow: '0 8px 24px rgba(240,94,35,.45)',
                  }}
                >
                  <Icon className="w-7 h-7" />
                </span>
                <span className={`text-[10px] mt-1 ${active ? 'text-crystal-800' : 'text-ink/55'}`}>
                  {t.label}
                </span>
              </Link>
            );
          return (
            <Link key={t.href} href={t.href} className="flex-1 flex flex-col items-center gap-0.5 py-1">
              <Icon className={`w-6 h-6 ${active ? 'text-crystal-600' : 'text-ink/45'}`} />
              <span className={`text-[10px] ${active ? 'text-crystal-800' : 'text-ink/45'}`}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
