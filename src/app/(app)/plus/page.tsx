'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconUsers, IconTruck, IconChart, IconLogout, IconClipboard, IconTag, IconTrash, IconCash } from '@/components/Icons';
import type { Category, Profile } from '@/lib/types';

export default function PlusPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<(Category & { nb: number })[]>([]);
  const [newCat, setNewCat] = useState('');
  const [catError, setCatError] = useState('');
  const router = useRouter();

  async function loadCategories() {
    const sb = supabase();
    const [{ data: cats }, { data: prods }] = await Promise.all([
      sb.from('categories').select('*').order('name'),
      sb.from('products').select('category_id').eq('archived', false),
    ]);
    const counts: Record<string, number> = {};
    (prods || []).forEach((p: any) => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    setCategories(((cats as any) || []).map((c: Category) => ({ ...c, nb: counts[c.id] || 0 })));
  }

  async function addCategory() {
    const n = newCat.trim();
    if (!n) return;
    setCatError('');
    const { error } = await supabase().from('categories').insert({ name: n });
    if (error) {
      setCatError(error.code === '23505' ? 'Cette catégorie existe déjà.' : error.message);
      return;
    }
    setNewCat('');
    loadCategories();
  }

  async function deleteCategory(c: Category & { nb: number }) {
    const msg = c.nb > 0
      ? `Supprimer « ${c.name} » ? Les ${c.nb} produit(s) associés resteront, sans catégorie.`
      : `Supprimer « ${c.name} » ?`;
    if (!confirm(msg)) return;
    await supabase().from('categories').delete().eq('id', c.id);
    loadCategories();
  }

  useEffect(() => {
    loadCategories();
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
    { href: '/ventes', label: 'Journal des ventes', desc: 'Historique complet, annulation et remise en stock', icon: IconCash },
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

      {/* Catégories d'articles */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <IconTag className="w-5 h-5 text-crystal-600" />
          <h2 className="section-title">Catégories d&apos;articles</h2>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            className="input flex-1 !py-2"
            placeholder="Nouvelle catégorie…"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button className="btn-primary !py-2 !px-4" onClick={addCategory}>Ajouter</button>
        </div>
        {catError && <p className="text-rose-600 text-sm mb-2">{catError}</p>}
        {categories.length === 0 ? (
          <p className="text-ink/55 text-sm">Aucune catégorie.</p>
        ) : (
          <ul className="space-y-1">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-ink">
                  {c.name} <span className="text-ink/45">· {c.nb} produit{c.nb > 1 ? 's' : ''}</span>
                </span>
                <button className="text-rose-500/80 p-1" onClick={() => deleteCategory(c)} aria-label={`Supprimer ${c.name}`}>
                  <IconTrash className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
