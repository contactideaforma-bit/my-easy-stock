'use client';

import { useEffect, useState } from 'react';
import { api, supabase } from '@/lib/supabase';
import type { AuditRow } from '@/lib/types';
import AuditView from '@/components/AuditView';
import Md from '@/components/Md';
import Icon from '@/components/Icon';
import { useSite } from '../ctx';

export default function AuditPage() {
  const { audits, latest, site } = useSite();
  const [sel, setSel] = useState<string | null>(latest?.id ?? null);
  const [audit, setAudit] = useState<AuditRow | null>(latest);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setSel(latest?.id ?? null); setAudit(latest); }, [latest]);
  useEffect(() => {
    if (!sel || sel === audit?.id) return;
    supabase().from('seo_audits').select('*').eq('id', sel).single().then(({ data }) => setAudit(data as AuditRow));
  }, [sel, audit?.id]);

  async function summarize() {
    if (!audit) return;
    setBusy(true); setErr(null);
    try { const r = await api<{ output: string }>('/api/ai', { siteId: site.id, kind: 'summary', input: { auditId: audit.id } }); setAudit({ ...audit, ai_summary: r.output }); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (!audit) return <div className="glass empty"><p className="muted">Aucun audit pour l’instant. Lancez le premier avec le bouton en haut à droite.</p></div>;
  return (
    <div className="stack">
      <div className="glass sm pad row between wrap">
        <label className="row" style={{ gap: 10 }}>
          <span className="muted">Audit du</span>
          <select className="select" style={{ width: 'auto', height: 38 }} value={sel ?? ''} onChange={(e) => setSel(e.target.value)}>
            {audits.map((a) => <option key={a.id} value={a.id}>{new Date(a.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} — {a.score}/100</option>)}
          </select>
        </label>
        <button className="btn" onClick={summarize} disabled={busy}>{busy ? <><span className="spinner" />Rédaction…</> : <><Icon name="spark" />{audit.ai_summary ? 'Régénérer la synthèse IA' : 'Synthèse IA pour le client'}</>}</button>
      </div>
      {err && <p className="err">{err}</p>}
      {audit.ai_summary && <div className="glass tint pad-lg fade-in"><div className="kicker">Synthèse rédigée par l’IA</div><Md text={audit.ai_summary} /></div>}
      <AuditView a={audit} />
    </div>
  );
}
