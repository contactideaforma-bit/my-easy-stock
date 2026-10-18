'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, supabase } from '@/lib/supabase';
import type { AuditResult } from '@/lib/types';
import AuditView from '@/components/AuditView';
import Icon from '@/components/Icon';
import { useSites } from '../ctx';

export default function Analyse() {
  const router = useRouter();
  const { reload } = useSites();
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(10);
  const [res, setRes] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setRes(null);
    try { setRes(await api<AuditResult>('/api/analyze', { url, maxPages: depth })); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  async function follow() {
    if (!res) return;
    const u = new URL(res.summary.startUrl);
    const { data, error } = await supabase().from('seo_sites').insert({ name: u.host.replace(/^www\./, ''), url: u.origin, client_name: 'Prospect' }).select('id').single();
    if (error) return setErr(error.message);
    await supabase().from('seo_audits').insert({ site_id: data.id, score: res.score, pages_crawled: res.pages.length, summary: res.summary, site_checks: res.site_checks, pages: res.pages, issues: res.issues, performance: res.performance });
    await reload();
    router.push(`/sites/${data.id}`);
  }

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <div className="kicker">Analyse rapide</div>
          <h1>Diagnostiquer n’importe quel site</h1>
          <p className="muted" style={{ margin: '8px 0 0', maxWidth: 560 }}>Idéal pour un prospect ou un concurrent : rien n’est enregistré, sauf si vous décidez de suivre le site.</p>
        </div>
      </div>
      <form onSubmit={go} className="glass pad-lg" style={{ marginBottom: 18 }}>
        <div className="grid g-an">
          <label className="field"><span className="label">Adresse du site</span><input className="input mono" style={{ height: 52, fontSize: 16 }} required placeholder="www.restaurant-exemple.fr" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
          <label className="field"><span className="label">Pages à explorer</span><select className="select" style={{ height: 52 }} value={depth} onChange={(e) => setDepth(Number(e.target.value))}><option value={1}>Accueil seule</option><option value={10}>10 pages</option><option value={25}>25 pages</option></select></label>
          <button className="btn primary" style={{ height: 52, padding: '0 28px' }} disabled={busy}>{busy ? <><span className="spinner" />Analyse…</> : <><Icon name="bolt" />Analyser</>}</button>
        </div>
        {busy && <p className="muted" style={{ marginBottom: 0 }}>Exploration des pages et mesure de la vitesse par Google : 20 à 50 secondes.</p>}
        {err && <p className="err">{err}</p>}
      </form>
      {res && (
        <div className="fade-in stack">
          <div className="glass sm pad row between wrap">
            <span><strong className="mono">{res.summary.startUrl}</strong> <span className="muted">· {res.pages.length} pages · {(res.summary.durationMs / 1000).toFixed(0)} s</span></span>
            <button className="btn" onClick={follow}><Icon name="plus" />Suivre ce site</button>
          </div>
          <AuditView a={res} />
        </div>
      )}
    </div>
  );
}
