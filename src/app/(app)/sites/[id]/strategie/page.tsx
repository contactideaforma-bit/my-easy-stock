'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, supabase } from '@/lib/supabase';
import { GOALS, PAGE_STATUS, hasStaleDates, monthLabel, type Strategy, type StrategyInputs } from '@/lib/strategy';
import Icon from '@/components/Icon';
import { useSite } from '../ctx';

type Row = { id: string; inputs: StrategyInputs; content: Strategy; created_at: string };
const EMPTY: StrategyInputs = { goal: GOALS[0], audience: '', zone: '', offer: '', competitors: '', horizon: '6' };
const diffChip = (d: string) => (d === 'faible' ? 'ok' : d === 'forte' ? 'critical' : 'warning');
const statusChip = (s: string) => (s === 'existante' ? 'ok' : s === 'a_creer' ? 'info' : 'warning');

export default function StrategiePage() {
  const { site } = useSite();
  const [rows, setRows] = useState<Row[]>([]);
  const [cur, setCur] = useState<Row | null>(null);
  const [form, setForm] = useState<StrategyInputs>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase().from('seo_strategies').select('*').eq('site_id', site.id).order('created_at', { ascending: false });
    setRows((data as Row[]) || []);
    setCur((data as Row[])?.[0] || null);
    if (data?.[0]) setForm({ ...EMPTY, ...(data[0] as Row).inputs });
    setLoaded(true);
  }, [site.id]);
  useEffect(() => { load(); }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    try {
      setStep('1/2 — Analyse du site et construction de la stratégie… (30 à 50 s)');
      const s = await api<Row>('/api/strategy', { siteId: site.id, step: 'strategy', inputs: form });
      setCur(s); setEditing(false);
      setStep('2/2 — Découpage en plan d’action sur 12 semaines… (30 à 50 s)');
      const p = await api<{ created: number }>('/api/strategy', { siteId: site.id, step: 'plan', strategyId: s.id });
      setMsg(`Stratégie prête : ${p.created} tâches ajoutées au plan d’action.`);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setStep(null); }
  }
  async function track() {
    if (!cur) return;
    setErr(null);
    try { const r = await api<{ added: number }>('/api/strategy', { siteId: site.id, step: 'track', strategyId: cur.id }); setMsg(`${r.added} mots-clés de la stratégie ajoutés au suivi des positions.`); }
    catch (e: any) { setErr(e.message); }
  }
  async function replan() {
    if (!cur) return;
    setErr(null); setStep('Recalcul du plan d’action…');
    try { const p = await api<{ created: number }>('/api/strategy', { siteId: site.id, step: 'plan', strategyId: cur.id }); setMsg(`${p.created} tâches ajoutées au plan d’action.`); }
    catch (e: any) { setErr(e.message); } finally { setStep(null); }
  }
  async function refresh() {
    if (!cur) return;
    setErr(null); setMsg(null);
    try {
      setStep('1/2 — Mise à jour des dates de l’objectif et des indicateurs…');
      const r = await api<Row>('/api/strategy', { siteId: site.id, step: 'refresh', strategyId: cur.id });
      setCur(r);
      setStep('2/2 — Recalcul du plan d’action sur 12 semaines… (30 à 50 s)');
      const p = await api<{ created: number }>('/api/strategy', { siteId: site.id, step: 'plan', strategyId: r.id });
      setMsg(`Stratégie actualisée : ${p.created} tâches replanifiées à partir d’aujourd’hui.`);
      await load();
    } catch (e: any) { setErr(e.message); } finally { setStep(null); }
  }
  const set = (k: keyof StrategyInputs) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  if (!loaded) return <div className="shimmer" style={{ height: 240 }} />;

  const showForm = !cur || editing;
  const s = cur?.content;
  const stale = hasStaleDates(s);
  return (
    <div className="stack">
      {showForm && (
        <form onSubmit={generate} className="glass pad-lg stack fade-in">
          <div>
            <div className="kicker">Étape 1 — L’objectif</div>
            <h2 className="display" style={{ fontSize: 24 }}>Qu’est-ce que le site doit rapporter ?</h2>
            <p className="muted" style={{ margin: '6px 0 0', maxWidth: 680 }}>L’IA croise vos réponses avec le dernier audit et les mots-clés suivis pour construire la stratégie, puis la découpe en tâches datées. Plus vous êtes précise, plus le plan sera juste.</p>
          </div>
          <div className="grid g2">
            <label className="field"><span className="label">Objectif principal</span><select className="select" value={form.goal} onChange={set('goal')}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></label>
            <label className="field"><span className="label">Horizon</span><select className="select" value={form.horizon} onChange={set('horizon')}><option value="3">3 mois</option><option value="6">6 mois</option><option value="12">12 mois</option></select></label>
            <label className="field"><span className="label">Clients visés</span><input className="input" placeholder="Ex. gérants de carrosseries indépendantes, 2 à 15 salariés" value={form.audience} onChange={set('audience')} /></label>
            <label className="field"><span className="label">Zone géographique</span><input className="input" placeholder="Ex. France entière, ou Marseille et Bouches-du-Rhône" value={form.zone} onChange={set('zone')} /></label>
          </div>
          <label className="field"><span className="label">Offre et différence avec les concurrents</span><textarea className="textarea" placeholder="Ce que vous vendez, à quel prix, pourquoi vous plutôt qu’un autre…" value={form.offer} onChange={set('offer')} /></label>
          <label className="field"><span className="label">Concurrents connus (sites)</span><input className="input" placeholder="concurrent1.fr, concurrent2.fr" value={form.competitors} onChange={set('competitors')} /></label>
          {!site.notes && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Astuce : renseignez aussi l’activité du site via « Modifier » en haut de page.</p>}
          {err && <p className="err">{err}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {cur && <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Annuler</button>}
            <button className="btn primary" disabled={!!step}>{step ? <><span className="spinner" />Génération…</> : <><Icon name="spark" />{cur ? 'Refaire la stratégie' : 'Construire ma stratégie'}</>}</button>
          </div>
        </form>
      )}

      {step && <div className="glass pad row" style={{ gap: 14 }}><span className="spinner" style={{ color: 'var(--accent)' }} /><span>{step}</span></div>}
      {msg && <div className="glass sm pad row between wrap"><span>{msg}</span><Link className="btn sm primary" href={`/sites/${site.id}/plan`}>Voir le plan d’action</Link></div>}
      {!showForm && err && <p className="err">{err}</p>}

      {s && !editing && (
        <>
          {stale && !step && (
            <div className="glass sm pad row between wrap" style={{ border: '1px solid var(--bad)', gap: 12 }}>
              <span><strong>Dates à actualiser.</strong> Cette stratégie a été générée sans la date du jour : son objectif ou ses indicateurs mentionnent une année déjà passée. L’actualisation corrige les dates et replanifie les tâches à partir d’aujourd’hui (les tâches en cours ou terminées sont conservées).</span>
              <button className="btn sm primary" onClick={refresh}><Icon name="spark" />Actualiser</button>
            </div>
          )}
          <div className="glass pad-lg fade-in">
            <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="kicker">Objectif</div>
                <h2 className="display" style={{ fontSize: 26, lineHeight: 1.15 }}>{s.objectif}</h2>
                <p className="muted" style={{ marginBottom: 0, textAlign: 'justify' }}>{s.positionnement}</p>
              </div>
              <div className="row wrap">
                <button className="btn sm" onClick={() => setEditing(true)}>Modifier l’objectif</button>
                <button className="btn sm" onClick={replan} disabled={!!step}>Recalculer le plan</button>
                {!stale && <button className="btn sm" onClick={refresh} disabled={!!step} title="Réécrit les dates de l’objectif et des indicateurs à partir d’aujourd’hui, puis recalcule le plan">Actualiser les dates</button>}
                <button className="btn sm primary" onClick={track}>Suivre ces mots-clés</button>
              </div>
            </div>
            {s.kpis?.length > 0 && (
              <div className="grid g4" style={{ marginTop: 20 }}>
                {s.kpis.map((k, i) => <div key={i} className="glass sm soft pad"><div className="muted" style={{ fontSize: 13 }}>{k.nom}</div><div className="display" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{k.cible}</div><div className="muted" style={{ fontSize: 12 }}>{k.delai}</div></div>)}
              </div>
            )}
            {s.cibles?.length > 0 && <div className="row wrap" style={{ gap: 8, marginTop: 16 }}>{s.cibles.map((c, i) => <span key={i} className="chip">{c}</span>)}</div>}
          </div>

          <div>
            <h3 className="display" style={{ fontSize: 20, margin: '6px 4px 12px' }}>Les piliers de contenu</h3>
            <div className="grid g2">
              {s.piliers?.map((p, i) => (
                <div key={i} className="glass pad fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div><strong style={{ fontSize: 17 }}>{p.theme}</strong><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Intention : {p.intention}</div></div>
                    <span className={`chip ${statusChip(p.page?.statut)}`}>{PAGE_STATUS[p.page?.statut] || p.page?.statut}</span>
                  </div>
                  <div style={{ margin: '10px 0', fontSize: 14 }}><span className="muted">Page : </span>{p.page?.titre}{p.page?.url && <span className="mono muted"> · {p.page.url}</span>}</div>
                  <table className="table"><tbody>
                    {p.mots_cles?.map((k, j) => <tr key={j}><td>{k.kw}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{k.priorite === 1 && <span className="chip warning" style={{ marginRight: 6 }}>Prioritaire</span>}<span className={`chip ${diffChip(k.difficulte)}`}>{k.difficulte}</span></td></tr>)}
                  </tbody></table>
                </div>
              ))}
            </div>
          </div>

          <div className="grid g2">
            <div className="glass pad"><h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>Gains rapides</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{s.quick_wins?.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}</ul></div>
            <div className="glass pad">
              <h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>Calendrier éditorial</h3>
              <table className="table"><tbody>{[...(s.contenus || [])].sort((a, b) => a.mois - b.mois).map((c, i) => <tr key={i}><td className="muted" style={{ whiteSpace: 'nowrap' }}>Mois {c.mois}<div style={{ fontSize: 11 }}>{cur ? monthLabel(cur.created_at, c.mois) : ''}</div></td><td><strong>{c.titre}</strong><div className="muted" style={{ fontSize: 12 }}>{c.type} · {c.mot_cle}</div></td></tr>)}</tbody></table>
            </div>
          </div>
          <div className="grid g3">
            {s.local?.length > 0 && <div className="glass pad"><h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>Référencement local</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{s.local.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}</ul></div>}
            {s.autorite?.length > 0 && <div className="glass pad"><h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>Notoriété & liens</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{s.autorite.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}</ul></div>}
            {s.risques?.length > 0 && <div className="glass pad"><h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>Points de vigilance</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{s.risques.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}</ul></div>}
          </div>
          {rows.length > 1 && (
            <div className="glass sm pad row wrap" style={{ gap: 8 }}>
              <span className="muted">Versions :</span>
              {rows.map((r) => <button key={r.id} className={`btn sm ${r.id === cur?.id ? 'primary' : ''}`} onClick={() => setCur(r)}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</button>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
