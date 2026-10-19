'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CATEGORY_LABEL, SEVERITY_LABEL, type Category } from '@/lib/types';
import { Meter, ScoreRing, scoreWord } from '@/components/Score';
import Md from '@/components/Md';
import { useSite } from '../ctx';
import { TASK_CATEGORIES, type Task } from '@/lib/tasks';

export default function Rapport() {
  const { site, latest } = useSite();
  const [kws, setKws] = useState<{ keyword: string; position: number | null; prev: number | null }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [objectif, setObjectif] = useState<string | null>(null);
  useEffect(() => {
    supabase().from('seo_tasks').select('*').eq('site_id', site.id).then(({ data }) => setTasks((data as Task[]) || []));
    supabase().from('seo_strategies').select('content').eq('site_id', site.id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => setObjectif((data?.content as any)?.objectif ?? null));
  }, [site.id]);
  useEffect(() => {
    supabase().from('seo_keywords').select('keyword,priority,seo_keyword_positions(position,checked_at)').eq('site_id', site.id).order('priority').then(({ data }) =>
      setKws((data || []).map((k: any) => { const l = [...k.seo_keyword_positions].sort((a: any, b: any) => b.checked_at.localeCompare(a.checked_at)); return { keyword: k.keyword, position: l[0]?.position ?? null, prev: l[1]?.position ?? null }; })));
  }, [site.id]);

  if (!latest) return <div className="glass empty"><p className="muted">Lancez un audit pour générer le rapport.</p></div>;
  const cats: Category[] = ['technique', 'contenu', 'balises', 'performance'];
  return (
    <div className="stack report">
      <div className="row between no-print">
        <p className="muted" style={{ margin: 0 }}>Aperçu du rapport à remettre au client. Utilisez « Imprimer » puis « Enregistrer en PDF ».</p>
        <button className="btn primary" onClick={() => window.print()}>Imprimer / PDF</button>
      </div>
      <div className="glass pad-lg">
        <div className="row between wrap" style={{ gap: 24 }}>
          <div>
            <div className="kicker">Rapport de référencement</div>
            <h2 className="display" style={{ fontSize: 32 }}>{site.name}</h2>
            <div className="mono muted">{site.url}</div>
            <p className="muted" style={{ margin: '10px 0 0' }}>Audit du {new Date(latest.created_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })} · {latest.pages_crawled} pages analysées{site.client_name ? ` · préparé pour ${site.client_name}` : ''}</p>
          </div>
          <div className="row" style={{ gap: 18 }}>
            <ScoreRing score={latest.score} size={130} />
            <div><div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{scoreWord(latest.score)}</div><div className="muted" style={{ fontSize: 13 }}>niveau global</div></div>
          </div>
        </div>
        <hr className="hr" />
        <div className="grid g2">{cats.map((c) => <Meter key={c} label={CATEGORY_LABEL[c]} value={latest.summary?.categories?.[c] ?? null} />)}</div>
      </div>
      {latest.ai_summary ? <div className="glass pad-lg"><Md text={latest.ai_summary} /></div> : <div className="glass sm pad no-print muted">Astuce : générez la « Synthèse IA pour le client » dans l’onglet Audit détaillé, elle apparaîtra ici.</div>}
      <div className="glass pad-lg">
        <h3 className="display" style={{ fontSize: 20, marginBottom: 12 }}>Points à corriger</h3>
        <table className="table">
          <thead><tr><th>Priorité</th><th>Constat</th><th>Action recommandée</th><th>Pages</th></tr></thead>
          <tbody>{latest.issues.map((i) => <tr key={i.id}><td><span className={`chip ${i.severity}`}>{SEVERITY_LABEL[i.severity]}</span></td><td style={{ fontWeight: 600 }}>{i.title}</td><td style={{ textAlign: 'justify' }}>{i.advice}</td><td>{i.total > 1 ? `${i.affected.length}/${i.total}` : '—'}</td></tr>)}</tbody>
        </table>
      </div>
      {kws.length > 0 && (
        <div className="glass pad-lg">
          <h3 className="display" style={{ fontSize: 20, marginBottom: 12 }}>Positions Google suivies</h3>
          <table className="table"><thead><tr><th>Mot-clé</th><th>Position</th><th>Évolution</th></tr></thead><tbody>{kws.map((k) => { const d = k.position != null && k.prev != null ? k.prev - k.position : null; return <tr key={k.keyword}><td>{k.keyword}</td><td style={{ fontWeight: 700 }}>{k.position ?? 'Hors top 30'}</td><td>{d == null ? '—' : d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '='}</td></tr>; })}</tbody></table>
        </div>
      )}
      {(() => {
        const real = tasks.filter((t) => !(t.auto_note || '').startsWith('Ignoré'));
        const recent = real.filter((t) => t.status === 'done' && t.done_at && Date.now() - new Date(t.done_at).getTime() < 31 * 86400000);
        const next = real.filter((t) => t.status !== 'done').sort((a, b) => a.priority - b.priority || (a.due_date || '9').localeCompare(b.due_date || '9')).slice(0, 8);
        if (!real.length) return null;
        return (
          <div className="glass pad-lg">
            {objectif && <p style={{ marginTop: 0 }}><strong>Objectif :</strong> {objectif}</p>}
            <div className="grid g2">
              <div><h3 className="display" style={{ fontSize: 20, marginBottom: 10 }}>Réalisé ces 30 derniers jours ({recent.length})</h3>{recent.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{recent.map((t) => <li key={t.id} style={{ marginBottom: 4 }}>{t.title} <span className="muted">({TASK_CATEGORIES[t.category]})</span></li>)}</ul> : <p className="muted">—</p>}</div>
              <div><h3 className="display" style={{ fontSize: 20, marginBottom: 10 }}>Prochaines étapes</h3>{next.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{next.map((t) => <li key={t.id} style={{ marginBottom: 4 }}>{t.title}{t.due_date ? <span className="muted"> — d’ici le {new Date(t.due_date + 'T12:00:00').toLocaleDateString('fr-FR')}</span> : null}</li>)}</ul> : <p className="muted">—</p>}</div>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>Avancement global du plan : {real.filter((t) => t.status === 'done').length}/{real.length} actions.</p>
          </div>
        );
      })()}
      <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Rapport réalisé par IDEA — MyEasyDev · contact@ideaforma.fr</p>
    </div>
  );
}
