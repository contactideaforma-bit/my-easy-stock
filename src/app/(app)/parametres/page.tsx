'use client';

import { useEffect, useState } from 'react';
import { api, supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Field, Toast } from '@/components/Bits';
import type { Cabinet } from '@/lib/types';

export default function Parametres() {
  const { cabinet, me, refresh } = useCabinet();
  const [f, setF] = useState<Cabinet>(cabinet);
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const owner = me.role === 'titulaire';
  const set = (k: keyof Cabinet, v: any) => setF((s) => ({ ...s, [k]: v }));
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  useEffect(() => { api('/api/status').then(setStatus).catch(() => setStatus(null)); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { id, next_invoice_number, ...rest } = f;
    const { error } = await supabase().from('mya_cabinets').update({ ...rest, next_invoice_number: Number(next_invoice_number), payment_terms_days: Number(f.payment_terms_days), default_vat_rate: Number(f.default_vat_rate) }).eq('id', id);
    flash(error ? error.message : 'Paramètres enregistrés');
    refresh();
  }

  const Toggle = ({ k, title, text }: { k: keyof Cabinet; title: string; text: string }) => (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} className="accent-sage-600 w-4 h-4 mt-1" />
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-ink-mute">{text}</span></span>
    </label>
  );

  return (
    <form onSubmit={save} className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h1">Paramètres</h1>
        {owner && <button className="btn-primary">Enregistrer</button>}
      </div>
      {!owner && <p className="text-sm text-honey-600">Seule la titulaire peut modifier ces paramètres.</p>}

      <fieldset disabled={!owner} className="space-y-5">
        <section className="card-pad space-y-1">
          <h2 className="h2 mb-2">Automatismes</h2>
          <Toggle k="reminders_enabled" title="Relances de paiement automatiques" text="Chaque matin, les relances prévues par le scénario partent toutes seules (email / SMS)." />
          <Toggle k="appointment_reminders" title="Rappel de rendez-vous au client" text="La veille du RDV, par email et SMS : fini les lapins." />
          <Toggle k="daily_digest" title="Programme du jour par email" text="Chaque membre reçoit à 8 h ses RDV, tâches et demandes du jour." />
          <div className="pt-2">
            <Field label="Factures d'honoraires récurrentes">
              <select className="input" value={f.recurring_mode} onChange={(e) => set('recurring_mode', e.target.value)}>
                <option value="brouillon">Préparées automatiquement, je valide d'un clic avant envoi</option>
                <option value="auto">Créées ET envoyées automatiquement</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="card-pad space-y-3">
          <h2 className="h2">Services d'envoi</h2>
          {status ? (
            <ul className="text-sm space-y-1">
              <Svc ok={status.email} label="Emails (Resend)" />
              <Svc ok={status.sms} label="SMS (Brevo)" />
              <Svc ok={status.cron} label="Tâche quotidienne (CRON_SECRET)" />
              <Svc ok={status.service} label="Clé serveur Supabase (équipe, page facture publique)" />
              <Svc ok={status.appUrl} label="Adresse publique de l'appli (liens dans les messages)" />
            </ul>
          ) : <p className="text-sm text-ink-mute">Vérification…</p>}
          <button type="button" className="btn-ghost btn-sm" onClick={async () => {
            try { await api('/api/status', {}); flash('Email de test envoyé : vérifiez votre boîte'); } catch (e: any) { flash(e.message); }
          }}>M'envoyer un email de test</button>
          <Field label="Nom d'expéditeur SMS (11 caractères, sans espace)"><input className="input" maxLength={11} value={f.sms_sender ?? ''} onChange={(e) => set('sms_sender', e.target.value.replace(/[^A-Za-z0-9]/g, ''))} /></Field>
        </section>

        <section className="card-pad space-y-3">
          <h2 className="h2">Cabinet (affiché sur les factures)</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nom du cabinet"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Raison sociale"><input className="input" value={f.legal_name ?? ''} onChange={(e) => set('legal_name', e.target.value)} /></Field>
            <Field label="SIRET"><input className="input" value={f.siret ?? ''} onChange={(e) => set('siret', e.target.value)} /></Field>
            <Field label="N° TVA intracommunautaire"><input className="input" value={f.vat_number ?? ''} onChange={(e) => set('vat_number', e.target.value)} /></Field>
            <Field label="Adresse" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="Téléphone"><input className="input" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Email (les réponses des clients arrivent ici)"><input type="email" className="input" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="IBAN"><input className="input font-mono" value={f.iban ?? ''} onChange={(e) => set('iban', e.target.value.toUpperCase())} /></Field>
            <Field label="BIC"><input className="input font-mono" value={f.bic ?? ''} onChange={(e) => set('bic', e.target.value.toUpperCase())} /></Field>
            <Field label="Logo (adresse de l'image)" className="sm:col-span-2"><input className="input" value={f.logo_url ?? ''} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://…" /></Field>
          </div>
        </section>

        <section className="card-pad space-y-3">
          <h2 className="h2">Facturation</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            <Field label="Préfixe"><input className="input" value={f.invoice_prefix} onChange={(e) => set('invoice_prefix', e.target.value)} /></Field>
            <Field label="Prochain numéro"><input type="number" className="input" value={f.next_invoice_number} onChange={(e) => set('next_invoice_number', e.target.value)} /></Field>
            <Field label="Délai de paiement (j)"><input type="number" className="input" value={f.payment_terms_days} onChange={(e) => set('payment_terms_days', e.target.value)} /></Field>
            <Field label="TVA par défaut (%)"><input type="number" className="input" value={f.default_vat_rate} onChange={(e) => set('default_vat_rate', e.target.value)} /></Field>
          </div>
          <p className="text-xs text-ink-mute">Prochaine facture : {f.invoice_prefix}-{new Date().getFullYear()}-{String(f.next_invoice_number).padStart(4, '0')}</p>
          <Field label="Mentions légales en pied de facture"><textarea className="input" value={f.invoice_footer ?? ''} onChange={(e) => set('invoice_footer', e.target.value)} /></Field>
        </section>
      </fieldset>
      {owner && <button className="btn-primary">Enregistrer</button>}
      <Toast msg={toast} />
    </form>
  );
}

function Svc({ ok, label }: { ok: boolean; label: string }) {
  return <li className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-sage-500' : 'bg-clay-500'}`} />{label}<span className="text-ink-mute">— {ok ? 'branché' : 'à configurer'}</span></li>;
}
