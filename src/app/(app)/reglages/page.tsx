'use client';

import { useEffect, useState } from 'react';
import { api, supabase } from '@/lib/supabase';
import { useSites } from '../ctx';

const KEYS = [
  { k: 'supabase', name: 'Supabase', env: 'NEXT_PUBLIC_SUPABASE_URL / ANON_KEY', what: 'Base de données et connexion.', required: true },
  { k: 'anthropic', name: 'Claude (Anthropic)', env: 'ANTHROPIC_API_KEY', what: 'Assistant IA : synthèses, balises, mots-clés, briefs.', required: true },
  { k: 'pagespeed', name: 'Google PageSpeed', env: 'GOOGLE_PSI_API_KEY', what: 'Vitesse mobile. Fonctionne sans clé, mais avec un quota partagé limité.' },
  { k: 'serper', name: 'Serper (positions Google)', env: 'SERPER_API_KEY', what: 'Suivi automatique des positions. Sans clé : saisie manuelle.' },
];

export default function Reglages() {
  const { userEmail } = useSites();
  const [st, setSt] = useState<Record<string, boolean> | null>(null);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api('/api/status').then(setSt).catch(() => setSt({})); }, []);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().auth.updateUser({ password: pw });
    setMsg(error ? error.message : 'Mot de passe mis à jour.');
    setPw('');
  }

  return (
    <div className="fade-in">
      <div className="page-head"><div><div className="kicker">Réglages</div><h1>Connexions & compte</h1></div></div>
      <div className="grid g-main">
        <div className="glass pad">
          <h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>Clés API</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Les clés se règlent dans Vercel → projet → Settings → Environment Variables, puis « Redeploy ». Elles ne sont jamais visibles dans le navigateur.</p>
          <table className="table"><tbody>
            {KEYS.map((x) => (
              <tr key={x.k}>
                <td><strong>{x.name}</strong>{x.required && <span className="chip" style={{ marginLeft: 8 }}>Requis</span>}<div className="muted" style={{ fontSize: 13 }}>{x.what}</div><div className="mono muted" style={{ fontSize: 12 }}>{x.env}</div></td>
                <td style={{ textAlign: 'right' }}>{st == null ? <span className="spinner" /> : <span className={`chip ${st[x.k] ? 'ok' : x.required ? 'critical' : 'warning'}`}>{st[x.k] ? 'Connecté' : 'Non configuré'}</span>}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <form className="glass pad stack" onSubmit={changePw}>
          <h3 className="display" style={{ fontSize: 18 }}>Mon compte</h3>
          <div className="muted">{userEmail}</div>
          <label className="field"><span className="label">Nouveau mot de passe</span><input className="input" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <button className="btn primary">Mettre à jour</button>
          {msg && <p className="muted">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
