'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import { scoreColor } from '@/components/Score';
import { SitesCtx, type Ctx } from './ctx';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [sites, setSites] = useState<Ctx['sites']>([]);
  const [email, setEmail] = useState('');

  const reload = useCallback(async () => {
    const db = supabase();
    const { data } = await db.from('seo_sites').select('*').order('created_at');
    const list = data || [];
    const { data: audits } = await db.from('seo_audits').select('site_id,score,created_at').order('created_at', { ascending: false }).limit(200);
    setSites(list.map((s: any) => ({ ...s, last_score: audits?.find((a) => a.site_id === s.id)?.score ?? null })));
  }, []);

  useEffect(() => {
    supabase().auth.getSession().then(async ({ data }) => {
      if (!data.session) return router.replace('/login');
      setEmail(data.session.user.email || '');
      await reload();
      setReady(true);
    });
    const { data: sub } = supabase().auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') router.replace('/login'); });
    return () => sub.subscription.unsubscribe();
  }, [router, reload]);

  if (!ready) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><div className="glass pad"><span className="spinner" style={{ color: 'var(--accent)' }} /></div></div>;

  const on = (p: string) => (path === p || path.startsWith(p + '/') ? 'on' : '');
  return (
    <SitesCtx.Provider value={{ sites, reload, userEmail: email }}>
      <div className="shell">
        <aside className="glass sidebar">
          <Link href="/tableau"><Logo /></Link>
          <nav className="nav">
            <Link className={on('/tableau')} href="/tableau"><Icon name="home" />Tableau de bord</Link>
            <Link className={on('/analyse')} href="/analyse"><Icon name="bolt" />Analyse rapide</Link>
            <div className="sub">Sites suivis</div>
            <div style={{ overflowY: 'auto', maxHeight: '44vh', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sites.map((s) => (
                <Link key={s.id} className={on(`/sites/${s.id}`)} href={`/sites/${s.id}`}>
                  <span className="dot" style={{ background: scoreColor(s.last_score) }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{s.last_score ?? ''}</span>
                </Link>
              ))}
              {!sites.length && <span className="muted" style={{ fontSize: 13, padding: '4px 14px' }}>Aucun site pour l’instant</span>}
            </div>
          </nav>
          <div style={{ marginTop: 'auto' }} className="nav">
            <Link className={on('/reglages')} href="/reglages"><Icon name="gear" />Réglages</Link>
            <a href="#" onClick={(e) => { e.preventDefault(); supabase().auth.signOut(); }}><Icon name="out" />Déconnexion</a>
            <div className="muted" style={{ fontSize: 11, padding: '6px 14px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
          </div>
        </aside>
        <main className="main">{children}</main>
        <nav className="glass mobile-bar">
          <Link className={on('/tableau')} href="/tableau"><Icon name="home" />Sites</Link>
          <Link className={on('/analyse')} href="/analyse"><Icon name="bolt" />Analyse</Link>
          <Link className={on('/reglages')} href="/reglages"><Icon name="gear" />Réglages</Link>
        </nav>
      </div>
    </SitesCtx.Provider>
  );
}
