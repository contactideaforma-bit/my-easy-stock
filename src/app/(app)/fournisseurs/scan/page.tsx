'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fmt, fmtQty, variantLabel } from '@/lib/utils';
import { IconBack, IconCamera, IconCheck, IconSearch, IconTrash } from '@/components/Icons';
import type { Supplier, Variant } from '@/lib/types';

type VariantHit = Variant & { products: { name: string; purchase_price: number } };

type ScanLine = {
  reference: string | null;
  designation: string;
  size: string | null;
  color: string | null;
  qty: number;
  unit_cost: number | null;
};

type Row = ScanLine & {
  variant: VariantHit | null; // article du catalogue rattaché
  q: string; // recherche manuelle
  hits: VariantHit[];
};

/** Redimensionne la photo côté client (max 1600 px) pour un envoi rapide */
async function fileToBase64(file: File): Promise<{ data: string; media_type: string }> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = document.createElement('img');
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });
  const max = 1600;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL('image/jpeg', 0.85);
  return { data: out.split(',')[1], media_type: 'image/jpeg' };
}

export default function ScanBonPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'upload' | 'analyzing' | 'review' | 'saving'>('upload');
  const [preview, setPreview] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [docSupplier, setDocSupplier] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ received: boolean; pieces: number; total: number } | null>(null);

  useEffect(() => {
    supabase().from('suppliers').select('*').order('name').then(({ data }) => setSuppliers((data as any) || []));
  }, []);

  /** Rapprochement automatique d'une ligne extraite avec le catalogue */
  async function matchLine(l: ScanLine): Promise<VariantHit | null> {
    const sb = supabase();
    const sel = '*, products!inner(name, purchase_price, archived)';
    // 1. Par référence exacte (code-barres ou SKU)
    if (l.reference) {
      const ref = l.reference.trim();
      for (const col of ['barcode', 'sku'] as const) {
        const { data } = await sb.from('product_variants').select(sel).eq(col, ref).limit(1);
        if (data && data.length) return data[0] as any;
      }
    }
    // 2. Par désignation (+ taille / couleur si présentes)
    const words = l.designation.split(/\s+/).filter((w) => w.length > 2).slice(0, 3).join('%');
    if (!words) return null;
    let q = sb.from('product_variants').select(sel).eq('products.archived', false).ilike('products.name', `%${words}%`);
    const { data } = await q.limit(20);
    if (!data || data.length === 0) return null;
    const norm = (s: string | null) => (s || '').toLowerCase().trim();
    const bySizeColor = (data as any[]).find(
      (v) => (!l.size || norm(v.size) === norm(l.size)) && (!l.color || norm(v.color) === norm(l.color))
    );
    return (bySizeColor || data[0]) as any;
  }

  async function analyze(file: File) {
    setError('');
    setPhase('analyzing');
    setPreview(URL.createObjectURL(file));
    try {
      const { data, media_type } = await fileToBase64(file);
      const res = await fetch('/api/scan-bon', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: data, media_type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Analyse impossible.');
      const lines: ScanLine[] = json.lines || [];
      if (lines.length === 0) {
        setError("Aucune ligne d'article détectée sur ce document. Reprenez la photo bien à plat, nette et éclairée.");
        setPhase('upload');
        return;
      }
      setDocSupplier(json.supplier || null);
      // Pré-sélectionne le fournisseur si son nom correspond
      if (json.supplier) {
        const hit = suppliers.find((s) => s.name.toLowerCase().includes(String(json.supplier).toLowerCase().slice(0, 6)));
        if (hit) setSupplierId(hit.id);
      }
      // Rapprochement catalogue ligne par ligne
      const matched: Row[] = [];
      for (const l of lines) {
        const variant = await matchLine(l);
        matched.push({ ...l, variant, q: '', hits: [] });
      }
      setRows(matched);
      setPhase('review');
    } catch (e: any) {
      setError(e?.message || 'Erreur pendant l’analyse.');
      setPhase('upload');
    }
  }

  /** Recherche manuelle pour rattacher une ligne */
  async function searchFor(i: number, q: string) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, q } : r)));
    if (q.trim().length < 2) {
      setRows((prev) => prev.map((r, j) => (j === i ? { ...r, hits: [] } : r)));
      return;
    }
    const { data } = await supabase()
      .from('product_variants')
      .select('*, products!inner(name, purchase_price, archived)')
      .eq('products.archived', false)
      .ilike('products.name', `%${q.trim()}%`)
      .limit(6);
    // fallback : recherche par sku/barcode
    const { data: byRef } = await supabase()
      .from('product_variants')
      .select('*, products!inner(name, purchase_price, archived)')
      .or(`sku.ilike.%${q.trim()}%,barcode.ilike.%${q.trim()}%`)
      .limit(4);
    const all = [...((data as any[]) || []), ...((byRef as any[]) || [])];
    const uniq = all.filter((v, idx) => all.findIndex((x) => x.id === v.id) === idx);
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, hits: uniq as any } : r)));
  }

  const set = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const matchedRows = rows.filter((r) => r.variant);
  const totalPieces = matchedRows.reduce((s, r) => s + r.qty, 0);
  const totalCost = matchedRows.reduce((s, r) => s + r.qty * (r.unit_cost ?? (Number(r.variant!.products.purchase_price) || 0)), 0);

  async function save(receive: boolean) {
    if (matchedRows.length === 0) {
      setError('Rattachez au moins une ligne à un article du catalogue.');
      return;
    }
    setPhase('saving');
    setError('');
    const sb = supabase();
    const { data: purchase, error: pErr } = await sb
      .from('purchases')
      .insert({ supplier_id: supplierId || null, note: docSupplier ? `Bon scanné — ${docSupplier}` : 'Bon scanné' })
      .select()
      .single();
    if (pErr || !purchase) {
      setError(pErr?.message || 'Erreur lors de la création de la commande.');
      setPhase('review');
      return;
    }
    const { error: iErr } = await sb.from('purchase_items').insert(
      matchedRows.map((r) => ({
        purchase_id: purchase.id,
        variant_id: r.variant!.id,
        qty: r.qty,
        unit_cost: r.unit_cost ?? (Number(r.variant!.products.purchase_price) || 0),
      }))
    );
    if (iErr) {
      setError(iErr.message);
      setPhase('review');
      return;
    }
    let received = false;
    if (receive) {
      const { error: rErr } = await sb.rpc('receive_purchase', { p_purchase_id: purchase.id });
      received = !rErr;
      if (rErr) setError(`Commande créée mais non réceptionnée : ${rErr.message}`);
    }
    setDone({ received, pieces: totalPieces, total: totalCost });
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
            <h2 className="text-xl font-bold text-ink">{done.received ? 'Bon intégré et stock mis à jour' : 'Commande fournisseur créée'}</h2>
            <p className="text-ink/60 text-sm mt-1">
              {fmtQty(done.pieces)} pièce{done.pieces > 1 ? 's' : ''} · valeur d&apos;achat {fmt(done.total)}
              {!done.received && ' — à réceptionner depuis Fournisseurs pour entrer en stock.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-glass" onClick={() => { setDone(null); setRows([]); setPreview(''); setPhase('upload'); }}>
              Scanner un autre bon
            </button>
            <button className="btn-primary" onClick={() => router.push('/fournisseurs')}>Voir les commandes</button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/fournisseurs" className="btn-glass !p-2"><IconBack /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">Scanner un bon d&apos;achat</h1>
          <p className="text-ink/50 text-xs">Photo ou fichier → les références sont extraites automatiquement</p>
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
            Conseil : document bien à plat, photo nette et éclairée. L&apos;application lit les références, désignations,
            tailles, couleurs, quantités et prix, puis vous laisse tout ajuster avant l&apos;entrée en stock.
          </p>
        </>
      )}

      {phase === 'analyzing' && (
        <div className="glass-strong p-8 text-center space-y-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-52 mx-auto rounded-2xl object-contain" />
          )}
          <p className="text-crystal-800 animate-pulse font-medium">Lecture du bon en cours…</p>
          <p className="text-ink/50 text-xs">Extraction des références puis rapprochement avec votre catalogue.</p>
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <>
          <div className="glass p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Document lu</h2>
              {docSupplier && <span className="chip">{docSupplier}</span>}
            </div>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="" className="text-black">Fournisseur (optionnel)…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id} className="text-black">{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className={`glass p-3 space-y-2 ${!r.variant ? 'ring-1 ring-orange-400/50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{r.designation}</p>
                    <p className="text-xs text-ink/55">
                      {[r.reference, r.size, r.color].filter(Boolean).join(' · ') || 'sans référence'}
                    </p>
                  </div>
                  <button className="text-rose-500/70 shrink-0 p-1" onClick={() => remove(i)} aria-label="Retirer la ligne">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>

                {r.variant ? (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="chip chip-ok !text-[10px] min-w-0 truncate">
                      → {r.variant.products.name} · {variantLabel(r.variant)}
                    </span>
                    <button className="text-crystal-700 underline shrink-0" onClick={() => set(i, { variant: null })}>changer</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative">
                      <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
                      <input
                        className="input !py-2 !pl-9 text-sm"
                        placeholder="Rattacher à un article du catalogue…"
                        value={r.q}
                        onChange={(e) => searchFor(i, e.target.value)}
                      />
                    </div>
                    {r.hits.map((v) => (
                      <button
                        key={v.id}
                        className="w-full text-left text-sm text-ink py-1.5 px-2 rounded-xl hover:bg-white/5"
                        onClick={() => set(i, { variant: v, hits: [], q: '' })}
                      >
                        {v.products.name} <span className="text-ink/55">· {variantLabel(v)}</span>
                      </button>
                    ))}
                    <p className="text-orange-700/80 text-[11px]">
                      Article introuvable dans le catalogue — rattachez-le, ou retirez la ligne (créez d&apos;abord le produit si besoin).
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="text-xs text-ink/55 shrink-0">Qté</label>
                  <input
                    className="input !w-20 !py-1.5 text-center font-bold"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={r.qty}
                    onChange={(e) => set(i, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  />
                  <label className="text-xs text-ink/55 shrink-0">Prix achat/u</label>
                  <input
                    className="input flex-1 !py-1.5 text-center"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={r.unit_cost ?? ''}
                    placeholder={r.variant ? String(r.variant.products.purchase_price) : '0'}
                    onChange={(e) => set(i, { unit_cost: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="text-xs text-ink/40 shrink-0">€</span>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-strong p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/60">Lignes rattachées : {matchedRows.length}/{rows.length}</span>
              <span className="text-ink font-semibold">{fmtQty(totalPieces)} pcs · {fmt(totalCost)}</span>
            </div>
            {error && <p className="text-rose-600 text-sm">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-glass" onClick={() => save(false)} disabled={phase === 'saving'}>
                Enregistrer la commande
              </button>
              <button className="btn-accent" onClick={() => save(true)} disabled={phase === 'saving'}>
                {phase === 'saving' ? 'Traitement…' : 'Entrer en stock'}
              </button>
            </div>
            <p className="text-ink/45 text-xs">
              « Entrer en stock » = commande créée et réceptionnée immédiatement (le stock dépôt est incrémenté).
            </p>
          </div>
        </>
      )}

      {phase === 'upload' && error && <p className="text-rose-600 text-sm px-1">{error}</p>}
    </div>
  );
}
