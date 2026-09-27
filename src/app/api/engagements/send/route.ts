import { NextResponse } from 'next/server';
import { appUrl, sendEmail, sendSms, userFromRequest } from '@/lib/server';
import { intlPhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Envoi d'une lettre de mission à signer (email, SMS, ou trace d'un envoi WhatsApp fait à la main). */
export async function POST(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id, channels } = (await req.json()) as { id: string; channels: ('email' | 'sms' | 'whatsapp')[] };
  const { sb } = ctx;
  const { data: eng } = await sb.from('mya_engagements').select('*').eq('id', id).single();
  if (!eng) return NextResponse.json({ error: 'Lettre introuvable' }, { status: 404 });
  if (eng.status === 'signee' || eng.status === 'annulee') return NextResponse.json({ error: 'Cette lettre est déjà ' + eng.status }, { status: 400 });
  const [{ data: cab }, { data: client }] = await Promise.all([
    sb.from('mya_cabinets').select('*').eq('id', eng.cabinet_id).single(),
    sb.from('mya_clients').select('*').eq('id', eng.client_id).single(),
  ]);
  const link = `${appUrl()}/m/${eng.public_token}`;
  const text = `Bonjour ${client.contact_name || client.name},\n\nVoici votre lettre de mission. Vous pouvez la lire et la signer directement depuis votre téléphone ou votre ordinateur, en 1 minute :\n${link}\n\nPour toute question : ${cab.phone || cab.email || 'n’hésitez pas à nous appeler'}.\n\nBien cordialement,\n${cab.name}`;
  const results: { channel: string; ok: boolean; error?: string }[] = [];

  for (const ch of channels) {
    let res: { ok: boolean; error?: string } = { ok: false, error: 'Canal inconnu' };
    let recipient: string | null = null;
    let message = text;
    if (ch === 'email') {
      recipient = client.email;
      res = recipient ? await sendEmail({ to: recipient, subject: `Votre lettre de mission à signer — ${cab.name}`, text, replyTo: cab.email, fromName: cab.name }) : { ok: false, error: 'Pas d’email pour ce client' };
    } else if (ch === 'sms') {
      recipient = intlPhone(client.phone);
      message = `${cab.name} : votre lettre de mission est prête. Lisez-la et signez en 1 minute : ${link}`;
      res = recipient ? await sendSms({ to: recipient, text: message, sender: cab.sms_sender || cab.name }) : { ok: false, error: 'Pas de mobile valide' };
    } else if (ch === 'whatsapp') {
      recipient = intlPhone(client.phone);
      res = recipient ? { ok: true } : { ok: false, error: 'Pas de mobile valide' };
    }
    await sb.from('mya_reminders_log').insert({
      cabinet_id: eng.cabinet_id, client_id: eng.client_id, engagement_id: eng.id, kind: 'lettre_mission', channel: ch,
      status: res.ok ? (ch === 'whatsapp' ? 'prepare' : 'envoye') : 'echec', recipient, message, error: res.ok ? null : res.error,
      subject: ch === 'email' ? 'Lettre de mission à signer' : null, automatic: false, sent_by: ctx.user.id,
    });
    results.push({ channel: ch, ...res });
  }
  if (results.some((r) => r.ok)) {
    await sb.from('mya_engagements').update({ status: 'envoyee', sent_at: new Date().toISOString() }).eq('id', eng.id);
  }
  return NextResponse.json({ results, link, text });
}
