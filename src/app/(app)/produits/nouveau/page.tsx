'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { generateEAN13, generateSKU } from '@/lib/utils';
import Scanner from '@/components/Scanner';
import { IconBack, IconCamera, IconScan, IconPlus } from '@/components/Icons';
import type { Category } from '@/lib/types';

/* ---------- Référentiels de tailles & couleurs ---------- */

const TAILLES_LETTRES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const TAILLES_NUM = ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52'];
const POINTURES = [
  '35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5',
  '41', '41.5', '42', '42.5', '43', '43.5', '44', '44.5', '45', '46',
];

const COULEURS: [string, string][] = [
  ['Noir', '#1a1a1a'], ['Blanc', '#f8f8f8'], ['Gris', '#9ca3af'], ['Beige', '#d6c7a1'],
  ['Marron', '#7c4a21'], ['Bleu', '#2563eb'], ['Bleu marine', '#1e3a5f'], ['Bleu ciel', '#7dd3fc'],
  ['Rouge', '#dc2626'], ['Bordeaux', '#7f1d1d'], ['Rose', '#ec4899'], ['Vert', '#16a34a'],
  ['Kaki', '#6b7245'], ['Jaune', '#eab308'], ['Orange', '#f97316'], ['Violet', '#7c3aed'],
  ['Doré', '#d4a017'], ['Argenté', '#c0c4cc'], ['Multicolore', 'conic'],
];

export default function NouveauProduitPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [threshold, setThreshold] = useState('3');

  // Déclinaisons
  const [sizeFamily, setSizeFamily] = useState<'vetements' | 'chaussures'>('vetements');
  const [selSizes, setSelSizes] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [selColors, setSelColors] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState('');
  const [customColors, setCustomColors] = useState<string[]>([]);

  // Stock initial
  const [stockMode, setStockMode] = useState<'total' | 'detail'>('total');
  const [totalQty, setTotalQty] = useState('');
  const [stocks, setStocks] = useState<Record<string, string>>({});
  const [barcodes, setBarcodes] = useState<Record<string, string>>({});
  const [scanFor, setScanFor] = useState<string | null>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase().from('categories').select('*').order('name').then(({ data }) => setCategories(data || []));
  }, []);

  /* ---------- Sélection tailles / couleurs ---------- */

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function addCustomSize() {
    const s = customSize.trim();
    if (s && !selSizes.includes(s)) setSelSizes([...selSizes, s]);
    setCustomSize('');
  }

  function addCustomColor() {
    const c = customColor.trim();
    if (c && !customColors.includes(c) && !selColors.includes(c)) {
      setCustomColors([...customColors, c]);
      setSelColors([...selColors, c]);
    }
    setCustomColor('');
  }

  // Ordre d'affichage : ordre des référentiels, puis ajouts manuels
  const orderedSizes = useMemo(() => {
    const ref = [...TAILLES_LETTRES, ...TAILLES_NUM, ...POINTURES];
    return [...selSizes].sort((a, b) => {
      const ia = ref.indexOf(a);
      const ib = ref.indexOf(b);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [selSizes]);

  const matrix = useMemo(() => {
    if (orderedSizes.length === 0 && selColors.length === 0)
      return [{ size: null as string | null, color: null as string | null, key: 'std' }];
    const rows: { size: string | null; color: string | null; key: string }[] = [];
    for (const size of orderedSizes.length ? orderedSizes : [null]) {
      for (const color of selColors.length ? selColors : [null]) {
        rows.push({ size, color, key: `${size ?? ''}|${color ?? ''}` });
      }
    }
    return rows;
  }, [orderedSizes, selColors]);

  /* ---------- Enregistrement ---------- */

  function onPhoto(f: File | null) {
    setPhoto(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview('');
  }

  function computeStocks(): Record<string, number> {
    const out: Record<string, number> = {};
    if (stockMode === 'detail') {
      matrix.forEach((m) => (out[m.key] = Number(stocks[m.key]) || 0));
    } else {
      const total = Math.max(0, Number(totalQty) || 0);
      const n = matrix.length;
      const base = Math.floor(total / n);
      let rest = total - base * n;
      matrix.forEach((m) => {
        out[m.key] = base + (rest > 0 ? 1 : 0);
        if (rest > 0) rest--;
      });
    }
    return out;
  }

  async function save() {
    if (!name.trim() || !salePrice) {
      setError('Nom et prix de vente obligatoires.');
      return;
    }
    setSaving(true);
    setError('');
    const sb = supabase();

    let imageUrl: string | null = null;
    if (photo) {
      const path = `${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { error: upErr } = await sb.storage.from('produits').upload(path, photo);
      if (!upErr) imageUrl = sb.storage.from('produits').getPublicUrl(path).data.publicUrl;
    }

    const { data: product, error: pErr } = await sb
      .from('products')
      .insert({
        name: name.trim(),
        brand: brand.trim() || null,
        category_id: categoryId || null,
        purchase_price: Number(purchasePrice) || 0,
        sale_price: Number(salePrice),
        price_min: priceMin ? Number(priceMin) : null,
        price_max: priceMax ? Number(priceMax) : null,
        low_stock_threshold: Number(threshold) || 3,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (pErr || !product) {
      setError(pErr?.message || 'Erreur lors de la création.');
      setSaving(false);
      return;
    }

    const stockByKey = computeStocks();
    const variants = matrix.map((m) => ({
      product_id: product.id,
      size: m.size,
      color: m.color,
      sku: generateSKU(name, m.size, m.color),
      barcode: barcodes[m.key] || generateEAN13(),
      stock: stockByKey[m.key] || 0,
    }));

    const { error: vErr } = await sb.from('product_variants').insert(variants);
    if (vErr) {
      setError(vErr.message);
      setSaving(false);
      return;
    }
    router.replace(`/produits/${product.id}`);
  }

  const sizeChip = (s: string) => (
    <button
      key={s}
      type="button"
      className={`chip active:scale-95 ${selSizes.includes(s) ? '!bg-crystal-600 !text-white !border-crystal-600' : ''}`}
      onClick={() => toggle(selSizes, setSelSizes, s)}
    >
      {s}
    </button>
  );

  const totalPieces = stockMode === 'total'
    ? Math.max(0, Number(totalQty) || 0)
    : matrix.reduce((s, m) => s + (Number(stocks[m.key]) || 0), 0);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/produits" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink">Nouveau produit</h1>
      </header>

      {/* Raccourci : création automatique depuis un bon d'achat */}
      <Link href="/produits/scan-bon" className="glass flex items-center gap-4 p-4 transition active:scale-[0.98]">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#ff8a55,#f05e23)' }}>
          <IconCamera />
        </span>
        <div>
          <p className="font-semibold text-ink">Gagner du temps : scanner un bon d&apos;achat</p>
          <p className="text-ink/55 text-xs">Photo du bon → articles, tailles, quantités et prix créés automatiquement (vérifiables avant ajout)</p>
        </div>
      </Link>

      {/* Photo */}
      <label className="glass flex items-center gap-4 p-4 cursor-pointer">
        <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <IconCamera className="w-8 h-8 text-ink/30" />
          )}
        </div>
        <div>
          <p className="font-semibold text-ink">Photo du produit</p>
          <p className="text-ink/55 text-xs">Prendre une photo ou choisir une image</p>
        </div>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0] || null)} />
      </label>

      <div className="glass p-4 space-y-3">
        <input className="input" placeholder="Nom du produit *" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Marque" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <select
            className="input"
            value={showNewCat ? '__new__' : categoryId}
            onChange={(e) => {
              if (e.target.value === '__new__') setShowNewCat(true);
              else {
                setShowNewCat(false);
                setCategoryId(e.target.value);
              }
            }}
          >
            <option value="" className="text-black">Catégorie…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="text-black">{c.name}</option>
            ))}
            <option value="__new__" className="text-black">+ Nouvelle catégorie…</option>
          </select>
        </div>
        {showNewCat && (
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Nom de la nouvelle catégorie"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="btn-primary !px-4"
              onClick={async () => {
                const n = newCatName.trim();
                if (!n) return;
                const { data, error: err } = await supabase().from('categories').insert({ name: n }).select().single();
                if (err) {
                  setError(err.code === '23505' ? 'Cette catégorie existe déjà.' : err.message);
                  return;
                }
                setCategories([...categories, data as any].sort((a, b) => a.name.localeCompare(b.name)));
                setCategoryId((data as any).id);
                setNewCatName('');
                setShowNewCat(false);
                setError('');
              }}
            >
              Créer
            </button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-ink/55 text-xs pl-1">Prix achat</label>
            <input className="input" type="number" step="0.01" inputMode="decimal" placeholder="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </div>
          <div>
            <label className="text-ink/55 text-xs pl-1">Prix vente *</label>
            <input className="input" type="number" step="0.01" inputMode="decimal" placeholder="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          </div>
          <div>
            <label className="text-ink/55 text-xs pl-1">Alerte stock</label>
            <input className="input" type="number" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-ink/55 text-xs pl-1">Prix de vente minimum</label>
            <input className="input" type="number" step="0.01" inputMode="decimal" placeholder="optionnel" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
          </div>
          <div>
            <label className="text-ink/55 text-xs pl-1">Prix de vente maximum</label>
            <input className="input" type="number" step="0.01" inputMode="decimal" placeholder="optionnel" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
          </div>
        </div>
        <p className="text-ink/45 text-xs">
          La fourchette min–max sert de garde-fou : tout prix saisi hors fourchette lors d&apos;une vente ou d&apos;une remise de lot sera signalé.
        </p>
      </div>

      {/* ---------- Tailles ---------- */}
      <div className="glass p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Tailles disponibles</h2>
          {selSizes.length > 0 && <span className="chip">{selSizes.length} cochée{selSizes.length > 1 ? 's' : ''}</span>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {([['vetements', 'Vêtements'], ['chaussures', 'Chaussures']] as const).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className={sizeFamily === f ? 'btn-primary !py-2 text-sm' : 'btn-glass !py-2 text-sm'}
              onClick={() => setSizeFamily(f)}
            >
              {label}
            </button>
          ))}
        </div>

        {sizeFamily === 'vetements' ? (
          <>
            <div className="flex flex-wrap gap-1.5">{TAILLES_LETTRES.map(sizeChip)}</div>
            <div className="flex flex-wrap gap-1.5">{TAILLES_NUM.map(sizeChip)}</div>
          </>
        ) : (
          <div className="flex flex-wrap gap-1.5">{POINTURES.map(sizeChip)}</div>
        )}

        <div className="flex gap-2">
          <input
            className="input !py-2 flex-1"
            placeholder="Taille particulière (ex : 3 ans, Unique…)"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomSize()}
          />
          <button type="button" className="btn-glass !px-4 !py-2" onClick={addCustomSize}>
            <IconPlus className="w-4 h-4" />
          </button>
        </div>
        {selSizes.filter((s) => ![...TAILLES_LETTRES, ...TAILLES_NUM, ...POINTURES].includes(s)).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selSizes.filter((s) => ![...TAILLES_LETTRES, ...TAILLES_NUM, ...POINTURES].includes(s)).map(sizeChip)}
          </div>
        )}
        <p className="text-ink/45 text-xs">Aucune taille cochée = article sans déclinaison de taille.</p>
      </div>

      {/* ---------- Couleurs ---------- */}
      <div className="glass p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Couleurs disponibles</h2>
          {selColors.length > 0 && <span className="chip">{selColors.length} cochée{selColors.length > 1 ? 's' : ''}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COULEURS.map(([c, hex]) => (
            <button
              key={c}
              type="button"
              className={`chip active:scale-95 ${selColors.includes(c) ? '!bg-crystal-600 !text-white !border-crystal-600' : ''}`}
              onClick={() => toggle(selColors, setSelColors, c)}
            >
              <span
                className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                style={hex === 'conic' ? { background: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' } : { background: hex }}
              />
              {c}
            </button>
          ))}
          {customColors.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip active:scale-95 ${selColors.includes(c) ? '!bg-crystal-600 !text-white !border-crystal-600' : ''}`}
              onClick={() => toggle(selColors, setSelColors, c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input !py-2 flex-1"
            placeholder="Autre couleur (ex : Corail, Léopard…)"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomColor()}
          />
          <button type="button" className="btn-glass !px-4 !py-2" onClick={addCustomColor}>
            <IconPlus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-ink/45 text-xs">Aucune couleur cochée = article sans déclinaison de couleur.</p>
      </div>

      {/* ---------- Stock initial ---------- */}
      <div className="glass p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Stock initial</h2>
          <span className="chip">{matrix.length} variante{matrix.length > 1 ? 's' : ''} · {totalPieces} pièce{totalPieces > 1 ? 's' : ''}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={stockMode === 'total' ? 'btn-primary !py-2 text-sm' : 'btn-glass !py-2 text-sm'}
            onClick={() => setStockMode('total')}
          >
            Quantité totale
          </button>
          <button
            type="button"
            className={stockMode === 'detail' ? 'btn-primary !py-2 text-sm' : 'btn-glass !py-2 text-sm'}
            onClick={() => setStockMode('detail')}
          >
            Détail par variante
          </button>
        </div>

        {stockMode === 'total' ? (
          <>
            <div className="flex items-center gap-2">
              <input
                className="input flex-1 text-center text-lg font-semibold"
                type="number"
                inputMode="numeric"
                placeholder="Nombre total de pièces"
                value={totalQty}
                onChange={(e) => setTotalQty(e.target.value)}
              />
              <span className="text-ink/40 text-sm shrink-0">pièces</span>
            </div>
            <p className="text-ink/45 text-xs">
              Réparti automatiquement entre les {matrix.length} variante{matrix.length > 1 ? 's' : ''} — ajustable ensuite depuis la fiche produit.
            </p>
          </>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {matrix.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-ink block">
                    {[m.size, m.color].filter(Boolean).join(' · ') || 'Article standard'}
                  </span>
                  {barcodes[m.key] && (
                    <span className="chip chip-ok !text-[10px] mt-0.5">code {barcodes[m.key]}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={`!p-2 !rounded-xl shrink-0 ${barcodes[m.key] ? 'btn-primary' : 'btn-glass'}`}
                  onClick={() => setScanFor(m.key)}
                  aria-label="Scanner le code-barres existant"
                >
                  <IconScan className="w-4 h-4" />
                </button>
                <input
                  className="input !w-20 !py-2 text-center shrink-0"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={stocks[m.key] || ''}
                  onChange={(e) => setStocks({ ...stocks, [m.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        <p className="text-ink/45 text-xs">
          Un code-barres EAN-13 et une référence sont générés pour chaque variante — imprimables en étiquettes, ou scannez le code fabricant (mode détail).
        </p>
      </div>

      {error && <p className="text-rose-600 text-sm px-1">{error}</p>}
      <button className="btn-primary w-full py-4" onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : `Créer le produit (${matrix.length} variante${matrix.length > 1 ? 's' : ''})`}
      </button>

      {scanFor && (
        <Scanner
          onDetected={(code) => {
            const taken = Object.entries(barcodes).find(([k, v]) => v === code && k !== scanFor);
            if (taken) {
              setError(`Ce code est déjà affecté à une autre variante (${taken[0].replace('|', ' · ')}).`);
            } else {
              setBarcodes((prev) => ({ ...prev, [scanFor]: code }));
              setError('');
            }
            setScanFor(null);
          }}
          onClose={() => setScanFor(null)}
        />
      )}
    </div>
  );
}
