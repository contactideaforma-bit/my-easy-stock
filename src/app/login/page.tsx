'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErr('Email ou mot de passe incorrect.');
    router.replace('/app');
  }

  async function forgot() {
    if (!email) return setErr('Indiquez votre email puis cliquez à nouveau.');
    await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/compte` });
    setInfo('Un lien pour choisir un nouveau mot de passe vient de vous être envoyé.');
  }

  return (
    <main className="min-h-dvh grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-sage-800 text-white">
        <Logo light />
        <div>
          <p className="font-display text-4xl leading-tight max-w-md">Tout le cabinet au même endroit. Les relances partent toutes seules.</p>
          <ul className="mt-8 space-y-2 text-sage-100 text-sm">
            <li>Chaque appel, mail ou message devient une demande suivie</li>
            <li>Rendez-vous avec rappel automatique au client la veille</li>
            <li>Factures d'honoraires et relances email, SMS, WhatsApp</li>
          </ul>
        </div>
        <p className="text-xs text-sage-200">My Assistanad — by IDEAFORMA</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden mb-6"><Logo /></div>
          <h1 className="h1">Bonjour</h1>
          <p className="text-ink-mute text-sm -mt-2">Connectez-vous à votre espace.</p>
          <label className="block"><span className="label">Email</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block"><span className="label">Mot de passe</span>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {err && <p className="text-sm text-clay-700">{err}</p>}
          {info && <p className="text-sm text-sage-700">{info}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
          <button type="button" onClick={forgot} className="text-xs text-ink-mute underline w-full">Mot de passe oublié</button>
        </form>
      </section>
    </main>
  );
}
