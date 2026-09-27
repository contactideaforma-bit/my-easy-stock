'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import InvoiceEditor from '@/components/InvoiceEditor';
import { IconBack } from '@/components/Icons';

export default function NouvelleFacturePage() {
  return <Suspense><NouvelleFacture /></Suspense>;
}

function NouvelleFacture() {
  const params = useSearchParams();
  return (
    <div className="space-y-5">
      <Link href="/factures" className="text-sm text-ink-mute flex items-center gap-1 hover:text-ink"><IconBack className="w-4 h-4" />Factures</Link>
      <h1 className="h1">Nouvelle facture</h1>
      <InvoiceEditor clientId={params.get('client')} />
    </div>
  );
}
