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
  logo_url: string;
  invoice_color: string;
  invoice_theme: 'classique' | 'moderne' | 'minimal';
};

const EMPTY: Settings = {
  name: '', legal_form: '', address: '', phone: '', email: '',
  siret: '', vat_number: '', vat_rate: '20', iban: '', bic: '', invoice_footer: '',
  logo_url: '', invoice_color: '#257ceb', invoice_theme: 'classique',
};

const PALETTE = ['#257ceb', '#0f766e', '#7c3aed', '#be185d', '#b91c1c', '#c2410c', '#a16207', '#166534', '#1e3a5f', '#111827'];

const THEMES: { key: Settings['invoice_theme']; label: string; desc: string }[] = [
  { key: 'classique', label: 'Classique', desc: 'En-tête souligné, sobre et professionnel' },
  { key: 'moderne', label: 'Moderne', desc: 'Bandeau de couleur pleine en tête' },
  { key: 'minimal', label: 'Minimal', desc: 'Épuré, la couleur uniquement sur le total' },
];

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
            logo_url: data.logo_url || '',
            invoice_color: data.invoice_color || '#257ceb',
            invoice_theme: data.invoice_theme || 'classique',
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
        logo_url: s.logo_url || null,
        invoice_color: s.invoice_color,
        invoice_theme: s.invoice_theme,
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

      {/* Personnalisation des factures */}
      <div className="glass p-4 space-y-4">
        <h2 className="section-title">Apparence des factures</h2>

        {/* Logo */}
        <label className="flex items-center gap-4 cursor-pointer">
          <div className="w-16 h-16 rounded-2xl bg-white border border-ink/10 flex items-center justify-center overflow-hidden shrink-0">
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-ink/30 text-xs text-center px-1">Logo</span>
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ink text-sm">Logo de la société</p>
            <p className="text-ink/50 text-xs">Affiché en tête des factures — touchez pour choisir une image</p>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const path = `logo-${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
              const sb = supabase();
              const { error } = await sb.storage.from('produits').upload(path, f);
              if (!error) {
                setS({ ...s, logo_url: sb.storage.from('produits').getPublicUrl(path).data.publicUrl });
                setSaved(false);
              } else alert(error.message);
            }}
          />
        </label>

        {/* Couleur dominante */}
        <div>
          <p className="text-ink/55 text-xs mb-2">Couleur dominante</p>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`w-9 h-9 rounded-full border-2 transition active:scale-90 ${s.invoice_color === c ? 'border-ink scale-110' : 'border-white'}`}
                style={{ background: c }}
                onClick={() => { setS({ ...s, invoice_color: c }); setSaved(false); }}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Thème */}
        <div>
          <p className="text-ink/55 text-xs mb-2">Thème de facture</p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`rounded-2xl border p-2.5 text-left transition active:scale-[0.97] ${s.invoice_theme === t.key ? 'border-crystal-600 bg-crystal-500/10' : 'border-ink/10 bg-white/50'}`}
                onClick={() => { setS({ ...s, invoice_theme: t.key }); setSaved(false); }}
              >
                {/* mini aperçu */}
                <div className="rounded-lg bg-white border border-ink/10 p-1.5 mb-2 space-y-1">
                  {t.key === 'moderne' ? (
                    <div className="h-3 rounded-sm" style={{ background: s.invoice_color }} />
                  ) : t.key === 'classique' ? (
                    <div className="h-3 border-b-2 flex items-end" style={{ borderColor: s.invoice_color }}>
                      <div className="h-1.5 w-1/2 rounded-sm" style={{ background: s.invoice_color, opacity: 0.7 }} />
                    </div>
                  ) : (
                    <div className="h-3 flex items-end"><div className="h-[3px] w-1/3 rounded-sm bg-ink/20" /></div>
                  )}
                  <div className="h-1 rounded bg-ink/10 w-full" />
                  <div className="h-1 rounded bg-ink/10 w-4/5" />
                  <div className="h-1.5 rounded w-2/5 ml-auto" style={{ background: t.key === 'minimal' ? s.invoice_color : 'rgba(13,43,78,0.25)' }} />
                </div>
                <p className="text-xs font-semibold text-ink">{t.label}</p>
                <p className="text-[10px] text-ink/45 leading-tight mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
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
