import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { adminClient, appUrl, sendEmail } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Signature publique d'une lettre de mission (lien reçu par le client, sans compte). */
export async function POST(req: Request) {
  const { token, name, signature, accept } = (await req.json()) as { token: string; name: string; signature: string; accept: boolean };
  if (!/^[0-9a-f-]{36}$/i.test(token || '')) return NextResponse.json({ error: 'Lien invalide' }, { status: 400 });
  if (!accept) return NextResponse.json({ error: 'Merci de cocher la case d’acceptation' }, { status: 400 });
  if (!name || name.trim().length < 3) return NextResponse.json({ error: 'Indiquez vos prénom et nom' }, { status: 400 });
  if (!signature?.startsWith('data:image/png;base64,') || signature.length > 400_000)
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });

  const sb = adminClient();
  const { data: eng } = await sb.from('mya_engagements').select('*').eq('public_token', token).single();
  if (!eng) return NextResponse.json({ error: 'Lettre introuvable' }, { status: 404 });
  if (eng.status === 'signee') return NextResponse.json({ error: 'Cette lettre est déjà signée' }, { status: 400 });
  if (eng.status !== 'envoyee') return NextResponse.json({ error: 'Cette lettre n’est plus à signer' }, { status: 400 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || null;
  const signedAt = new Date().toISOString();
  const hash = createHash('sha256').update(eng.content, 'utf8').digest('hex');
  const { error } = await sb.from('mya_engagements').update({
    status: 'signee', signed_at: signedAt, signer_name: name.trim(), signer_ip: ip,
    signer_ua: (req.headers.get('user-agent') || '').slice(0, 300), signature, content_hash: hash,
  }).eq('id', eng.id).eq('status', 'envoyee');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Copie au client + alerte au cabinet
  const [{ data: cab }, { data: client }] = await Promise.all([
    sb.from('mya_cabinets').select('*').eq('id', eng.cabinet_id).single(),
    sb.from('mya_clients').select('*').eq('id', eng.client_id).single(),
  ]);
  const link = `${appUrl()}/m/${token}`;
  if (client?.email) {
    await sendEmail({ to: client.email, fromName: cab?.name, replyTo: cab?.email, subject: 'Votre lettre de mission signée',
      text: `Bonjour,\n\nMerci ! Votre lettre de mission est bien signée. Vous pouvez la consulter et la télécharger à tout moment ici :\n${link}\n\n${cab?.name ?? ''}` });
  }
  if (cab?.email) {
    await sendEmail({ to: cab.email, fromName: 'My Assistanad', subject: `Lettre de mission signée — ${client?.name ?? ''}`,
      text: `${name.trim()} vient de signer la lettre de mission de ${client?.name ?? 'votre client'}.\n\nVoir la lettre signée : ${link}` });
  }
  return NextResponse.json({ ok: true });
}
