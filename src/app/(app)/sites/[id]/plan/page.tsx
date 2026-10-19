'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { TASK_CATEGORIES, type Task } from '@/lib/tasks';
import { buildTaskPrompt } from '@/lib/taskprompt';
import type { Strategy } from '@/lib/strategy';
import Icon from '@/components/Icon';
import { useSite } from '../ctx';

const COLS: { id: Task['status']; label: string }[] = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'done', label: 'Fait' },
];
const SOURCE: Record<string, string> = { audit: 'Audit', strategy: 'Stratégie', manual: 'Manuel' };
const dots = (n: number) => '●'.repeat(n) + '○'.repeat(3 - n);
const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export default function PlanPage() {
  const { site } = useSite();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [cat, setCat] = useState('');
  const [prompt, setPrompt] = useState<{ title: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nt, setNt] = useState({ title: '', category: 'contenu', priority: 2, due_date: '', target_url: '', keyword: '', detail: '' });
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const db = supabase();
    const [{ data: t }, { data: s }] = await Promise.all([
      db.from('seo_tasks').select('*').eq('site_id', site.id),
      db.from('seo_strategies').select('content').eq('site_id', site.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setTasks((t as Task[]) || []);
    setStrategy((s?.content as Strategy) || null);
    setLoaded(true);
  }, [site.id]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => tasks.filter((t) => !cat || t.category === cat), [tasks, cat]);
  const sorted = (st: Task['status']) => visible.filter((t) => t.status === st).sort((a, b) =>
    st === 'done' ? (b.done_at || '').localeCompare(a.done_at || '') : a.priority - b.priority || (a.due_date || '9').localeCompare(b.due_date || '9') || b.impact - a.impact);

  const total = tasks.filter((t) => !(t.auto_note || '').startsWith('Ignoré')).length;
  const done = tasks.filter((t) => t.status === 'done' && !(t.auto_note || '').startsWith('Ignoré')).length;
  const today = new Date().toISOString().slice(0, 10);
  const late = tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length;

  async function move(t: Task, status: Task['status']) {
    const patch: Partial<Task> = { status, done_at: status === 'done' ? new Date().toISOString() : null, auto_note: status === 'done' ? null : t.auto_note };
    setTasks((l) => l.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    await supabase().from('seo_tasks').update(patch).eq('id', t.id);
  }
  async function ignore(t: Task) {
    if (!confirm('Ignorer cette tâche ? Elle ne sera plus recréée par les prochains audits.')) return;
    const patch = { status: 'done' as const, done_at: new Date().toISOString(), auto_note: 'Ignoré volontairement.' };
    setTasks((l) => l.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    await supabase().from('seo_tasks').update(patch).eq('id', t.id);
  }
  async function remove(t: Task) {
    if (!confirm(`Supprimer « ${t.title} » ?`)) return;
    setTasks((l) => l.filter((x) => x.id !== t.id));
    await supabase().from('seo_tasks').delete().eq('id', t.id);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().from('seo_tasks').insert({ site_id: site.id, source: 'manual', title: nt.title, detail: nt.detail || null, category: nt.category, priority: nt.priority, due_date: nt.due_date || null, target_url: nt.target_url || null, keyword: nt.keyword || null });
    if (error) return alert(error.message);
    setNt({ title: '', category: 'contenu', priority: 2, due_date: '', target_url: '', keyword: '', detail: '' });
    setAdding(false); load();
  }

  if (!loaded) return <div className="shimmer" style={{ height: 240 }} />;
  if (!tasks.length) {
    return (
      <div className="glass empty">
        <h2 className="display" style={{ fontSize: 26 }}>Pas encore de plan d’action</h2>
        <p className="muted" style={{ maxWidth: 520, margin: '10px auto 20px' }}>Les tâches arrivent toutes seules : chaque audit ajoute les corrections à faire, et la stratégie ajoute les pages et contenus à créer semaine par semaine.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn primary" href={`/sites/${site.id}/strategie`}><Icon name="spark" />Construire la stratégie</Link>
          <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" />Tâche manuelle</button>
        </div>
        {adding && <AddForm nt={nt} setNt={setNt} add={add} close={() => setAdding(false)} />}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="glass pad row between wrap" style={{ gap: 18 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row between" style={{ marginBottom: 8 }}><strong>Avancement du plan</strong><span className="muted">{done}/{total} tâches · {total ? Math.round((done / total) * 100) : 0} %</span></div>
          <div className="meter"><i style={{ width: `${total ? (done / total) * 100 : 0}%`, background: 'linear-gradient(90deg, #0fa37f, #6d5efc)' }} /></div>
        </div>
        <div className="row wrap">
          {late > 0 && <span className="chip critical">{late} en retard</span>}
          <select className="select" style={{ width: 'auto', height: 38 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Toutes catégories</option>
            {Object.entries(TASK_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn sm" onClick={() => setAdding(true)}><Icon name="plus" />Tâche</button>
        </div>
      </div>
      <p className="muted" style={{ margin: '0 4px', fontSize: 13 }}>Les tâches issues de l’audit se cochent toutes seules quand le problème disparaît au prochain audit (manuel ou automatique chaque semaine).</p>

      <div className="grid g3" style={{ alignItems: 'start' }}>
        {COLS.map((c) => (
          <div key={c.id} className="glass soft pad" style={{ padding: 14 }}>
            <div className="row between" style={{ padding: '4px 6px 12px' }}><strong>{c.label}</strong><span className="chip">{sorted(c.id).length}</span></div>
            <div className="stack" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 2 }}>
              {sorted(c.id).map((t) => (
                <div key={t.id} className="issue" style={{ padding: '12px 14px', opacity: t.status === 'done' ? 0.75 : 1 }}>
                  <div className="row wrap" style={{ gap: 6, marginBottom: 6 }}>
                    <span className={`chip ${t.priority === 1 ? 'critical' : t.priority === 2 ? 'warning' : 'info'}`}>P{t.priority}</span>
                    <span className="chip">{TASK_CATEGORIES[t.category] || t.category}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{SOURCE[t.source]}</span>
                  </div>
                  <div style={{ fontWeight: 600, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
                  {(t.target_url || t.keyword) && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.target_url && <span className="mono">{t.target_url}</span>}{t.target_url && t.keyword ? ' · ' : ''}{t.keyword && <>« {t.keyword} »</>}</div>}
                  <div className="row between" style={{ marginTop: 6, fontSize: 12 }}>
                    <span className="muted" title="Impact / effort">Impact {dots(t.impact)} · Effort {dots(t.effort)}</span>
                    {t.due_date && t.status !== 'done' && <span style={{ color: t.due_date < today ? 'var(--bad)' : 'var(--ink-mute)', fontWeight: 600 }}>{fmt(t.due_date)}</span>}
                  </div>
                  {t.auto_note && <div style={{ fontSize: 12, marginTop: 6, color: t.status === 'done' ? 'var(--good)' : 'var(--mid)' }}>{t.auto_note}</div>}
                  {t.detail && <details style={{ marginTop: 6 }}><summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>Détails</summary><p style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: '6px 0 0', textAlign: 'justify' }}>{t.detail}</p></details>}
                  <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                    {t.status !== 'done' && <button className="btn sm" onClick={() => { setPrompt({ title: t.title, text: buildTaskPrompt(site, t, strategy) }); setCopied(false); }}><Icon name="spark" size={14} />Prompt Claude</button>}
                    {t.status === 'todo' && <button className="btn sm" onClick={() => move(t, 'doing')}>Commencer</button>}
                    {t.status !== 'done' && <button className="btn sm primary" onClick={() => move(t, 'done')}>Fait ✓</button>}
                    {t.status === 'done' && <button className="btn sm" onClick={() => move(t, 'todo')}>Rouvrir</button>}
                    {t.source === 'audit' && t.status !== 'done' && <button className="btn sm ghost" onClick={() => ignore(t)}>Ignorer</button>}
                    {t.source !== 'audit' && <button className="btn sm ghost danger" onClick={() => remove(t)}>×</button>}
                  </div>
                </div>
              ))}
              {!sorted(c.id).length && <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>—</p>}
            </div>
          </div>
        ))}
      </div>

      {adding && <AddForm nt={nt} setNt={setNt} add={add} close={() => setAdding(false)} />}
      {prompt && (
        <div className="overlay" onClick={() => setPrompt(null)}>
          <div className="glass pad-lg" style={{ width: 'min(820px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="row between wrap" style={{ marginBottom: 10 }}>
              <div><div className="kicker">Prompt pour Claude</div><strong>{prompt.title}</strong></div>
              <div className="row"><button className="btn primary" onClick={async () => { await navigator.clipboard.writeText(prompt.text); setCopied(true); }}>{copied ? 'Copié ✓' : 'Copier'}</button><button className="btn ghost" onClick={() => setPrompt(null)}>Fermer</button></div>
            </div>
            <textarea className="textarea mono" readOnly value={prompt.text} style={{ minHeight: 380, fontSize: 12.5 }} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddForm({ nt, setNt, add, close }: { nt: any; setNt: (v: any) => void; add: (e: React.FormEvent) => void; close: () => void }) {
  return (
    <div className="overlay" onClick={close}>
      <form className="glass pad-lg modal stack" onClick={(e) => e.stopPropagation()} onSubmit={add} style={{ textAlign: 'left' }}>
        <h2 className="display" style={{ fontSize: 22 }}>Nouvelle tâche</h2>
        <label className="field"><span className="label">Intitulé</span><input className="input" required value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} placeholder="Ex. Créer la page « Logiciel sinistres carrosserie »" autoFocus /></label>
        <div className="grid g2">
          <label className="field"><span className="label">Catégorie</span><select className="select" value={nt.category} onChange={(e) => setNt({ ...nt, category: e.target.value })}>{Object.entries(TASK_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span className="label">Priorité</span><select className="select" value={nt.priority} onChange={(e) => setNt({ ...nt, priority: Number(e.target.value) })}><option value={1}>Haute</option><option value={2}>Normale</option><option value={3}>Basse</option></select></label>
          <label className="field"><span className="label">Page</span><input className="input mono" value={nt.target_url} onChange={(e) => setNt({ ...nt, target_url: e.target.value })} placeholder="/page" /></label>
          <label className="field"><span className="label">Échéance</span><input className="input" type="date" value={nt.due_date} onChange={(e) => setNt({ ...nt, due_date: e.target.value })} /></label>
        </div>
        <label className="field"><span className="label">Mot-clé visé</span><input className="input" value={nt.keyword} onChange={(e) => setNt({ ...nt, keyword: e.target.value })} /></label>
        <label className="field"><span className="label">Détails</span><textarea className="textarea" value={nt.detail} onChange={(e) => setNt({ ...nt, detail: e.target.value })} /></label>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn ghost" onClick={close}>Annuler</button><button className="btn primary">Ajouter</button></div>
      </form>
    </div>
  );
}
