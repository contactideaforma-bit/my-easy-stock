'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { IconBack, IconBuilding } from '@/components/Icons';

type Settings = {
  name: string;
  legal_form: string;
  address: string;
  phone: string;
  email: string;
  siret: string;
  vat_number: string;
  vat_rate: string;
  iban: string;
  bic: string;
  invoice_footer: string;
};

const EMPTY: Settings = {
  name: '', legal_form: '', address: '', phone: '', email: '',
  siret: '', vat_number: '', vat_rate: '20', iban: '', bic: '', invoice_footer: '',
};

export default function SocietePage() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase()
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setS({
            name: data.name || '',
            legal_form: data.legal_form || '',
            address: data.address || '',
            phone: data.phone || '',
            email: data.email || '',
            siret: data.siret || '',
            vat_number: data.vat_number || '',
            vat_rate: String(data.vat_rate ?? 20),
            iban: data.iban || '',
            bic: data.bic || '',
            invoice_footer: data.invoice_footer || '',
          });
        }
        setLoading(false);
      });
  }, []);

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setS({ ...s, [k]: e.target.value });
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    const { error } = await supabase()
      .from('company_settings')
      .upsert({
        id: 1,
        name: s.name.trim() || 'Ma Société',
        legal_form: s.legal_form.trim() || null,
        address: s.address.trim() || null,
        phone: s.phone.trim() || null,
        email: s.email.trim() || null,
        siret: s.siret.trim() || null,
        vat_number: s.vat_number.trim() || null,
        vat_rate: Number(s.vat_rate) || 0,
        iban: s.iban.trim() || null,
        bic: s.bic.trim() || null,
        invoice_footer: s.invoice_footer.trim() || null,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) alert(error.message);
    else setSaved(true);
  }

  if (loading) return <div className="glass p-8 text-center text-ink/55 animate-pulse mt-4">Chargement…</div>;

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/plus" className="btn-glass !p-2"><IconBack /></Link>
        <div className="flex items-center gap-2 flex-1">
          <IconBuilding className="w-6 h-6 text-crystal-600" />
          <h1 className="text-xl font-bold text-ink">Profil société</h1>
        </div>
      </header>

      <p className="text-ink/55 text-sm px-1">
        Ces informations apparaissent sur vos factures et tickets. Renseignez-les une fois, tout est automatique ensuite.
      </p>

      <div className="glass p-4 space-y-3">
        <h2 className="section-title">Identité</h2>
        <input className="input" placeholder="Nom de la société *" value={s.name} onChange={set('name')} />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Forme (SARL, EI…)" value={s.legal_form} onChange={set('legal_form')} />
          <input className="input" placeholder="SIRET" value={s.siret} onChange={set('siret')} />
        </div>
        <textarea className="input min-h-[70px]" placeholder="Adresse complète" value={s.address} onChange={set('address')} />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Téléphone" value={s.phone} onChange={set('phone')} />
          <input className="input" type="email" placeholder="Email" value={s.email} onChange={set('email')} />
        </div>
      </div>

      <div className="glass p-4 space-y-3">
        <h2 className="section-title">TVA</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="N° TVA intracom." value={s.vat_number} onChange={set('vat_number')} />
          <div>
            <input className="input" type="number" step="0.1" placeholder="Taux TVA %" value={s.vat_rate} onChange={set('vat_rate')} />
          </div>
        </div>
        <p className="text-ink/45 text-xs">
          Mettez 0 si vous êtes en franchise en base — la mention « TVA non applicable, art. 293 B du CGI » sera ajoutée automatiquement.
        </p>
      </div>

      <div className="glass p-4 space-y-3">
        <h2 className="section-title">Coordonnées bancaires (RIB)</h2>
        <input className="input" placeholder="IBAN" value={s.iban} onChange={set('iban')} />
        <input className="input" placeholder="BIC" value={s.bic} onChange={set('bic')} />
      </div>

      <div className="glass p-4 space-y-3">
        <h2 className="section-title">Pied de facture</h2>
        <textarea
          className="input min-h-[70px]"
          placeholder="Mentions complémentaires (conditions de paiement, pénalités de retard…)"
          value={s.invoice_footer}
          onChange={set('invoice_footer')}
        />
      </div>

      <button className="btn-primary w-full py-4" onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : saved ? 'Enregistré' : 'Enregistrer'}
      </button>
    </div>
  );
}
