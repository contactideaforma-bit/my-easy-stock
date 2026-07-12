'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fmt, fmtQty, generateEAN13, generateSKU } from '@/lib/utils';
import { scanBonImage, type ScanLine } from '@/lib/scan';
import { IconBack, IconCamera, IconCheck, IconPlus, IconTrash } from '@/components/Icons';
import type { Category } from '@/lib/types';

type GLine = { size: string | null; color: string | null; qty: number };
type Group = {
  name: string;
  purchase: string; // prix d'achat unitaire
  saleMin: string; // prix de vente minimum
  saleMax: string; // prix de vente maximum (= prix conseillé enregistré)
  categoryId: string;
  lines: GLine[];
  existing: { id: string; name: string } | null; // produit déjà au catalogue ?
  useExisting: boolean;
};

const norm = (s: string | null | undefined) => (s || '').toLowerCase().trim();

/**
 * Création de produits par scan d'un bon d'achat :
 * photo/upload → analyse automatique → vérification et ajustement
 * (noms, prix, tailles, couleurs, quantités) → entrée en stock.
 * Les articles déjà au catalogue sont détectés : leur stock est simplement augmenté.
 */
export default function ScanBonProduitsPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'upload' | 'analyzing' | 'review' | 'saving'>('upload');
  const [preview, setPreview] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ created: number; updated: number; pieces: number } | null>(null);
  // Création de catégorie à la volée : index du groupe concerné + nom saisi
  const [newCatFor, setNewCatFor] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    supabase().from('categories').select('*').order('name').then(({ data }) => setCategories(data || []));
  }, []);

  async function analyze(file: File) {
    setError('');
    setPhase('analyzing');
    setPreview(URL.createObjectURL(file));
    try {
      const { lines } = await scanBonImage(file);
      if (lines.length === 0) {
        setError("Aucune ligne d'article détectée. Reprenez la photo bien à plat, nette et éclairée.");
        setPhase('upload');
        return;
      }
      // Regroupe les lignes par désignation → un produit par désignation
      const map = new Map<string, ScanLine[]>();
      for (const l of lines) {
        const k = norm(l.designation);
        map.set(k, [...(map.get(k) || []), l]);
      }
      const sb = supabase();
      const gs: Group[] = [];
      for (const ls of Array.from(map.values())) {
        const costs = ls.map((l) => l.unit_cost).filter((c): c is number => c != null);
        const purchase = costs.length ? Math.round((costs.reduce((s, c) => s + c, 0) / costs.length) * 100) / 100 : 0;
        // Produit déjà existant au catalogue ?
        const { data: hit } = await sb
          .from('products')
          .select('id,name')
          .eq('archived', false)
          .ilike('name', `%${ls[0].designation.trim()}%`)
          .limit(1);
        gs.push({
          name: ls[0].designation.trim(),
          purchase: purchase ? String(purchase) : '',
          saleMin: purchase ? String(Math.round((purchase * 1.8) / 0.5) * 0.5) : '',
          saleMax: purchase ? String(Math.round((purchase * 2.4) / 0.5) * 0.5) : '',
          categoryId: '',
          lines: ls.map((l) => ({ size: l.size, color: l.color, qty: l.qty })),
          existing: hit && hit.length ? (hit[0] as any) : null,
          useExisting: !!(hit && hit.length),
        });
      }
      setGroups(gs);
      setPhase('review');
    } catch (e: any) {
      setError(e?.message || 'Erreur pendant l’analyse.');
      setPhase('upload');
    }
  }

  const setG = (i: number, patch: Partial<Group>) => setGroups((prev) => prev.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const setL = (i: number, k: number, patch: Partial<GLine>) =>
    setGroups((prev) => prev.map((g, j) => (j === i ? { ...g, lines: g.lines.map((l, m) => (m === k ? { ...l, ...patch } : l)) } : g)));

  const totalPieces = groups.reduce((s, g) => s + g.lines.reduce((x, l) => x + l.qty, 0), 0);
  const totalAchat = groups.reduce((s, g) => s + g.lines.reduce((x, l) => x + l.qty, 0) * (Number(g.purchase) || 0), 0);
  const totalVenteMin = groups.reduce((s, g) => s + g.lines.reduce((x, l) => x + l.qty, 0) * (Number(g.saleMin) || 0), 0);
  const totalVenteMax = groups.reduce((s, g) => s + g.lines.reduce((x, l) => x + l.qty, 0) * (Number(g.saleMax) || 0), 0);

  async function createCategory(groupIndex: number) {
    const n = newCatName.trim();
    if (!n) return;
    const { data, error: err } = await supabase().from('categories').insert({ name: n }).select().single();
    if (err) {
      setError(err.code === '23505' ? 'Cette catégorie existe déjà.' : err.message);
      return;
    }
    setCategories((prev) => [...prev, data as any].sort((a, b) => a.name.localeCompare(b.name)));
    setG(groupIndex, { categoryId: (data as any).id });
    setNewCatFor(null);
    setNewCatName('');
    setError('');
  }

  async function save() {
    for (const g of groups) {
      if (!g.useExisting) {
        if (!g.name.trim() || !Number(g.saleMax)) {
          setError(`« ${g.name || 'Sans nom'} » : nom et prix de vente max obligatoires pour créer un produit.`);
          return;
        }
        if (Number(g.saleMin) > Number(g.saleMax)) {
          setError(`« ${g.name} » : le prix de vente min est supérieur au max.`);
          return;
        }
      }
    }
    setPhase('saving');
    setError('');
    const sb = supabase();
    let created = 0;
    let updated = 0;

    try {
      for (const g of groups) {
        if (g.useExisting && g.existing) {
          // Produit connu : on augmente le stock des variantes correspondantes
          const { data: vars } = await sb.from('product_variants').select('*').eq('product_id', g.existing.id);
          for (const l of g.lines) {
            const hit = (vars || []).find((v: any) => norm(v.size) === norm(l.size) && norm(v.color) === norm(l.color));
            if (hit) {
              const { error: aErr } = await sb.rpc('adjust_stock', { p_variant_id: (hit as any).id, p_qty_change: l.qty });
              if (aErr) throw aErr;
            } else {
              const { error: vErr } = await sb.from('product_variants').insert({
                product_id: g.existing.id,
                size: l.size,
                color: l.color,
                sku: generateSKU(g.existing.name, l.size, l.color),
                barcode: generateEAN13(),
                stock: l.qty,
              });
              if (vErr) throw vErr;
            }
          }
          updated++;
        } else {
          // Nouveau produit + variantes avec stock initial
          const { data: product, error: pErr } = await sb
            .from('products')
            .insert({
              name: g.name.trim(),
              category_id: g.categoryId || null,
              purchase_price: Number(g.purchase) || 0,
              sale_price: Number(g.saleMax), // prix conseillé = haut de fourchette
              price_min: Number(g.saleMin) || null,
              price_max: Number(g.saleMax) || null,
              low_stock_threshold: 3,
            })
            .select()
            .single();
          if (pErr || !product) throw pErr || new Error('Création impossible.');
          const { error: vErr } = await sb.from('product_variants').insert(
            g.lines.map((l) => ({
              product_id: (product as any).id,
              size: l.size,
              color: l.color,
              sku: generateSKU(g.name, l.size, l.color),
              barcode: generateEAN13(),
              stock: l.qty,
            }))
          );
          if (vErr) throw vErr;
          created++;
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de l’enregistrement.');
      setPhase('review');
      return;
    }
    setDone({ created, updated, pieces: totalPieces });
  }

  /* ---------- Succès ---------- */
  if (done)
    return (
      <div className="space-y-4 pb-8">
        <div className="glass-strong p-8 text-center space-y-4 mt-6">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#34d399,#059669)' }}>
            <IconCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Stock mis à jour</h2>
            <p className="text-ink/60 text-sm mt-1">
              {done.created > 0 && <>{done.created} produit{done.created > 1 ? 's' : ''} créé{done.created > 1 ? 's' : ''}</>}
              {done.created > 0 && done.updated > 0 && ' · '}
              {done.updated > 0 && <>{done.updated} produit{done.updated > 1 ? 's' : ''} existant{done.updated > 1 ? 's' : ''} réapprovisionné{done.updated > 1 ? 's' : ''}</>}
              {' — '}{fmtQty(done.pieces)} pièce{done.pieces > 1 ? 's' : ''} entrée{done.pieces > 1 ? 's' : ''} en stock.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-glass" onClick={() => { setDone(null); setGroups([]); setPreview(''); setPhase('upload'); }}>
              Scanner un autre bon
            </button>
            <button className="btn-primary" onClick={() => router.push('/produits')}>Voir les produits</button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/produits" className="btn-glass !p-2"><IconBack /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">Ajouter par scan d&apos;un bon</h1>
          <p className="text-ink/50 text-xs">Les articles du bon sont créés (ou réapprovisionnés) automatiquement</p>
        </div>
      </header>

      {phase === 'upload' && (
        <>
          <label className="glass-strong flex flex-col items-center gap-3 p-8 cursor-pointer text-center">
            <IconCamera className="w-10 h-10 text-crystal-500" />
            <div>
              <p className="font-semibold text-ink">Prendre en photo le bon d&apos;achat</p>
              <p className="text-ink/55 text-xs mt-1">ou choisir une image depuis l&apos;appareil (JPG, PNG…)</p>
            </div>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && analyze(e.target.files[0])} />
          </label>
          <p className="text-ink/45 text-xs px-1">
            Vous vérifiez et ajustez tout (noms, prix, tailles, couleurs, quantités) avant que le stock ne soit modifié.
            Les articles déjà au catalogue sont reconnus : leur stock est simplement augmenté.
          </p>
          {error && <p className="text-rose-600 text-sm px-1">{error}</p>}
        </>
      )}

      {phase === 'analyzing' && (
        <div className="glass-strong p-8 text-center space-y-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-52 mx-auto rounded-2xl object-contain" />
          )}
          <p className="text-crystal-800 animate-pulse font-medium">Lecture du bon en cours…</p>
          <p className="text-ink/50 text-xs">Extraction des articles puis comparaison avec votre catalogue.</p>
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <>
          <p className="text-ink/55 text-xs px-1">
            Vérifiez chaque article avant l&apos;entrée en stock — tout est modifiable :
          </p>

          {groups.map((g, i) => (
            <div key={i} className="glass p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <input
                  className="input !py-2 flex-1 font-semibold"
                  value={g.name}
                  onChange={(e) => setG(i, { name: e.target.value })}
                  aria-label="Nom du produit"
                />
                <button className="text-rose-500/70 p-2 shrink-0" onClick={() => setGroups((prev) => prev.filter((_, j) => j !== i))} aria-label="Retirer cet article">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>

              {g.existing && (
                <div className="grid grid-cols-2 gap-2">
                  <button className={g.useExisting ? 'btn-primary !py-2 text-xs' : 'btn-glass !py-2 text-xs'} onClick={() => setG(i, { useExisting: true })}>
                    Réapprovisionner « {g.existing.name.slice(0, 18)}{g.existing.name.length > 18 ? '…' : ''} »
                  </button>
                  <button className={!g.useExisting ? 'btn-primary !py-2 text-xs' : 'btn-glass !py-2 text-xs'} onClick={() => setG(i, { useExisting: false })}>
                    Créer un nouveau produit
                  </button>
                </div>
              )}

              {!g.useExisting && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-ink/55 text-xs pl-1">Prix achat</label>
                      <input className="input !py-2" type="number" step="0.01" inputMode="decimal" value={g.purchase} onChange={(e) => setG(i, { purchase: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-ink/55 text-xs pl-1">Catégorie</label>
                      <select
                        className="input !py-2"
                        value={newCatFor === i ? '__new__' : g.categoryId}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setNewCatFor(i);
                            setNewCatName('');
                          } else {
                            setNewCatFor(null);
                            setG(i, { categoryId: e.target.value });
                          }
                        }}
                      >
                        <option value="" className="text-black">—</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id} className="text-black">{c.name}</option>
                        ))}
                        <option value="__new__" className="text-black">+ Nouvelle catégorie…</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-ink/55 text-xs pl-1">Prix de vente min</label>
                      <input className="input !py-2" type="number" step="0.01" inputMode="decimal" value={g.saleMin} onChange={(e) => setG(i, { saleMin: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-ink/55 text-xs pl-1">Prix de vente max *</label>
                      <input className="input !py-2" type="number" step="0.01" inputMode="decimal" value={g.saleMax} onChange={(e) => setG(i, { saleMax: e.target.value })} />
                    </div>
                  </div>
                  {newCatFor === i && (
                    <div className="flex gap-2">
                      <input
                        className="input !py-2 flex-1"
                        placeholder="Nom de la nouvelle catégorie"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createCategory(i)}
                        autoFocus
                      />
                      <button className="btn-primary !py-2 !px-4" onClick={() => createCategory(i)}>Créer</button>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1.5">
                {g.lines.map((l, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input className="input !py-1.5 !px-2 w-20 text-center text-sm" placeholder="Taille" value={l.size || ''} onChange={(e) => setL(i, k, { size: e.target.value || null })} />
                    <input className="input !py-1.5 !px-2 flex-1 text-sm" placeholder="Couleur" value={l.color || ''} onChange={(e) => setL(i, k, { color: e.target.value || null })} />
                    <input
                      className="input !py-1.5 !px-1 w-20 text-center font-bold text-sm"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={l.qty}
                      onChange={(e) => setL(i, k, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      aria-label="Quantité"
                    />
                    <button
                      className="text-rose-500/70 shrink-0"
                      onClick={() => setGroups((prev) => prev.map((x, j) => (j === i ? { ...x, lines: x.lines.filter((_, m) => m !== k) } : x)).filter((x) => x.lines.length > 0))}
                      aria-label="Retirer la ligne"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button className="btn-glass w-full !py-1.5 text-xs" onClick={() => setG(i, { lines: [...g.lines, { size: null, color: null, qty: 1 }] })}>
                  <IconPlus className="w-3.5 h-3.5" /> Ajouter une déclinaison
                </button>
              </div>
            </div>
          ))}

          <div className="glass-strong p-4 space-y-3">
            <p className="text-ink/60 text-sm">{groups.length} article{groups.length > 1 ? 's' : ''} · {fmtQty(totalPieces)} pièce{totalPieces > 1 ? 's' : ''}</p>
            <div className="grid grid-cols-3 text-center glass !rounded-2xl p-3">
              <div>
                <p className="text-ink/50 text-[11px]">Valeur d&apos;achat</p>
                <p className="font-semibold text-ink text-sm">{fmt(totalAchat)}</p>
              </div>
              <div>
                <p className="text-ink/50 text-[11px]">Valeur vente min</p>
                <p className="font-semibold text-ink text-sm">{fmt(totalVenteMin)}</p>
              </div>
              <div>
                <p className="text-ink/50 text-[11px]">Valeur vente max</p>
                <p className="font-semibold text-crystal-700 text-sm">{fmt(totalVenteMax)}</p>
              </div>
            </div>
            {error && <p className="text-rose-600 text-sm">{error}</p>}
            <button className="btn-accent w-full py-4" onClick={save} disabled={phase === 'saving' || groups.length === 0}>
              {phase === 'saving' ? 'Enregistrement…' : 'Valider et entrer en stock'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
