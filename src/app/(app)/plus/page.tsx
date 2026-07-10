'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconUsers, IconTruck, IconChart, IconLogout, IconClipboard } from '@/components/Icons';
import type { Profile } from '@/lib/types';

export default function PlusPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const router = useRouter();

  useEffect(() => {
    const sb = supabase();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
      setProfile(p as any);
      if (p?.role === 'admin') {
        const { data: t } = await sb.from('profiles').select('*').order('created_at');
        setTeam((t as any) || []);
      }
    });
  }, []);

  async function setRole(id: string, role: 'admin' | 'vendeur') {
    await supabase().from('profiles').update({ role }).eq('id', id);
    const { data: t } = await supabase().from('profiles').select('*').order('created_at');
    setTeam((t as any) || []);
  }

  async function logout() {
    await supabase().auth.signOut();
    router.replace('/login');
  }

  const items = [
    { href: '/inventaire', label: 'Inventaire', desc: 'Comptage par scan, écarts, correction du stock', icon: IconClipboard },
    { href: '/clients', label: 'Clients & crédit', desc: 'Fiches clients, ardoises, règlements', icon: IconUsers },
    { href: '/fournisseurs', label: 'Fournisseurs & achats', desc: 'Commandes, réceptions de stock', icon: IconTruck },
    { href: '/stats', label: 'Statistiques', desc: 'Chiffre d’affaires, marges, top ventes', icon: IconChart },
  ];

  return (
    <div className="space-y-4 pb-8">
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-ink">Plus</h1>
        {profile && (
          <p className="text-ink/55 text-sm">
            {profile.full_name} · <span className="chip !text-[10px]">{profile.role}</span>
          </p>
        )}
      </header>

      <div className="space-y-3">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="glass flex items-center gap-4 p-4 transition active:scale-[0.98]">
            <span
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#3b9af6,#1d65d8)' }}
            >
              <it.icon />
            </span>
            <div>
              <p className="font-semibold text-ink">{it.label}</p>
              <p className="text-ink/55 text-xs">{it.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {profile?.role === 'admin' && team.length > 0 && (
        <section className="glass p-4">
          <h2 className="section-title mb-3">Équipe</h2>
          <ul className="space-y-2">
            {team.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{m.full_name || '—'}</span>
                {m.id === profile.id ? (
                  <span className="chip">vous · {m.role}</span>
                ) : (
                  <select
                    className="input !w-auto !py-1 !px-3 text-xs"
                    value={m.role}
                    onChange={(e) => setRole(m.id, e.target.value as any)}
                  >
                    <option value="vendeur" className="text-black">vendeur</option>
                    <option value="admin" className="text-black">admin</option>
                  </select>
                )}
              </li>
            ))}
          </ul>
          <p className="text-ink/45 text-xs mt-3">
            Pour ajouter un vendeur : il crée son compte depuis l&apos;écran de connexion, puis vous gérez son rôle ici.
          </p>
        </section>
      )}

      <button className="btn-glass w-full !text-rose-600" onClick={logout}>
        <IconLogout /> Se déconnecter
      </button>
    </div>
  );
}
