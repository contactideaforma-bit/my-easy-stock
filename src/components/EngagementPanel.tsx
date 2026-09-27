'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, supabase } from '@/lib/supabase';
import { useCabinet } from './Cabinet';
import { Empty, Field } from './Bits';
import Modal from './Modal';
import { IconMail, IconMessage, IconPrinter, IconSend } from './Icons';
import { buildEngagement } from '@/lib/engagement';
import { frDate, whatsappLink } from '@/lib/utils';
import type { Client, Engagement } from '@/lib/types';

export const ENG_STATUS: Record<Engagement['status'], { l: string; c: string }> = {
  brouillon: { l: 'Brouillon', c: 'chip-honey' },
  envoyee: { l: 'En attente de signature', c: 'chip-lilac' },
  signee: { l: 'Signée', c: 'chip-sage' },
  annulee: { l: 'Annulée', c: 'chip-gray' },
};

/** Onglet « Lettre de mission » de la fiche client. */
export default function EngagementPanel({ client, onChange }: { client: Client; onChange?: () => void }) {
  const { cabinet, bump } = useCabinet();
  const [rows, setRows] = useState<Engagement[]>([]);
  const [edit, setEdit] = useState<Engagement | 'new' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase().from('mya_engagements').select('*').eq('client_id', client.id).order('created_at', { ascending: false });
    setRows((data ?? []) as Engagement[]);
  }, [client.id]);
  useEffect(() => { load(); }, [load]);

  async function send(e: Engagement, ch: 'email' | 'sms' | 'whatsapp') {
    setMsg(null);
    try {
      const r = await api<{ results: { ok: boolean; error?: string }[]; text: string }>('/api/engagements/send', { id: e.id, channels: [ch] });
      if (ch === 'whatsapp') {
        const link = whatsappLink(client.phone, r.text);
        if (link) window.open(link, '_blank');
      }
      const bad = r.results.find((x) => !x.ok);
      setMsg(bad ? `Échec : ${bad.error}` : ch === 'whatsapp' ? 'Message WhatsApp préparé' : `Envoyée par ${ch === 'email' ? 'email' : 'SMS'}`);
    } catch (err: any) { setMsg(err.message); }
    load(); bump(); onChange?.();
  }

  async function cancel(e: Engagement) {
    if (!confirm('Annuler cette lettre de mission ? Le lien de signature ne fonctionnera plus.')) return;
    await supabase().from('mya_engagements').update({ status: 'annulee' }).eq('id', e.id);
    load(); onChange?.();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-ink-soft flex-1">Le client reçoit un lien, lit la lettre et signe du doigt sur son téléphone : rien à installer, aucun compte à créer.</p>
        <button className="btn-primary btn-sm" onClick={() => setEdit('new')}>Préparer une lettre de mission</button>
      </div>
      {msg && <p className="text-sm bg-paper-deep rounded-lg px-3 py-2">{msg}</p>}
      <div className="card">
        {rows.length === 0 ? <Empty title="Aucune lettre de mission" text="Préparée en un clic à partir de votre modèle et de la fiche client." /> : rows.map((e) => (
          <div key={e.id} className="row flex-wrap">
            <span className="flex-1 min-w-[180px]">
              <span className="block text-sm font-semibold">{e.title}</span>
              <span className="block text-xs text-ink-mute">
                Créée le {frDate(e.created_at)}{e.sent_at ? ` · envoyée le ${frDate(e.sent_at)}` : ''}{e.signed_at ? ` · signée le ${frDate(e.signed_at)} par ${e.signer_name}` : ''}
              </span>
            </span>
            <span className={ENG_STATUS[e.status].c}>{ENG_STATUS[e.status].l}</span>
            <div className="flex flex-wrap gap-1.5">
              {e.status === 'brouillon' && <button className="btn-ghost btn-sm" onClick={() => setEdit(e)}>Modifier</button>}
              {(e.status === 'brouillon' || e.status === 'envoyee') && (
                <>
                  <button className="btn-soft btn-sm" disabled={!client.email} onClick={() => send(e, 'email')} title="Envoyer par email"><IconMail className="w-4 h-4" />{e.status === 'envoyee' ? 'Relancer' : 'Email'}</button>
                  <button className="btn-ghost btn-sm" disabled={!client.phone} onClick={() => send(e, 'sms')} title="Envoyer par SMS"><IconSend className="w-4 h-4" /></button>
                  <button className="btn-ghost btn-sm" disabled={!client.phone} onClick={() => send(e, 'whatsapp')} title="Envoyer par WhatsApp"><IconMessage className="w-4 h-4" /></button>
                </>
              )}
              {e.status !== 'brouillon' && <a className="btn-ghost btn-sm" href={`/m/${e.public_token}`} target="_blank" rel="noreferrer"><IconPrinter className="w-4 h-4" />Voir</a>}
              {e.status !== 'signee' && e.status !== 'annulee' && <button className="btn-danger btn-sm" onClick={() => cancel(e)}>Annuler</button>}
              {e.status === 'brouillon' && <button className="text-xs text-ink-mute hover:text-clay-600 px-1" onClick={async () => { await supabase().from('mya_engagements').delete().eq('id', e.id); load(); }}>Supprimer</button>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title="Lettre de mission" wide>
        {edit !== null && (
          <EngagementEditor
            initial={edit === 'new' ? null : edit}
            defaultContent={buildEngagement(client, cabinet)}
            onSaved={() => { setEdit(null); load(); onChange?.(); }}
            clientId={client.id}
          />
        )}
      </Modal>
    </div>
  );
}

function EngagementEditor({ initial, defaultContent, onSaved, clientId }: { initial: Engagement | null; defaultContent: string; onSaved: () => void; clientId: string }) {
  const { cabinet } = useCabinet();
  const [title, setTitle] = useState(initial?.title ?? `Lettre de mission ${new Date().getFullYear()}`);
  const [content, setContent] = useState(initial?.content ?? defaultContent);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const row = { cabinet_id: cabinet.id, client_id: clientId, title, content };
      const { error } = initial
        ? await supabase().from('mya_engagements').update(row).eq('id', initial.id)
        : await supabase().from('mya_engagements').insert(row);
      if (error) return setErr(error.message);
      onSaved();
    }}>
      <Field label="Titre"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Texte (pré-rempli avec votre modèle et la fiche client — les [crochets] sont à compléter)">
        <textarea className="input min-h-[420px] font-mono text-[12.5px] leading-relaxed" value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      {/\[[^\]]+\]/.test(content) && <p className="text-xs text-honey-600">Il reste des informations entre [crochets] à compléter (ou à ajouter dans la fiche client).</p>}
      {err && <p className="text-sm text-clay-700">{err}</p>}
      <button className="btn-primary w-full">Enregistrer le brouillon</button>
      <p className="text-xs text-ink-mute">Une fois signée, la lettre est verrouillée : son texte ne peut plus être modifié.</p>
    </form>
  );
}
