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
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErr('Email ou mot de passe incorrect.');
    router.replace('/tableau');
  }
  async function forgot() {
    if (!email) return setErr('Indiquez votre email puis cliquez à nouveau.');
    await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reglages` });
    setInfo('Un lien pour choisir un nouveau mot de passe vient de vous être envoyé.');
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: 'min(980px, 100%)' }} className="grid g2">
        <section className="pad-lg fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 40 }}>
          <Logo size={40} />
          <div>
            <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 54px)', lineHeight: 1.02, fontWeight: 700 }}>Voir clair dans le référencement.</h1>
            <p className="muted" style={{ fontSize: 17, maxWidth: 420, marginTop: 16 }}>Audit technique, suivi des mots-clés et conseils rédigés par l’IA — pour vos sites et ceux de vos clients.</p>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="chip">Audit en 40 s</span><span className="chip">Core Web Vitals</span><span className="chip">Assistant IA</span><span className="chip">Rapport client</span>
          </div>
        </section>
        <form onSubmit={submit} className="glass pad-lg stack fade-in" style={{ alignSelf: 'center', animationDelay: '.1s' }}>
          <div>
            <h2 className="display" style={{ fontSize: 26 }}>Connexion</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>Accédez à votre espace SEO.</p>
          </div>
          <label className="field"><span className="label">Email</span><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span className="label">Mot de passe</span><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {err && <p className="err">{err}</p>}
          {info && <p style={{ color: 'var(--accent)' }}>{info}</p>}
          <button className="btn primary" style={{ width: '100%', height: 48 }} disabled={busy}>{busy ? <span className="spinner" /> : 'Se connecter'}</button>
          <button type="button" onClick={forgot} className="btn ghost sm" style={{ width: '100%' }}>Mot de passe oublié</button>
        </form>
      </div>
    </main>
  );
}
