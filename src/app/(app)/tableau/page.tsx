'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSites } from '../ctx';
import SiteForm from '../SiteForm';
import Icon from '@/components/Icon';
import { ScoreRing, scoreColor } from '@/components/Score';

export default function Tableau() {
  const { sites, reload } = useSites();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const scored = sites.filter((s) => s.last_score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, s) => a + (s.last_score || 0), 0) / scored.length) : null;
  const own = sites.filter((s) => !s.client_name).length;

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <div className="kicker">Tableau de bord</div>
          <h1>Vos sites, en un regard</h1>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Ajouter un site</button>
      </div>

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="glass sm pad"><div className="muted">Sites suivis</div><div className="stat-num" style={{ marginTop: 8 }}>{sites.length}</div></div>
        <div className="glass sm pad"><div className="muted">Score moyen</div><div className="stat-num" style={{ marginTop: 8, color: scoreColor(avg) }}>{avg ?? '—'}</div></div>
        <div className="glass sm pad"><div className="muted">Mes sites</div><div className="stat-num" style={{ marginTop: 8 }}>{own}</div></div>
        <div className="glass sm pad"><div className="muted">Sites clients</div><div className="stat-num" style={{ marginTop: 8 }}>{sites.length - own}</div></div>
      </div>

      {!sites.length ? (
        <div className="glass empty">
          <h2 className="display" style={{ fontSize: 26 }}>Commencez par ajouter un site</h2>
          <p className="muted" style={{ maxWidth: 460, margin: '10px auto 20px' }}>Ajoutez ideaforma.fr ou le site d’un client : l’audit complet (technique, contenu, balises, vitesse mobile) se lance en un clic.</p>
          <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Ajouter un site</button>
        </div>
      ) : (
        <div className="grid g3">
          {sites.map((s, k) => (
            <Link key={s.id} href={`/sites/${s.id}`} className="glass pad fade-in" style={{ animationDelay: `${k * 0.05}s`, display: 'flex', gap: 18, alignItems: 'center' }}>
              <ScoreRing score={s.last_score ?? null} size={96} label="" />
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}><span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: s.color || '#7c8cff' }} /><strong style={{ fontSize: 17 }}>{s.name}</strong></div>
                <div className="mono muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>{s.url.replace(/^https?:\/\//, '')}</div>
                <div style={{ marginTop: 10 }}><span className="chip">{s.client_name ? `Client · ${s.client_name}` : 'Mon site'}</span></div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {adding && <SiteForm onClose={() => setAdding(false)} onSaved={async (id) => { setAdding(false); await reload(); router.push(`/sites/${id}`); }} />}
    </div>
  );
}
