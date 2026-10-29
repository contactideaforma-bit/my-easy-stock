'use client';

import { hasStaleDates, type Strategy } from '@/lib/strategy';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TASK_CATEGORIES, type Task } from '@/lib/tasks';
import { useSite } from './ctx';
import { CategoryPanel, PerfPanel, SiteChecks } from '@/components/AuditView';
import Issues from '@/components/Issues';
import Icon from '@/components/Icon';
import { scoreColor } from '@/components/Score';

function History({ points }: { points: { score: number | null; created_at: string }[] }) {
  const pts = points.filter((p) => p.score != null).slice(0, 12).reverse();
  if (pts.length < 2) return <p className="muted" style={{ fontSize: 14 }}>L’évolution apparaîtra après le deuxième audit.</p>;
  const w = 320, h = 90;
  const xy = pts.map((p, i) => [12 + (i * (w - 24)) / (pts.length - 1), h - 10 - ((p.score as number) / 100) * (h - 20)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 110 }}>
      <defs><linearGradient id="hist" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6d5efc" stopOpacity=".35" /><stop offset="1" stopColor="#6d5efc" stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${xy[xy.length - 1][0]},${h} L${xy[0][0]},${h} Z`} fill="url(#hist)" />
      <path d={d} fill="none" stroke="#6d5efc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke={scoreColor(pts[i].score)} strokeWidth="2.5" />)}
    </svg>
  );
}

function useMomentum(siteId: string, auditId?: string) {
  const [d, setD] = useState<{ tasks: Task[]; objectif: string | null; strategy: Strategy | null; kws: { pos: number | null; prev: number | null }[] } | null>(null);
  useEffect(() => {
    const db = supabase();
    Promise.all([
      db.from('seo_tasks').select('*').eq('site_id', siteId),
      db.from('seo_strategies').select('content').eq('site_id', siteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('seo_keywords').select('seo_keyword_positions(position,checked_at)').eq('site_id', siteId),
    ]).then(([t, s, k]) => setD({
      tasks: (t.data as Task[]) || [],
      objectif: (s.data?.content as any)?.objectif ?? null,
      strategy: (s.data?.content as Strategy) ?? null,
      kws: ((k.data as any[]) || []).map((x) => { const l = [...(x.seo_keyword_positions || [])].sort((a: any, b: any) => b.checked_at.localeCompare(a.checked_at)); return { pos: l[0]?.position ?? null, prev: l[1]?.position ?? null }; }),
    }));
  }, [siteId, auditId]);
  return d;
}

function Momentum({ siteId, auditId }: { siteId: string; auditId?: string }) {
  const d = useMomentum(siteId, auditId);
  if (!d) return null;
  const real = d.tasks.filter((t) => !(t.auto_note || '').startsWith('Ignoré'));
  const done = real.filter((t) => t.status === 'done').length;
  const month = real.filter((t) => t.status === 'done' && t.done_at && Date.now() - new Date(t.done_at).getTime() < 30 * 86400000).length;
  const next = real.filter((t) => t.status !== 'done').sort((a, b) => a.priority - b.priority || (a.due_date || '9').localeCompare(b.due_date || '9')).slice(0, 5);
  const measured = d.kws.filter((k) => k.pos != null || k.prev != null);
  const top10 = d.kws.filter((k) => k.pos != null && k.pos <= 10).length;
  const up = d.kws.filter((k) => k.pos != null && k.prev != null && k.pos < k.prev).length;
  return (
    <div className="grid g-main">
      <div className="glass pad">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div><div className="kicker">Prochaines actions</div>{d.objectif ? <div className="muted" style={{ fontSize: 13 }}>Objectif : {d.objectif}{hasStaleDates(d.strategy) && <> · <Link href={`/sites/${siteId}/strategie`} style={{ color: 'var(--bad)', fontWeight: 600 }}>dates à actualiser</Link></>}</div> : <Link className="muted" style={{ fontSize: 13, textDecoration: 'underline' }} href={`/sites/${siteId}/strategie`}>Définir l’objectif et la stratégie →</Link>}</div>
          <Link className="btn sm" href={`/sites/${siteId}/plan`}>Plan complet</Link>
        </div>
        {next.length ? next.map((t) => (
          <div key={t.id} className="row" style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.7)', gap: 10 }}>
            <span className={`chip ${t.priority === 1 ? 'critical' : t.priority === 2 ? 'warning' : 'info'}`}>P{t.priority}</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{t.title}</span>
            <span className="muted" style={{ fontSize: 12 }}>{TASK_CATEGORIES[t.category]}</span>
          </div>
        )) : <p className="muted">Aucune action en attente.</p>}
      </div>
      <div className="glass pad">
        <div className="kicker">Dynamique</div>
        <div className="grid g2" style={{ gap: 12, marginTop: 8 }}>
          <div><div className="stat-num" style={{ fontSize: 28 }}>{done}<span className="muted" style={{ fontSize: 16 }}>/{real.length}</span></div><div className="muted" style={{ fontSize: 13 }}>actions réalisées</div></div>
          <div><div className="stat-num" style={{ fontSize: 28 }}>{month}</div><div className="muted" style={{ fontSize: 13 }}>ces 30 derniers jours</div></div>
          <div><div className="stat-num" style={{ fontSize: 28, color: 'var(--good)' }}>{top10}</div><div className="muted" style={{ fontSize: 13 }}>mots-clés en 1re page</div></div>
          <div><div className="stat-num" style={{ fontSize: 28 }}>{up}<span className="muted" style={{ fontSize: 16 }}>/{measured.length}</span></div><div className="muted" style={{ fontSize: 13 }}>en progression</div></div>
        </div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { site, latest, audits, runAudit, running } = useSite();
  if (!latest) {
    return (
      <div className="glass empty">
        <h2 className="display" style={{ fontSize: 26 }}>Premier audit de {site.name}</h2>
        <p className="muted" style={{ maxWidth: 480, margin: '10px auto 20px' }}>L’outil parcourt jusqu’à 30 pages, vérifie les balises, le contenu, la technique et mesure la vitesse mobile avec Google. Comptez 30 à 60 secondes.</p>
        <button className="btn primary" onClick={runAudit} disabled={running}>{running ? <><span className="spinner" />Analyse en cours…</> : <><Icon name="bolt" />Lancer l’audit</>}</button>
      </div>
    );
  }
  return (
    <div className="stack">
      <Momentum siteId={site.id} auditId={latest.id} />
      <div className="grid g-main">
        <CategoryPanel a={latest} />
        <div className="glass pad">
          <div className="row between"><h3 className="display" style={{ fontSize: 18 }}>Évolution du score</h3><span className="muted" style={{ fontSize: 12 }}>{audits.length} audit(s)</span></div>
          <History points={audits} />
          <div className="muted" style={{ fontSize: 13 }}>Dernier audit : {new Date(latest.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} · {latest.pages_crawled} pages</div>
        </div>
      </div>
      <div className="grid g2">
        <div className="glass pad">
          <div className="row between" style={{ marginBottom: 12 }}><h3 className="display" style={{ fontSize: 18 }}>Les priorités</h3><Link className="btn sm" href={`/sites/${site.id}/audit`}>Tout voir</Link></div>
          <Issues issues={latest.issues} limit={6} />
        </div>
        <div className="stack">
          <PerfPanel a={latest} />
          <SiteChecks a={latest} />
        </div>
      </div>
    </div>
  );
}
