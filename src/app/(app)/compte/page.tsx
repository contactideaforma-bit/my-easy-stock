'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Field, Toast } from '@/components/Bits';

export default function Compte() {
  const { me, refresh } = useCabinet();
  const [name, setName] = useState(me.full_name);
  const [pwd, setPwd] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="h1">Mon compte</h1>
      <form className="card-pad space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase().from('mya_members').update({ full_name: name }).eq('user_id', me.user_id).eq('cabinet_id', me.cabinet_id);
        flash(error ? error.message : 'Nom mis à jour'); refresh();
      }}>
        <Field label="Prénom et nom"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <button className="btn-primary">Enregistrer</button>
      </form>
      <form className="card-pad space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase().auth.updateUser({ password: pwd });
        setPwd(''); flash(error ? error.message : 'Mot de passe changé');
      }}>
        <Field label="Nouveau mot de passe"><input type="password" minLength={8} required className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} /></Field>
        <button className="btn-primary">Changer le mot de passe</button>
      </form>
      <Toast msg={toast} />
    </div>
  );
}
