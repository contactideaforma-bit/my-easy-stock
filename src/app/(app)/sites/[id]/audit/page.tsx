'use client';

import { useEffect, useState } from 'react';
import { api, supabase } from '@/lib/supabase';
import type { AuditRow } from '@/lib/types';
import AuditView from '@/components/AuditView';
import Md from '@/components/Md';
import Icon from '@/components/Icon';
import { useSite } from '../ctx';
import { buildFixPrompt } from '@/lib/fixprompt';

export default function AuditPage() {
  const { audits, latest, site } = useSite();
  const [sel, setSel] = useState<string | null>(latest?.id ?? null);
  const [audit, setAudit] = useState<AuditRow | null>(latest);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fix, setFix] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        <div className="row wrap">
        <button className="btn" onClick={() => { setFix(buildFixPrompt(site, audit)); setCopied(false); }}><Icon name="bolt" />Prompt de correction pour Claude</button>
        <button className="btn" onClick={summarize} disabled={busy}>{busy ? <><span className="spinner" />Rédaction…</> : <><Icon name="spark" />{audit.ai_summary ? 'Régénérer la synthèse IA' : 'Synthèse IA pour le client'}</>}</button>
        </div>
      </div>
      {fix && (
        <div className="glass tint pad-lg fade-in">
          <div className="row between wrap" style={{ marginBottom: 10 }}>
            <div>
              <div className="kicker">Prompt prêt à coller dans Claude</div>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>Copiez-le dans une conversation Claude reliée au dossier ou au dépôt du site : Claude appliquera les corrections dans le code.</p>
            </div>
            <div className="row">
              <button className="btn primary" onClick={async () => { await navigator.clipboard.writeText(fix); setCopied(true); }}>{copied ? 'Copié ✓' : 'Copier'}</button>
              <button className="btn" onClick={() => { const b = new Blob([fix], { type: 'text/markdown' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = `corrections-seo-${site.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`; l.click(); URL.revokeObjectURL(u); }}>Télécharger .md</button>
              <button className="btn ghost" onClick={() => setFix(null)}>Fermer</button>
            </div>
          </div>
          <textarea className="textarea mono" readOnly value={fix} style={{ minHeight: 360, fontSize: 12.5, lineHeight: 1.55 }} />
        </div>
      )}
      {err && <p className="err">{err}</p>}
      {audit.ai_summary && <div className="glass tint pad-lg fade-in"><div className="kicker">Synthèse rédigée par l’IA</div><Md text={audit.ai_summary} /></div>}
      <AuditView a={audit} />
    </div>
  );
}
