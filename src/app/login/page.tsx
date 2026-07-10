'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase().auth.signInWithPassword({ email, password });
    if (err) setError('Email ou mot de passe incorrect.');
    else router.replace('/app');
    setLoading(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="glass-strong w-full max-w-sm p-8">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-512.png"
            alt="My Easy Stock"
            className="mx-auto mb-4 w-24 h-24 drop-shadow-[0_8px_20px_rgba(37,124,235,0.35)]"
          />
          <h1 className="text-2xl font-bold text-ink">My Easy Stock</h1>
          <p className="text-ink/60 text-sm mt-1">Votre stock, en toute clarté.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="text-rose-600 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? '…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-ink/45 text-xs mt-5">
          Accès sur invitation — contactez votre administrateur.
        </p>
      </div>
    </div>
  );
}
