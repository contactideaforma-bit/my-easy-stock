import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/** Client Supabase agissant au nom de la personne connectée (les règles RLS s'appliquent). */
export async function authed(req: Request): Promise<{ db: SupabaseClient; user: User } | NextResponse> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  return { db, user: data.user };
}

export const fail = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
