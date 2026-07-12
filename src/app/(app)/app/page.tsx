'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate, fmtQty, variantLabel, startOfDay, daysAgo } from '@/lib/utils';
import { IconAlert, IconPlus, IconCash, IconUsers } from '@/components/Icons';
import DeliveryRun from '@/components/DeliveryRun';
import MyBot from '@/components/MyBot';

type FastMover = {
  id: string;
  name: string;
  label: string;
  stock: number;
  qty30: number; // pièces écoulées sur 30 jours (ventes + lots remis)
  daysLeft: number | null; // stock restant / vitesse — null si vitesse nulle
};
type OverdueLot = { id: string; vendorId: string; vendorName: string; date: string; dueDate: string; reste: number | null; days: number };
type RecentSale = { id: string; number: number; total: number; payment_method: string; created_at: string; vendors: { name: string } | null };
type VendorLine = {
  id: string;
  name: string;
  ca: number;
  nb: number;
  pieces: number;
  achat: number;
  verse: number; // somme déjà reversée sur la marchandise fournie
  delai: number | null; // délai moyen de paiement en jours (paiements rattachés à un lot)
};

function startOfMonth() {
  const d = startOfDay();
  d.setDate(1);
  return d;
}

export default function Dashboard() {
  const [kpi, setKpi] = useState({
    caMois: 0, nbMois: 0, caToday: 0, benefMois: 0,
    depotPieces: 0, depotAchat: 0, vendPieces: 0, vendAchat: 0,
  });
  const [vendorLines, setVendorLines] = useState<VendorLine[]>([]);
  const [overdue, setOverdue] = useState<OverdueLot[]>([]);
  const [fastMovers, setFastMovers] = useState<FastMover[]>([]);
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [name, setName] = useState('');
  // 🥚 Easter egg : 7 taps rapides sur « Bonjour » lancent le mini-jeu
  const eggTaps = useRef<number[]>([]);
  const [egg, setEgg] = useState(false);

  useEffect(() => {
    const sb = supabase();

    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await sb.from('profiles').select('full_name').eq('id', data.user.id).single();
      const raw = p?.full_name || '';
      // Ignore les noms issus de l'email (ex : "contact.ideaforma")
      setName(raw && !raw.includes('@') && !raw.includes('.') ? raw.split(' ')[0] : '');
    });

    (async () => {
      const monthStart = startOfMonth().toISOString();
      const todayStart = startOfDay().toISOString();

      const [{ data: monthSales }, { data: monthItems }, { data: variants }, { data: vendorStock }, { data: vendors }, { data: recentSales }] =
        await Promise.all([
          sb.from('sales').select('total,vendor_id,created_at').gte('created_at', monthStart).is('canceled_at', null),
          sb.from('sale_items').select('qty,purchase_price,sales!inner(created_at,canceled_at)').gte('sales.created_at', monthStart).is('sales.canceled_at', null),
          sb.from('product_variants').select('id,size,color,stock,products!inner(name,low_stock_threshold,purchase_price,archived)'),
          sb.from('vendor_stock').select('vendor_id,qty,product_variants(products(purchase_price))'),
          sb.from('vendors').select('id,name').eq('active', true),
          sb.from('sales').select('id,number,total,payment_method,created_at,vendors(name)').is('canceled_at', null).order('created_at', { ascending: false }).limit(5),
        ]);

      // Reversements : total versé par revendeur + délai moyen de paiement
      // (délai = temps entre la remise d'un lot et un paiement qui lui est rattaché)
      const [{ data: allPays }, { data: allAllocs }] = await Promise.all([
        sb.from('vendor_payments').select('vendor_id,amount,allocation_id,created_at'),
        sb.from('allocations').select('id,created_at'),
      ]);
      const allocDate: Record<string, string> = {};
      (allAllocs || []).forEach((a: any) => (allocDate[a.id] = a.created_at));
      const verseByVendor: Record<string, number> = {};
      const delaysByVendor: Record<string, number[]> = {};
      (allPays || []).forEach((p: any) => {
        verseByVendor[p.vendor_id] = (verseByVendor[p.vendor_id] || 0) + Number(p.amount);
        if (p.allocation_id && allocDate[p.allocation_id]) {
          const days = (new Date(p.created_at).getTime() - new Date(allocDate[p.allocation_id]).getTime()) / 86400000;
          if (days >= 0) (delaysByVendor[p.vendor_id] = delaysByVendor[p.vendor_id] || []).push(days);
        }
      });
      const delaiByVendor: Record<string, number> = {};
      Object.entries(delaysByVendor).forEach(([k, arr]) => {
        delaiByVendor[k] = Math.round(arr.reduce((s, d) => s + d, 0) / arr.length);
      });

      const caMois = (monthSales || []).reduce((s, x) => s + Number(x.total), 0);
      const caToday = (monthSales || []).filter((x) => x.created_at >= todayStart).reduce((s, x) => s + Number(x.total), 0);
      // Bénéfice du mois = CA encaissable (remises déduites) − coût d'achat des articles vendus
      const coutVendu = (monthItems || []).reduce((s: number, it: any) => s + it.qty * Number(it.purchase_price || 0), 0);
      const benefMois = caMois - coutVendu;

      const active = (variants || []).filter((v: any) => !v.products.archived);
      const depotPieces = active.reduce((s: number, v: any) => s + v.stock, 0);
      const depotAchat = active.reduce((s: number, v: any) => s + v.stock * Number(v.products.purchase_price || 0), 0);
      const vendPieces = (vendorStock || []).reduce((s: number, r: any) => s + r.qty, 0);
      const vendAchat = (vendorStock || []).reduce(
        (s: number, r: any) => s + r.qty * Number(r.product_variants?.products?.purchase_price || 0), 0);
      // Vitesse d'écoulement sur 30 jours : ventes + lots remis aux revendeurs
      const d30 = daysAgo(30).toISOString();
      const [{ data: sold30 }, { data: alloc30 }] = await Promise.all([
        sb
          .from('sale_items')
          .select('variant_id,qty,sales!inner(created_at,canceled_at)')
          .gte('sales.created_at', d30)
          .is('sales.canceled_at', null),
        sb
          .from('allocation_items')
          .select('variant_id,qty,allocations!inner(created_at,direction)')
          .gte('allocations.created_at', d30)
          .eq('allocations.direction', 'sortie'),
      ]);
      const outflow: Record<string, number> = {};
      (sold30 || []).forEach((it: any) => it.variant_id && (outflow[it.variant_id] = (outflow[it.variant_id] || 0) + it.qty));
      (alloc30 || []).forEach((it: any) => (outflow[it.variant_id] = (outflow[it.variant_id] || 0) + it.qty));
      const movers: FastMover[] = active
        .filter((v: any) => outflow[v.id] > 0)
        .map((v: any) => {
          const qty30 = outflow[v.id];
          return {
            id: v.id,
            name: v.products.name,
            label: variantLabel(v),
            stock: v.stock,
            qty30,
            daysLeft: qty30 > 0 ? Math.round(v.stock / (qty30 / 30)) : null,
          };
        })
        .sort((a: FastMover, b: FastMover) => b.qty30 - a.qty30)
        .slice(0, 6);

      // Ventes du mois par revendeur
      const byVendor: Record<string, { ca: number; nb: number }> = {};
      (monthSales || []).forEach((s: any) => {
        const k = s.vendor_id || 'depot';
        byVendor[k] = byVendor[k] || { ca: 0, nb: 0 };
        byVendor[k].ca += Number(s.total);
        byVendor[k].nb += 1;
      });
      const piecesByVendor: Record<string, number> = {};
      const achatByVendor: Record<string, number> = {};
      (vendorStock || []).forEach((r: any) => {
        piecesByVendor[r.vendor_id] = (piecesByVendor[r.vendor_id] || 0) + r.qty;
        achatByVendor[r.vendor_id] =
          (achatByVendor[r.vendor_id] || 0) + r.qty * Number(r.product_variants?.products?.purchase_price || 0);
      });

      const lines: VendorLine[] = [
        { id: 'depot', name: 'Dépôt (moi)', ca: byVendor['depot']?.ca || 0, nb: byVendor['depot']?.nb || 0, pieces: depotPieces, achat: depotAchat, verse: 0, delai: null },
        ...((vendors as any) || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          ca: byVendor[v.id]?.ca || 0,
          nb: byVendor[v.id]?.nb || 0,
          pieces: piecesByVendor[v.id] || 0,
          achat: achatByVendor[v.id] || 0,
          verse: verseByVendor[v.id] || 0,
          delai: delaiByVendor[v.id] ?? null,
        })),
      ].sort((a, b) => b.ca - a.ca);

      setKpi({ caMois, nbMois: (monthSales || []).length, caToday, benefMois, depotPieces, depotAchat, vendPieces, vendAchat });

      // Lots dont l'échéance de reversement est dépassée
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: lateAllocs }, { data: lotPays }] = await Promise.all([
        sb
          .from('allocations')
          .select('id,vendor_id,created_at,due_type,due_amount,due_date,vendors(name)')
          .eq('direction', 'sortie')
          .not('due_date', 'is', null)
          .lt('due_date', today),
        sb.from('vendor_payments').select('allocation_id,amount').not('allocation_id', 'is', null),
      ]);
      const paidByLot: Record<string, number> = {};
      (lotPays || []).forEach((p: any) => (paidByLot[p.allocation_id] = (paidByLot[p.allocation_id] || 0) + Number(p.amount)));
      setOverdue(
        ((lateAllocs as any[]) || [])
          .map((a): OverdueLot => {
            const du = a.due_type === 'ventes' || a.due_amount == null ? null : Number(a.due_amount);
            const reste = du != null ? Math.max(0, du - (paidByLot[a.id] || 0)) : null;
            return {
              id: a.id,
              vendorId: a.vendor_id,
              vendorName: a.vendors?.name || 'Revendeur',
              date: a.created_at,
              dueDate: a.due_date,
              reste,
              days: Math.max(1, Math.floor((Date.now() - new Date(a.due_date).getTime()) / 86400000)),
            };
          })
          .filter((l) => l.reste == null || l.reste > 0)
          .sort((a, b) => b.days - a.days)
          .slice(0, 6)
      );
      setVendorLines(lines);
      setFastMovers(movers);
      setRecent((recentSales as any) || []);
    })();
  }, []);

  const maxCa = Math.max(...vendorLines.map((l) => l.ca), 1);

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <p className="text-ink/60 text-sm">
          {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
        <h1
          className="text-2xl font-bold text-ink tracking-tight select-none"
          onClick={() => {
            const now = Date.now();
            eggTaps.current = [...eggTaps.current.filter((t) => now - t < 3000), now];
            if (eggTaps.current.length >= 7) {
              eggTaps.current = [];
              setEgg(true);
            }
          }}
        >
          Bonjour{name ? ` ${name}` : ''}
        </h1>
      </header>

      {egg && <DeliveryRun onClose={() => setEgg(false)} />}

      {/* My-bot commente l'état du jour */}
      <MyBot
        pose={
          overdue.length > 0
            ? 'panique'
            : fastMovers.some((m) => m.daysLeft != null && m.daysLeft <= 7)
              ? 'restock'
              : 'happy'
        }
        message={
          overdue.length > 0
            ? `${overdue.length} reversement${overdue.length > 1 ? 's' : ''} en retard — on va les récupérer !`
            : fastMovers.some((m) => m.daysLeft != null && m.daysLeft <= 7)
              ? `Ça part vite ! ${fastMovers.filter((m) => m.daysLeft != null && m.daysLeft <= 7).length} article${fastMovers.filter((m) => m.daysLeft != null && m.daysLeft <= 7).length > 1 ? 's' : ''} épuisé${fastMovers.filter((m) => m.daysLeft != null && m.daysLeft <= 7).length > 1 ? 's' : ''} d'ici ~7 jours à ce rythme — réassort conseillé pour continuer à vendre.`
              : 'Tout roule ! Reversements à jour et écoulement régulier.'
        }
      />

      {/* CA & bénéfice du mois — temps réel */}
      <div className="glass-strong p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-ink/60 text-xs">Chiffre d&apos;affaires du mois <span className="text-ink/40">(dépôt + revendeurs)</span></p>
          <p className="text-ink/45 text-xs">dont aujourd&apos;hui : {fmt(kpi.caToday)}</p>
        </div>
        <p className="text-3xl font-bold text-crystal-700 mt-1">{fmt(kpi.caMois)}</p>
        <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-ink/10">
          <p className="text-ink/60 text-xs">Bénéfice du mois <span className="text-ink/40">(CA − coût d&apos;achat des articles vendus)</span></p>
          <p className={`text-xl font-bold ${kpi.benefMois >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(kpi.benefMois)}</p>
        </div>
        <p className="text-ink/55 text-xs mt-1">{kpi.nbMois} vente{kpi.nbMois > 1 ? 's' : ''} enregistrée{kpi.nbMois > 1 ? 's' : ''} ce mois-ci</p>
      </div>

      {/* Stock en pièces et valeur d'achat */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">Stock au dépôt</p>
          <p className="text-lg font-bold text-ink mt-0.5">
            {fmtQty(kpi.depotPieces)} <span className="text-xs font-normal text-ink/50">pièces</span>
          </p>
          <p className="text-crystal-700 text-sm font-semibold">{fmt(kpi.depotAchat)}</p>
          <p className="text-ink/45 text-[10px]">valeur d&apos;achat du stock dépôt</p>
        </div>
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">Chez les revendeurs <span className="text-ink/40">(tous confondus)</span></p>
          <p className="text-lg font-bold text-ink mt-0.5">
            {fmtQty(kpi.vendPieces)} <span className="text-xs font-normal text-ink/50">pièces</span>
          </p>
          <p className="text-crystal-700 text-sm font-semibold">{fmt(kpi.vendAchat)}</p>
          <p className="text-ink/45 text-[10px]">valeur d&apos;achat du stock confié</p>
        </div>
      </div>

      {/* Actions rapides — flux grossiste d'abord, détail en second */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/vendeurs" className="btn-accent py-4">
          <IconUsers className="w-5 h-5" /> Remettre un lot
        </Link>
        <Link href="/produits/nouveau" className="btn-glass py-4">
          <IconPlus className="w-5 h-5" /> Produit
        </Link>
      </div>
      <Link href="/caisse" className="block text-center text-ink/50 text-xs -mt-2">
        <IconCash className="w-3.5 h-3.5 inline mr-1" />Vente au détail (occasionnelle) →
      </Link>

      {/* Ventes du mois par vendeur */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <IconUsers className="w-5 h-5 text-crystal-600" />
          <h2 className="section-title">Par revendeur — stock détenu et CA du mois</h2>
        </div>
        {vendorLines.length === 0 ? (
          <p className="text-ink/55 text-sm">Créez vos revendeurs pour suivre leurs ventes.</p>
        ) : (
          <ul className="space-y-3">
            {vendorLines.map((l) => (
              <li key={l.id}>
                <Link href={l.id === 'depot' ? '/produits' : `/vendeurs/${l.id}`} className="block">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink font-medium">{l.name}</span>
                    <span className="font-semibold text-ink">{fmt(l.ca)} <span className="text-ink/40 text-xs font-normal">CA du mois</span></span>
                  </div>
                  <p className="text-ink/50 text-xs">
                    {fmtQty(l.pieces)} pièce{l.pieces > 1 ? 's' : ''} en stock · valeur d&apos;achat {fmt(l.achat)} · {l.nb} vente{l.nb > 1 ? 's' : ''} ce mois
                  </p>
                  {l.id !== 'depot' && (
                    <p className="text-xs mb-1">
                      <span className="text-emerald-600 font-medium">déjà versé {fmt(l.verse)}</span>
                      <span className="text-ink/50">
                        {l.delai != null ? ` · paie en ~${l.delai} j en moyenne` : ' · délai de paiement : pas encore mesuré'}
                      </span>
                    </p>
                  )}
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(13,43,78,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(l.ca / maxCa) * 100}%`, background: 'linear-gradient(90deg,#60b8fa,#257ceb)' }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Retards de reversement */}
      {overdue.length > 0 && (
        <section className="glass-strong p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconAlert className="w-5 h-5 text-rose-500" />
            <h2 className="section-title !text-rose-700/80">Reversements en retard</h2>
          </div>
          <ul className="space-y-2">
            {overdue.map((l) => (
              <li key={l.id}>
                <Link href={`/lots/${l.id}`} className="flex items-center justify-between text-sm">
                  <span className="text-ink min-w-0 truncate">
                    <span className="font-medium">{l.vendorName}</span>
                    <span className="text-ink/45"> · lot du {fmtDate(l.date).split(' ').slice(0, 3).join(' ')}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="chip chip-danger !text-[10px]">{l.days} j de retard</span>
                    <span className="font-semibold text-rose-600">{l.reste != null ? fmt(l.reste) : 'au réel'}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Vitesse de vente : ce qui s'écoule le plus vite (ventes + lots, 30 j) */}
      {fastMovers.length > 0 && (
        <section className="glass p-4">
          <h2 className="section-title mb-1">Vitesse de vente — top écoulement</h2>
          <p className="text-ink/45 text-xs mb-3">
            Pièces écoulées sur 30 jours (ventes + lots remis) et durée estimée du stock restant à ce rythme.
          </p>
          <ul className="space-y-2">
            {fastMovers.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm gap-2">
                <span className="text-ink min-w-0 truncate">
                  {m.name} <span className="text-ink/55">· {m.label}</span>
                  <span className="text-ink/45"> — {fmtQty(m.qty30)} pcs/30 j</span>
                </span>
                <span className={`chip shrink-0 ${m.stock === 0 ? 'chip-danger' : m.daysLeft != null && m.daysLeft <= 7 ? 'chip-warn' : 'chip-ok'}`}>
                  {m.stock === 0 ? 'Épuisé ✓' : m.daysLeft != null ? `stock ≈ ${fmtQty(m.daysLeft)} j` : `${fmtQty(m.stock)} rest.`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dernières ventes */}
      <section className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Dernières ventes</h2>
          <Link href="/ventes" className="text-crystal-700 text-xs font-medium">Tout voir →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-ink/55 text-sm">Aucune vente pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  #{s.number} <span className="text-ink/45">· {s.vendors?.name || 'Dépôt'} · {fmtDate(s.created_at)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`chip ${s.payment_method === 'credit' ? 'chip-warn' : 'chip-ok'}`}>
                    {s.payment_method === 'especes' ? 'Espèces' : s.payment_method === 'carte' ? 'Carte' : 'Crédit'}
                  </span>
                  <span className="font-semibold text-ink">{fmt(Number(s.total))}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
