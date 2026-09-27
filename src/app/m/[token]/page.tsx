import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/server';
import { frDate, frTime } from '@/lib/utils';
import PrintButton from '@/components/PrintButton';
import SignPad from './SignPad';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lettre de mission', robots: { index: false } };

// Page publique : le client lit et signe sa lettre de mission (aucun compte à créer)
export default async function EngagementPage({ params }: { params: { token: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) notFound();
  const sb = adminClient();
  const { data: e } = await sb.from('mya_engagements').select('*').eq('public_token', params.token).neq('status', 'brouillon').maybeSingle();
  if (!e) notFound();
  const [{ data: cab }, { data: client }] = await Promise.all([
    sb.from('mya_cabinets').select('name,legal_name,logo_url,phone,email').eq('id', e.cabinet_id).single(),
    sb.from('mya_clients').select('name,contact_name').eq('id', e.client_id).single(),
  ]);
  const signed = e.status === 'signee';

  return (
    <main className="min-h-dvh py-6 px-4 print:p-0">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between no-print">
          <p className="font-display text-xl">{cab?.name}</p>
          <PrintButton />
        </div>
        {e.status === 'annulee' && <p className="border-2 border-clay-600 rounded-2xl bg-white p-4 text-clay-700 font-semibold">Cette lettre de mission a été annulée par le cabinet.</p>}
        {signed && (
          <div className="border-2 border-ink rounded-2xl bg-white p-4 no-print">
            <p className="font-semibold">Merci, la lettre de mission est signée.</p>
            <p className="text-sm text-ink-soft">Vous pouvez l'imprimer ou l'enregistrer en PDF avec le bouton ci-dessus.</p>
          </div>
        )}

        <article className="bg-white border border-paper-line rounded-2xl p-6 sm:p-10 print:border-0 print:p-0">
          {cab?.logo_url && <img src={cab.logo_url} alt="" className="h-12 mb-6 object-contain" />}
          <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{e.content}</div>

          <div className="mt-10 grid sm:grid-cols-2 gap-6 text-sm">
            <div className="border border-ink rounded-xl p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-mute">Pour le cabinet</p>
              <p className="font-semibold">{cab?.legal_name || cab?.name}</p>
            </div>
            <div className="border border-ink rounded-xl p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-mute">Pour le client — {client?.name}</p>
              {signed ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.signature} alt="Signature" className="h-20 my-1" />
                  <p className="font-semibold">{e.signer_name}</p>
                  <p className="text-ink-soft">Signé électroniquement le {frDate(e.signed_at, { day: 'numeric', month: 'long', year: 'numeric' })} à {frTime(e.signed_at)}</p>
                </>
              ) : <p className="text-ink-mute mt-6">En attente de signature</p>}
            </div>
          </div>
          {signed && (
            <p className="mt-6 text-[10px] text-ink-mute break-all">
              Preuve de signature — horodatage : {e.signed_at} · adresse IP : {e.signer_ip ?? 'n.c.'} · empreinte SHA-256 du document : {e.content_hash}
            </p>
          )}
        </article>

        {e.status === 'envoyee' && <SignPad token={params.token} defaultName={client?.contact_name ?? ''} />}
      </div>
    </main>
  );
}
