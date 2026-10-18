'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, supabase } from '@/lib/supabase';
import Icon from '@/components/Icon';
import { useSite } from '../ctx';

type Kw = { id: string; keyword: string; target_url: string | null; priority: number; positions: { position: number | null; checked_at: string; found_url: string | null }[] };

const posColor = (p: number | null | undefined) => (p == null ? 'var(--ink-mute)' : p <= 3 ? 'var(--good)' : p <= 10 ? '#2f9e6b' : p <= 20 ? 'var(--mid)' : 'var(--bad)');

export default function Keywords() {
  const { site } = useSite();
  const [list, setList] = useState<Kw[]>([]);
  const [kw, setKw] = useState('');
  const [target, setTarget] = useState('');
  const [prio, setPrio] = useState(2);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [autoOk, setAutoOk] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase().from('seo_keywords').select('id,keyword,target_url,priority,positions:seo_keyword_positions(position,checked_at,found_url)').eq('site_id', site.id).order('priority').order('keyword');
    setList(((data as any) || []).map((k: Kw) => ({ ...k, positions: [...k.positions].sort((a, b) => b.checked_at.localeCompare(a.checked_at)) })));
  }, [site.id]);
  useEffect(() => { load(); api('/api/status').then((s: any) => setAutoOk(!!s.serper)).catch(() => {}); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const words = kw.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
    if (!words.length) return;
    const { error } = await supabase().from('seo_keywords').upsert(words.map((w) => ({ site_id: site.id, keyword: w.toLowerCase(), target_url: target.trim() || null, priority: prio })), { onConflict: 'site_id,keyword' });
    if (error) return setMsg(error.message);
    setKw(''); setTarget(''); setMsg(null); load();
  }
  async function check(k: Kw) {
    setBusy(k.id); setMsg(null);
    try { const r: any = await api('/api/rank', { keywordId: k.id }); setMsg(r.position ? `« ${k.keyword} » : position ${r.position}` : `« ${k.keyword} » : pas dans les 30 premiers résultats`); load(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(null); }
  }
  async function manual(k: Kw) {
    const v = prompt(`Position Google actuelle pour « ${k.keyword} » (laisser vide si absent du top 100) :`);
    if (v === null) return;
    const n = parseInt(v, 10);
    await supabase().from('seo_keyword_positions').insert({ keyword_id: k.id, position: Number.isFinite(n) ? n : null, source: 'manual' });
    load();
  }
  async function remove(k: Kw) {
    if (!confirm(`Retirer « ${k.keyword} » ?`)) return;
    await supabase().from('seo_keywords').delete().eq('id', k.id);
    load();
  }

  return (
    <div className="stack">
      <form onSubmit={add} className="glass pad">
        <h3 className="display" style={{ fontSize: 18, marginBottom: 12 }}>Ajouter des mots-clés à suivre</h3>
        <div className="grid g-kw">
          <label className="field"><span className="label">Mot(s)-clé(s) — séparer par ;</span><input className="input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="formation bureautique marseille; formation excel" /></label>
          <label className="field"><span className="label">Page visée</span><input className="input mono" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="/formations" /></label>
          <label className="field"><span className="label">Priorité</span><select className="select" value={prio} onChange={(e) => setPrio(Number(e.target.value))}><option value={1}>Haute</option><option value={2}>Normale</option><option value={3}>Basse</option></select></label>
          <button className="btn primary" style={{ height: 46 }}><Icon name="plus" />Ajouter</button>
        </div>
        {!autoOk && <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Suivi automatique des positions désactivé : ajoutez une clé <span className="mono">SERPER_API_KEY</span> (serper.dev, 2 500 recherches offertes) dans Vercel. En attendant, saisissez les positions à la main.</p>}
      </form>
      {msg && <div className="glass sm pad">{msg}</div>}
      <div className="glass pad">
        {!list.length ? <p className="muted">Aucun mot-clé suivi. Demandez des idées à l’assistant IA, puis ajoutez-les ici.</p> : (
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Mot-clé</th><th>Page visée</th><th>Position</th><th>Évolution</th><th>Dernier relevé</th><th /></tr></thead>
              <tbody>
                {list.map((k) => {
                  const [cur, prev] = k.positions;
                  const delta = cur?.position != null && prev?.position != null ? prev.position - cur.position : null;
                  return (
                    <tr key={k.id}>
                      <td><strong>{k.keyword}</strong>{k.priority === 1 && <span className="chip warning" style={{ marginLeft: 8 }}>Prioritaire</span>}</td>
                      <td className="mono muted">{k.target_url || '—'}</td>
                      <td><span className="stat-num" style={{ fontSize: 22, color: posColor(cur?.position) }}>{cur ? cur.position ?? '>30' : '—'}</span></td>
                      <td>{delta == null ? <span className="muted">—</span> : <span className={`chip ${delta > 0 ? 'ok' : delta < 0 ? 'critical' : ''}`}>{delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : '='}</span>}</td>
                      <td className="muted" style={{ fontSize: 13 }}>{cur ? new Date(cur.checked_at).toLocaleDateString('fr-FR') : 'Jamais'}</td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {autoOk && <button className="btn sm" disabled={busy === k.id} onClick={() => check(k)}>{busy === k.id ? <span className="spinner" /> : 'Vérifier'}</button>}{' '}
                        <button className="btn sm" onClick={() => manual(k)}>Saisir</button>{' '}
                        <button className="btn sm ghost danger" onClick={() => remove(k)}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
