'use client';

import { useState } from 'react';
import { api, supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Field, Toast } from '@/components/Bits';
import Modal from '@/components/Modal';
import { IconPlus } from '@/components/Icons';

const COLORS = ['#2f7d6d', '#c2562d', '#5b6ee1', '#b7791f', '#8e4fb8', '#1f8aa8', '#d0467a'];

export default function Equipe() {
  const { members, me, refresh } = useCabinet();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (me.role !== 'titulaire') return <p className="text-ink-mute">Page réservée à la titulaire du cabinet.</p>;

  async function remove(userId: string, name: string) {
    if (!confirm(`Retirer ${name} du cabinet ? Son compte n'aura plus accès aux dossiers.`)) return;
    await supabase().from('mya_members').delete().eq('user_id', userId).eq('cabinet_id', me.cabinet_id);
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Équipe</h1>
          <p className="text-sm text-ink-mute">Chaque collaborateur a ses tâches, ses demandes et son agenda ; vous voyez tout.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><IconPlus className="w-4 h-4" />Ajouter un collaborateur</button>
      </div>
      <div className="card">
        {members.map((m) => (
          <div key={m.user_id} className="row">
            <span className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: m.color }}>
              {m.full_name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
            </span>
            <span className="flex-1"><span className="block text-sm font-semibold">{m.full_name}</span><span className="block text-xs text-ink-mute">{m.email}</span></span>
            <span className={m.role === 'titulaire' ? 'chip-ink' : 'chip-gray'}>{m.role}</span>
            {m.user_id !== me.user_id && <button className="text-xs text-ink-mute hover:text-clay-600" onClick={() => remove(m.user_id, m.full_name)}>Retirer</button>}
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau collaborateur">
        {open && <NewMember onDone={(msg) => { setOpen(false); setToast(msg); setTimeout(() => setToast(null), 6000); refresh(); }} used={members.map((m) => m.color)} />}
      </Modal>
      <Toast msg={toast} />
    </div>
  );
}

function NewMember({ onDone, used }: { onDone: (m: string) => void; used: string[] }) {
  const [f, setF] = useState({ full_name: '', email: '', password: '', role: 'collaborateur', color: COLORS.find((c) => !used.includes(c)) ?? COLORS[1] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await api('/api/team', f); onDone(`Compte créé. Transmettez à ${f.full_name} son email et son mot de passe.`); }
      catch (e: any) { setErr(e.message); }
      setBusy(false);
    }}>
      <Field label="Prénom et nom"><input className="input" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="Email de connexion"><input type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Mot de passe provisoire (8 caractères min.)"><input className="input" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      <Field label="Rôle">
        <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="collaborateur">Collaborateur (tout sauf paramètres et équipe)</option>
          <option value="titulaire">Associé(e) / titulaire (tous les droits)</option>
        </select>
      </Field>
      <div><span className="label">Couleur dans l'agenda</span>
        <div className="flex gap-2">{COLORS.map((c) => <button type="button" key={c} onClick={() => setF({ ...f, color: c })} className={`w-8 h-8 rounded-full ${f.color === c ? 'ring-2 ring-offset-2 ring-ink' : ''}`} style={{ background: c }} />)}</div>
      </div>
      {err && <p className="text-sm text-clay-700">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? '…' : 'Créer le compte'}</button>
    </form>
  );
}
