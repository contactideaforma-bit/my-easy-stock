'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { api, supabase } from '@/lib/supabase';
import type { AuditRow, Site } from '@/lib/types';
import { useSites } from '../../ctx';
import SiteForm from '../../SiteForm';
import Icon from '@/components/Icon';
import { SiteCtx, type AuditLite } from './ctx';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const router = useRouter();
  const { reload } = useSites();
  const [site, setSite] = useState<Site | null>(null);
  const [audits, setAudits] = useState<AuditLite[]>([]);
  const [latest, setLatest] = useState<AuditRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const db = supabase();
    const { data: s } = await db.from('seo_sites').select('*').eq('id', id).maybeSingle();
    if (!s) return setMissing(true);
    setSite(s);
    const { data: list } = await db.from('seo_audits').select('id,score,created_at,pages_crawled').eq('site_id', id).order('created_at', { ascending: false });
    setAudits(list || []);
    if (list?.length) {
      const { data: full } = await db.from('seo_audits').select('*').eq('id', list[0].id).single();
      setLatest(full as AuditRow);
    } else setLatest(null);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const runAudit = useCallback(async () => {
    setRunning(true); setRunError(null);
    try { await api('/api/audit', { siteId: id }); await refresh(); await reload(); }
    catch (e: any) { setRunError(e.message); }
    finally { setRunning(false); }
  }, [id, refresh, reload]);

  async function remove() {
    if (!site || !confirm(`Supprimer « ${site.name} » et tout son historique ?`)) return;
    await supabase().from('seo_sites').delete().eq('id', site.id);
    await reload();
    router.replace('/tableau');
  }

  if (missing) return <div className="glass empty"><h2 className="display">Site introuvable</h2><p className="muted">Il a peut-être été supprimé.</p><Link className="btn" href="/tableau">Retour</Link></div>;
  if (!site) return <div className="stack"><div className="shimmer" style={{ height: 60 }} /><div className="shimmer" style={{ height: 240 }} /></div>;

  const base = `/sites/${id}`;
  const tabs = [[base, 'Vue d’ensemble'], [`${base}/audit`, 'Audit détaillé'], [`${base}/mots-cles`, 'Mots-clés'], [`${base}/assistant`, 'Assistant IA'], [`${base}/rapport`, 'Rapport client']];
  return (
    <SiteCtx.Provider value={{ site, audits, latest, refresh, runAudit, running, runError }}>
      <div className="fade-in">
        <div className="page-head no-print">
          <div style={{ minWidth: 0 }}>
            <div className="kicker">{site.client_name ? `Client · ${site.client_name}` : 'Mon site'}</div>
            <h1>{site.name}</h1>
            <a className="mono muted row" style={{ gap: 6, marginTop: 6 }} href={site.url} target="_blank" rel="noreferrer">{site.url.replace(/^https?:\/\//, '')}<Icon name="ext" size={14} /></a>
          </div>
          <div className="row wrap">
            <button className="btn sm" onClick={() => setEditing(true)}>Modifier</button>
            <button className="btn sm danger" onClick={remove}>Supprimer</button>
            <button className="btn primary" onClick={runAudit} disabled={running}>{running ? <><span className="spinner" />Audit en cours…</> : <><Icon name="bolt" />Lancer un audit</>}</button>
          </div>
        </div>
        {runError && <div className="glass sm pad err" style={{ marginBottom: 16 }}>{runError}</div>}
        <nav className="glass soft tabs no-print">
          {tabs.map(([href, label]) => <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>)}
        </nav>
        {children}
      </div>
      {editing && <SiteForm site={site} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await refresh(); await reload(); }} />}
    </SiteCtx.Provider>
  );
}
