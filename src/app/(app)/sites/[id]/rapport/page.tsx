'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CATEGORY_LABEL, SEVERITY_LABEL, type Category } from '@/lib/types';
import { Meter, ScoreRing, scoreWord } from '@/components/Score';
import Md from '@/components/Md';
import { useSite } from '../ctx';

export default function Rapport() {
  const { site, latest } = useSite();
  const [kws, setKws] = useState<{ keyword: string; position: number | null }[]>([]);
  useEffect(() => {
    supabase().from('seo_keywords').select('keyword,priority,seo_keyword_positions(position,checked_at)').eq('site_id', site.id).order('priority').then(({ data }) =>
      setKws((data || []).map((k: any) => ({ keyword: k.keyword, position: [...k.seo_keyword_positions].sort((a: any, b: any) => b.checked_at.localeCompare(a.checked_at))[0]?.position ?? null }))));
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
          <table className="table"><thead><tr><th>Mot-clé</th><th>Position</th></tr></thead><tbody>{kws.map((k) => <tr key={k.keyword}><td>{k.keyword}</td><td style={{ fontWeight: 700 }}>{k.position ?? 'Hors top 30'}</td></tr>)}</tbody></table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Rapport réalisé par IDEA — MyEasyDev · contact@ideaforma.fr</p>
    </div>
  );
}
