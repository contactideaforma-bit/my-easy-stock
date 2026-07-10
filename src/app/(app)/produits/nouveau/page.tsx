'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { generateEAN13, generateSKU } from '@/lib/utils';
import { IconBack } from '@/components/Icons';
import type { Category } from '@/lib/types';

export default function NouveauProduitPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [threshold, setThreshold] = useState('3');
  const [sizes, setSizes] = useState('');
  const [colors, setColors] = useState('');
  const [stocks, setStocks] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase().from('categories').select('*').order('name').then(({ data }) => setCategories(data || []));
  }, []);

  const parse = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);

  const matrix = useMemo(() => {
    const ss = parse(sizes);
    const cs = parse(colors);
    if (ss.length === 0 && cs.length === 0) return [{ size: null as string | null, color: null as string | null, key: 'std' }];
    const rows: { size: string | null; color: string | null; key: string }[] = [];
    for (const size of ss.length ? ss : [null]) {
      for (const color of cs.length ? cs : [null]) {
        rows.push({ size, color, key: `${size ?? ''}|${color ?? ''}` });
      }
    }
    return rows;
  }, [sizes, colors]);

  function onPhoto(f: File | null) {
    setPhoto(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview('');
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

    const variants = matrix.map((m) => ({
      product_id: product.id,
      size: m.size,
      color: m.color,
      sku: generateSKU(name, m.size, m.color),
      barcode: generateEAN13(),
      stock: Number(stocks[m.key]) || 0,
    }));

    const { error: vErr } = await sb.from('product_variants').insert(variants);
    if (vErr) {
      setError(vErr.message);
      setSaving(false);
      return;
    }
    router.replace(`/produits/${product.id}`);
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/produits" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-white">Nouveau produit</h1>
      </header>

      {/* Photo */}
      <label className="glass flex items-center gap-4 p-4 cursor-pointer">
        <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl opacity-40">📷</span>
          )}
        </div>
        <div>
          <p className="font-semibold text-crystal-100">Photo du produit</p>
          <p className="text-crystal-300/60 text-xs">Prendre une photo ou choisir une image</p>
        </div>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0] || null)} />
      </label>

      <div className="glass p-4 space-y-3">
        <input className="input" placeholder="Nom du produit *" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Marque" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="" className="text-black">Catégorie…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="text-black">{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-crystal-300/60 text-xs pl-1">Prix achat</label>
            <input className="input" type="number" step="0.01" inputMode="decimal" placeholder="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </div>
          <div>
            <label className="text-crystal-300/60 text-xs pl-1">Prix vente *</label>
            <input className="input" type="number" step="0.01" inputMode="decimal" placeholder="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          </div>
          <div>
            <label className="text-crystal-300/60 text-xs pl-1">Alerte stock</label>
            <input className="input" type="number" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Variantes */}
      <div className="glass p-4 space-y-3">
        <h2 className="section-title">Déclinaisons</h2>
        <input className="input" placeholder="Tailles — ex : S, M, L, XL ou 40, 41, 42" value={sizes} onChange={(e) => setSizes(e.target.value)} />
        <input className="input" placeholder="Couleurs — ex : Noir, Blanc, Bleu" value={colors} onChange={(e) => setColors(e.target.value)} />

        <div className="space-y-2 pt-1">
          <p className="text-crystal-300/60 text-xs">
            {matrix.length} variante{matrix.length > 1 ? 's' : ''} — saisissez le stock initial :
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {matrix.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-crystal-100">
                  {[m.size, m.color].filter(Boolean).join(' · ') || 'Article standard'}
                </span>
                <input
                  className="input !w-24 !py-2 text-center"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={stocks[m.key] || ''}
                  onChange={(e) => setStocks({ ...stocks, [m.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
        <p className="text-crystal-300/50 text-xs">
          Un code-barres EAN-13 et une référence sont générés automatiquement pour chaque variante — imprimables en étiquettes.
        </p>
      </div>

      {error && <p className="text-rose-300 text-sm px-1">{error}</p>}
      <button className="btn-primary w-full py-4" onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Créer le produit'}
      </button>
    </div>
  );
}
