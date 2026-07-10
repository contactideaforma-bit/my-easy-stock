'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import JsBarcode from 'jsbarcode';
import { supabase } from '@/lib/supabase';
import { fmt, variantLabel } from '@/lib/utils';
import { IconBack } from '@/components/Icons';
import type { Product, Variant } from '@/lib/types';

export default function EtiquettesPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from('products').select('*').eq('id', id).single(),
      sb.from('product_variants').select('*').eq('product_id', id).order('size'),
    ]).then(([{ data: p }, { data: vs }]) => {
      setProduct(p as any);
      setVariants((vs as any) || []);
    });
  }, [id]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.querySelectorAll('svg[data-code]').forEach((svg) => {
      const code = svg.getAttribute('data-code')!;
      try {
        JsBarcode(svg, code, { format: 'EAN13', height: 44, fontSize: 12, margin: 4, background: 'transparent', lineColor: '#000' });
      } catch {
        JsBarcode(svg, code, { format: 'CODE128', height: 44, fontSize: 12, margin: 4, background: 'transparent', lineColor: '#000' });
      }
    });
  }, [variants]);

  if (!product) return <div className="glass p-8 text-center text-ink/55 animate-pulse mt-4">Chargement…</div>;

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2 no-print">
        <Link href={`/produits/${id}`} className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink flex-1">Étiquettes</h1>
        <button className="btn-primary !py-2 !px-4 text-sm" onClick={() => window.print()}>Imprimer</button>
      </header>
      <p className="text-ink/55 text-sm no-print">
        Imprimez puis collez les étiquettes sur vos articles — elles seront scannables en caisse et à l&apos;inventaire.
      </p>

      <div ref={containerRef} className="grid grid-cols-2 gap-3 print:grid-cols-3 print:gap-2">
        {variants.map((v) => (
          <div key={v.id} className="bg-white text-black rounded-xl p-3 text-center print:rounded-none print:border print:border-gray-300">
            <p className="text-xs font-bold leading-tight truncate">{product.name}</p>
            <p className="text-[10px] text-gray-600">{variantLabel(v)} — {fmt(Number(product.sale_price))}</p>
            {v.barcode && <svg data-code={v.barcode} className="w-full" />}
          </div>
        ))}
      </div>
    </div>
  );
}
