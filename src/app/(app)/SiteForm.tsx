'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Site } from '@/lib/types';

const COLORS = ['#7c8cff', '#4fd1c5', '#ff9f8a', '#c39bff', '#79b8ff', '#f5b44a'];

export default function SiteForm({ site, onClose, onSaved }: { site?: Site; onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState(site?.name || '');
  const [url, setUrl] = useState(site?.url || '');
  const [client, setClient] = useState(site?.client_name || '');
  const [notes, setNotes] = useState(site?.notes || '');
  const [color, setColor] = useState(site?.color || COLORS[0]);
  const [auto, setAuto] = useState(site?.auto_weekly ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { new URL(u); } catch { return setErr('Adresse invalide.'); }
    setBusy(true);
    const row = { name: name.trim() || new URL(u).host, url: u, client_name: client.trim() || null, notes: notes.trim() || null, color, auto_weekly: auto };
    const q = site ? supabase().from('seo_sites').update(row).eq('id', site.id).select('id').single() : supabase().from('seo_sites').insert(row).select('id').single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved(data.id);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="glass pad-lg modal stack" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 className="display" style={{ fontSize: 24 }}>{site ? 'Modifier le site' : 'Ajouter un site'}</h2>
        <label className="field"><span className="label">Adresse du site</span><input className="input mono" placeholder="www.exemple.fr" required value={url} onChange={(e) => setUrl(e.target.value)} autoFocus /></label>
        <label className="field"><span className="label">Nom</span><input className="input" placeholder="Ideaforma" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span className="label">Client (facultatif)</span><input className="input" placeholder="Laisser vide pour vos propres sites" value={client} onChange={(e) => setClient(e.target.value)} /></label>
        <label className="field"><span className="label">Activité, ville, cibles (aide l’IA)</span><textarea className="textarea" placeholder="Ex. organisme de formation à Marseille, formations bureautique et management pour salariés…" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="row">{COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} style={{ width: 28, height: 28, borderRadius: '50%', border: 0, cursor: 'pointer', background: c, boxShadow: color === c ? '0 0 0 3px #fff, 0 0 0 5px ' + c : 'inset 0 1px 0 rgba(255,255,255,.6)' }} />)}</div>
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#4f46e5' }} /><span>Suivi automatique chaque semaine <span className="muted">(audit + positions, le plan d’action se met à jour tout seul)</span></span></label>
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : site ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </div>
  );
}
