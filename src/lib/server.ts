// Outils côté serveur uniquement (routes API) — ne jamais importer dans un composant client.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante (Vercel > Settings > Environment Variables)');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

/** Client Supabase agissant au nom de la personne connectée (RLS appliquée). */
export async function userFromRequest(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return null;
  const { data: m } = await sb.from('mya_members').select('*').eq('user_id', data.user.id).limit(1).maybeSingle();
  if (!m) return null;
  return { sb, user: data.user, member: m as { cabinet_id: string; role: string; full_name: string } };
}

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// ---------------- Envoi email (Resend) ----------------
export async function sendEmail(opts: { to: string; subject: string; text: string; replyTo?: string | null; fromName?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Emails non configurés (RESEND_API_KEY)" };
  let from = process.env.MAIL_FROM || 'onboarding@resend.dev';
  if (opts.fromName) {
    const addr = from.match(/<(.+)>/)?.[1] || from;
    from = `${opts.fromName.replace(/[<>"]/g, '')} <${addr}>`;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html: textToHtml(opts.text),
      reply_to: opts.replyTo || undefined,
    }),
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status} : ${(await res.text()).slice(0, 200)}` };
  return { ok: true as const };
}

// ---------------- Envoi SMS (Brevo) ----------------
export async function sendSms(opts: { to: string; text: string; sender?: string | null }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, error: 'SMS non configurés (BREVO_API_KEY)' };
  const sender = (opts.sender || 'Cabinet').replace(/[^A-Za-z0-9]/g, '').slice(0, 11) || 'Cabinet';
  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, recipient: opts.to, content: opts.text, type: 'transactional' }),
  });
  if (!res.ok) return { ok: false, error: `Brevo ${res.status} : ${(await res.text()).slice(0, 200)}` };
  return { ok: true as const };
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function textToHtml(text: string) {
  const body = esc(text)
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#cc3a73">$1</a>')
    .replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#3a2233;max-width:560px">${body}</div>`;
}
