import { createClient } from '@supabase/supabase-js';

/** Client « service » pour les tâches automatiques (cron) — jamais exposé au navigateur. */
export function adminDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Autorise Vercel Cron (Authorization: Bearer CRON_SECRET) et les appels internes. */
export function cronAllowed(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  const internal = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret && auth === `Bearer ${secret}`) return true;
  if (internal && req.headers.get('x-internal-key') === internal) return true;
  if (!secret && /vercel-cron/i.test(req.headers.get('user-agent') || '')) return true;
  return false;
}
