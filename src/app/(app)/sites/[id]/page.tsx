'use client';

import Link from 'next/link';
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
