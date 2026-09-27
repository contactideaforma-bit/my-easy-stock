import { NextResponse } from 'next/server';
import { adminClient, userFromRequest } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Création d'un compte collaborateur par la titulaire du cabinet. */
export async function POST(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (ctx.member.role !== 'titulaire') return NextResponse.json({ error: 'Réservé à la titulaire du cabinet' }, { status: 403 });
  const { email, full_name, password, role, color } = await req.json();
  if (!email || !full_name || !password || String(password).length < 8)
    return NextResponse.json({ error: 'Email, nom et mot de passe (8 caractères minimum) requis' }, { status: 400 });

  const admin = adminClient();
  let userId: string | null = null;
  const created = await admin.auth.admin.createUser({ email: String(email).trim().toLowerCase(), password, email_confirm: true, user_metadata: { full_name } });
  if (created.error) {
    // Compte déjà existant ? On le rattache simplement au cabinet.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === String(email).trim().toLowerCase())?.id ?? null;
    if (!userId) return NextResponse.json({ error: created.error.message }, { status: 400 });
  } else userId = created.data.user.id;

  const { error } = await admin.from('mya_members').upsert({
    cabinet_id: ctx.member.cabinet_id, user_id: userId, role: role === 'titulaire' ? 'titulaire' : 'collaborateur',
    full_name, email: String(email).trim().toLowerCase(), color: color || '#8f78d9',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
