'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const sb = supabase();
    if (mode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setError('Email ou mot de passe incorrect.');
      else router.replace('/');
    } else {
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) setError(error.message);
      else {
        const { error: e2 } = await sb.auth.signInWithPassword({ email, password });
        if (!e2) router.replace('/');
        else setError('Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.');
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="glass-strong w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
            style={{ background: 'linear-gradient(135deg,#3b9af6,#1d65d8)', boxShadow: '0 8px 24px rgba(59,154,246,.5)' }}
          >
            📦
          </div>
          <h1 className="text-2xl font-bold text-ink">My Easy Stock</h1>
          <p className="text-ink/60 text-sm mt-1">Votre stock, en toute clarté.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <input className="input" placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="text-rose-600 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        <button
          className="w-full text-center text-ink/60 text-sm mt-5"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Premier accès ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  );
}
