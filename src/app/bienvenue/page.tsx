'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Premier login : création du cabinet (la personne devient titulaire).
export default function Bienvenue() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [cabinet, setCabinet] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login'); });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase().rpc('mya_create_cabinet', { p_name: cabinet.trim(), p_full_name: name.trim() });
    setBusy(false);
    if (error) return setErr(error.message);
    router.replace('/app');
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={submit} className="card p-6 sm:p-8 w-full max-w-md space-y-4">
        <p className="chip-sage">Bienvenue</p>
        <h1 className="h1">Installons votre cabinet</h1>
        <p className="text-sm text-ink-mute">Deux informations suffisent pour commencer. Le reste (IBAN, logo, relances) se règle plus tard dans Paramètres.</p>
        <label className="block"><span className="label">Votre prénom et nom</span>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nadia Benali" /></label>
        <label className="block"><span className="label">Nom du cabinet</span>
          <input className="input" required value={cabinet} onChange={(e) => setCabinet(e.target.value)} placeholder="Cabinet NB Expertise" /></label>
        {err && <p className="text-sm text-clay-700">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? '…' : 'Ouvrir mon bureau'}</button>
      </form>
    </main>
  );
}
