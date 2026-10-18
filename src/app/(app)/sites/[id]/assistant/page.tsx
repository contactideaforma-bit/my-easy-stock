'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, supabase } from '@/lib/supabase';
import Md from '@/components/Md';
import Icon from '@/components/Icon';
import { useSite } from '../ctx';

type Tool = 'meta' | 'keywords' | 'brief' | 'free';
const TOOLS: { id: Tool; title: string; text: string }[] = [
  { id: 'meta', title: 'Balises title & meta', text: 'Analyse une page et propose des titres et descriptions optimisés, prêts à coller.' },
  { id: 'keywords', title: 'Idées de mots-clés', text: '25 mots-clés classés par intention, avec les 5 à travailler en premier.' },
  { id: 'brief', title: 'Brief de contenu', text: 'Le plan complet d’une page ou d’un article pour se positionner sur un mot-clé.' },
  { id: 'free', title: 'Question libre', text: 'Toute question SEO sur ce site : stratégie, Google Business Profile, netlinking…' },
];
const KIND_LABEL: Record<string, string> = { meta: 'Balises', keywords: 'Mots-clés', brief: 'Brief', free: 'Question', summary: 'Synthèse d’audit' };

export default function Assistant() {
  const { site } = useSite();
  const [tool, setTool] = useState<Tool>('meta');
  const [f, setF] = useState<Record<string, string>>({});
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hist, setHist] = useState<{ id: string; kind: string; input: any; output: string; created_at: string }[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase().from('seo_ai_items').select('*').eq('site_id', site.id).order('created_at', { ascending: false }).limit(20);
    setHist(data || []);
  }, [site.id]);
  useEffect(() => { load(); }, [load]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setOut(null);
    try { const r = await api<{ output: string }>('/api/ai', { siteId: site.id, kind: tool, input: f }); setOut(r.output); load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="stack">
      <div className="grid g4">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => { setTool(t.id); setOut(null); }} className={`glass sm pad ${tool === t.id ? 'tint' : 'soft'}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer', outline: tool === t.id ? '2px solid rgba(79,70,229,.35)' : 'none' }}>
            <div className="row" style={{ gap: 8, color: 'var(--accent)' }}><Icon name="spark" /><strong style={{ color: 'var(--ink)' }}>{t.title}</strong></div>
            <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>{t.text}</p>
          </button>
        ))}
      </div>
      <form onSubmit={run} className="glass pad stack">
        {tool === 'meta' && <div className="grid g2"><label className="field"><span className="label">Page à optimiser</span><input className="input mono" placeholder={site.url} value={f.url || ''} onChange={set('url')} /></label><label className="field"><span className="label">Mot-clé visé (facultatif)</span><input className="input" value={f.keyword || ''} onChange={set('keyword')} /></label></div>}
        {tool === 'keywords' && <div className="grid g2"><label className="field"><span className="label">Activité / thème</span><input className="input" placeholder={site.notes || 'Ex. formation professionnelle'} value={f.topic || ''} onChange={set('topic')} /></label><label className="field"><span className="label">Ville ou zone</span><input className="input" placeholder="Marseille" value={f.city || ''} onChange={set('city')} /></label></div>}
        {tool === 'brief' && <div className="grid g2"><label className="field"><span className="label">Mot-clé principal</span><input className="input" required value={f.keyword || ''} onChange={set('keyword')} /></label><label className="field"><span className="label">Type de page</span><input className="input" placeholder="page de service, article de blog, page ville…" value={f.pageType || ''} onChange={set('pageType')} /></label></div>}
        {tool === 'free' && <label className="field"><span className="label">Votre question</span><textarea className="textarea" required value={f.question || ''} onChange={set('question')} placeholder="Comment améliorer la visibilité locale de ce site à Marseille ?" /></label>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" disabled={busy}>{busy ? <><span className="spinner" />L’IA réfléchit…</> : <><Icon name="spark" />Générer</>}</button></div>
        {err && <p className="err">{err}</p>}
      </form>
      {busy && <div className="glass pad stack"><div className="shimmer" style={{ height: 20, width: '40%' }} /><div className="shimmer" style={{ height: 14 }} /><div className="shimmer" style={{ height: 14, width: '85%' }} /><div className="shimmer" style={{ height: 14, width: '70%' }} /></div>}
      {out && <div className="glass tint pad-lg fade-in"><div className="row between"><div className="kicker">Résultat</div><button className="btn sm" onClick={() => navigator.clipboard.writeText(out)}>Copier</button></div><Md text={out} /></div>}
      {hist.length > 0 && (
        <div className="glass pad">
          <h3 className="display" style={{ fontSize: 18, marginBottom: 10 }}>Historique</h3>
          {hist.map((h) => (
            <details key={h.id} className="issue">
              <summary><span className="chip info">{KIND_LABEL[h.kind] || h.kind}</span><span style={{ flex: 1, fontWeight: 500 }}>{h.input?.keyword || h.input?.url || h.input?.topic || h.input?.question?.slice(0, 80) || site.name}</span><span className="muted" style={{ fontSize: 12 }}>{new Date(h.created_at).toLocaleDateString('fr-FR')}</span></summary>
              <div className="body"><Md text={h.output || ''} /></div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
