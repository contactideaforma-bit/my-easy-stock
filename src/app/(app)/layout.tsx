'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconHome, IconBox, IconCash, IconClipboard, IconDots } from '@/components/Icons';

const tabs: { href: string; label: string; icon: (p: { className?: string }) => JSX.Element; big?: boolean }[] = [
  { href: '/', label: 'Accueil', icon: IconHome },
  { href: '/produits', label: 'Produits', icon: IconBox },
  { href: '/caisse', label: 'Caisse', icon: IconCash, big: true },
  { href: '/inventaire', label: 'Inventaire', icon: IconClipboard },
  { href: '/plus', label: 'Plus', icon: IconDots },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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
        <div className="glass px-8 py-6 animate-pulse text-crystal-200">Chargement…</div>
      </div>
    );

  return (
    <div className="min-h-dvh pb-28">
      <main className="mx-auto max-w-lg px-4 pt-4">{children}</main>

      <nav className="bottom-nav no-print fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-end gap-1 rounded-3xl px-3 py-2 w-[calc(100%-1.5rem)] max-w-lg">
        {tabs.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          const Icon = t.icon;
          if (t.big)
            return (
              <Link key={t.href} href={t.href} className="flex-1 flex flex-col items-center -mt-6">
                <span
                  className={`flex items-center justify-center w-14 h-14 rounded-2xl text-white transition active:scale-95 ${
                    active ? 'ring-2 ring-crystal-300/60' : ''
                  }`}
                  style={{
                    background: 'linear-gradient(135deg,#3b9af6,#1d65d8)',
                    boxShadow: '0 8px 24px rgba(59,154,246,.5)',
                  }}
                >
                  <Icon className="w-7 h-7" />
                </span>
                <span className={`text-[10px] mt-1 ${active ? 'text-crystal-200' : 'text-crystal-300/60'}`}>
                  {t.label}
                </span>
              </Link>
            );
          return (
            <Link key={t.href} href={t.href} className="flex-1 flex flex-col items-center gap-0.5 py-1">
              <Icon className={`w-6 h-6 ${active ? 'text-crystal-300' : 'text-crystal-300/50'}`} />
              <span className={`text-[10px] ${active ? 'text-crystal-200' : 'text-crystal-300/50'}`}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
