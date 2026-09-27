import { NextResponse } from 'next/server';
import { sendEmail, userFromRequest } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Indique quels services d'envoi sont branchés (sans jamais exposer les clés). */
export async function GET(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  return NextResponse.json({
    email: !!process.env.RESEND_API_KEY,
    sms: !!process.env.BREVO_API_KEY,
    cron: !!process.env.CRON_SECRET,
    service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    appUrl: !!process.env.NEXT_PUBLIC_APP_URL,
  });
}

/** Email de test envoyé à la personne connectée. */
export async function POST(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx?.user.email) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const r = await sendEmail({ to: ctx.user.email, subject: 'Test My Assistanad', text: 'Bonne nouvelle : les emails automatiques fonctionnent.', fromName: 'My Assistanad' });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
