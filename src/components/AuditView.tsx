import type { AuditResult, Category } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/types';
import { Meter, ScoreRing, scoreColor } from './Score';
import Issues from './Issues';

export function CategoryPanel({ a }: { a: AuditResult }) {
  const cats: Category[] = ['technique', 'contenu', 'balises', 'performance'];
  return (
    <div className="glass pad-lg" style={{ display: 'flex', gap: 30, alignItems: 'center', flexWrap: 'wrap' }}>
      <ScoreRing score={a.score} size={168} />
      <div style={{ flex: 1, minWidth: 240 }} className="stack">
        {cats.map((c) => <Meter key={c} label={CATEGORY_LABEL[c]} value={a.summary?.categories?.[c] ?? null} />)}
        <div className="row wrap" style={{ gap: 8, paddingTop: 4 }}>
          <span className="chip critical">{a.summary?.counts?.critical ?? 0} bloquant(s)</span>
          <span className="chip warning">{a.summary?.counts?.warning ?? 0} à corriger</span>
          <span className="chip info">{a.summary?.counts?.info ?? 0} bonus</span>
        </div>
      </div>
    </div>
  );
}

export function PerfPanel({ a }: { a: AuditResult }) {
  const p = a.performance;
  return (
    <div className="glass pad">
      <div className="row between"><h3 className="display" style={{ fontSize: 18 }}>Vitesse mobile</h3><span className="muted" style={{ fontSize: 12 }}>Google PageSpeed</span></div>
      {!p || p.error ? (
        <p className="muted" style={{ fontSize: 14 }}>{p?.error ? `Non mesurée : ${p.error}` : 'Non mesurée (délai Google dépassé). Relancez l’audit ou ajoutez une clé GOOGLE_PSI_API_KEY.'}</p>
      ) : (
        <>
          <div className="grid g4" style={{ gap: 10, margin: '14px 0' }}>
            {[['Perf.', p.performance], ['SEO', p.seo], ['Access.', p.accessibility], ['Pratiques', p.bestPractices]].map(([l, v]) => (
              <div key={l as string} style={{ textAlign: 'center' }}><div className="stat-num" style={{ fontSize: 26, color: scoreColor(v as number) }}>{(v as number) ?? '—'}</div><div className="muted" style={{ fontSize: 12 }}>{l}</div></div>
            ))}
          </div>
          <table className="table"><tbody>
            <tr><td>Affichage principal (LCP)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{p.lcp ?? '—'}</td></tr>
            <tr><td>Premier affichage (FCP)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{p.fcp ?? '—'}</td></tr>
            <tr><td>Blocage (TBT)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{p.tbt ?? '—'}</td></tr>
            <tr><td>Stabilité visuelle (CLS)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{p.cls ?? '—'}</td></tr>
          </tbody></table>
        </>
      )}
    </div>
  );
}

export function SiteChecks({ a }: { a: AuditResult }) {
  const c = a.site_checks;
  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) => (
    <tr><td>{label}{detail && <div className="muted mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{detail}</div>}</td><td style={{ textAlign: 'right' }}><span className={`chip ${ok ? 'ok' : 'critical'}`}>{ok ? 'OK' : 'Absent'}</span></td></tr>
  );
  return (
    <div className="glass pad">
      <h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>Fondations</h3>
      <table className="table"><tbody>
        <Row ok={c.https} label="HTTPS sécurisé" />
        <Row ok={c.robots && !c.robotsBlocksAll} label="Fichier robots.txt" detail={c.robotsBlocksAll ? 'Bloque tout le site !' : undefined} />
        <Row ok={!!c.sitemap} label="Sitemap XML" detail={c.sitemap ? `${c.sitemap} — ${c.sitemapUrls} adresses` : undefined} />
        <Row ok={c.favicon} label="Favicon" />
      </tbody></table>
    </div>
  );
}

export function PagesTable({ a }: { a: AuditResult }) {
  return (
    <div className="glass pad">
      <h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>Pages analysées ({a.pages.length}){a.summary?.truncated ? <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}> — limite atteinte, d’autres pages existent</span> : null}</h3>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th>Page</th><th>Statut</th><th>Title</th><th>Description</th><th>H1</th><th>Mots</th><th>Images sans alt</th><th>Temps</th></tr></thead>
          <tbody>
            {a.pages.map((p) => (
              <tr key={p.url}>
                <td className="mono" style={{ maxWidth: 260, wordBreak: 'break-all' }}><a href={p.url} target="_blank" rel="noreferrer">{p.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</a></td>
                <td><span className={`chip ${p.status >= 200 && p.status < 400 ? 'ok' : 'critical'}`}>{p.status || 'Erreur'}</span></td>
                <td style={{ minWidth: 180 }}>{p.title ?? <span className="chip critical">Absent</span>}{p.title && <div className="muted" style={{ fontSize: 12 }}>{p.title.length} car.</div>}</td>
                <td style={{ minWidth: 200, fontSize: 13 }}>{p.description ? <>{p.description.slice(0, 110)}{p.description.length > 110 ? '…' : ''}<div className="muted" style={{ fontSize: 12 }}>{p.description.length} car.</div></> : <span className="chip critical">Absente</span>}</td>
                <td><span className={`chip ${p.h1.length === 1 ? 'ok' : p.h1.length ? 'warning' : 'critical'}`}>{p.h1.length}</span></td>
                <td style={{ color: p.words < 300 ? 'var(--mid)' : undefined, fontWeight: 600 }}>{p.words}</td>
                <td>{p.imagesNoAlt ? <span className="chip warning">{p.imagesNoAlt}/{p.images}</span> : <span className="muted">0</span>}</td>
                <td className="muted">{p.ms ? `${(p.ms / 1000).toFixed(1)} s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AuditView({ a }: { a: AuditResult }) {
  return (
    <div className="stack">
      <div className="grid g-main">
        <CategoryPanel a={a} />
        <SiteChecks a={a} />
      </div>
      <div className="grid g2">
        <div className="glass pad"><h3 className="display" style={{ fontSize: 18, marginBottom: 12 }}>Problèmes à traiter</h3><Issues issues={a.issues} /></div>
        <PerfPanel a={a} />
      </div>
      <PagesTable a={a} />
    </div>
  );
}
