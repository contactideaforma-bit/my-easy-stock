import { NextResponse } from 'next/server';
import { adminClient, appUrl, sendEmail, sendSms } from '@/lib/server';
import { dueRule, sendInvoiceMessage, type Channel } from '@/lib/reminders';
import { INVOICE_BODY, INVOICE_SUBJECT } from '@/lib/messages';
import { addDays, addMonths, computeTotals, eur, FREQ_MONTHS, frDate, frTime, intlPhone, invoiceBalance, todayISO } from '@/lib/utils';
import type { Appointment, Cabinet, Client, Invoice, Member, ReminderRule } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Tâche planifiée quotidienne (Vercel Cron, 8 h heure de Paris) :
 * 1. prépare / envoie les factures d'honoraires récurrentes
 * 2. envoie les relances de paiement selon le scénario
 * 3. envoie les rappels de rendez-vous du lendemain
 * 4. envoie à chaque membre son programme du jour
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const url = new URL(req.url);
  if (!secret || (auth !== `Bearer ${secret}` && url.searchParams.get('secret') !== secret)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const sb = adminClient();
  const today = todayISO();
  const report: Record<string, unknown>[] = [];
  const { data: cabinets } = await sb.from('mya_cabinets').select('*');

  for (const cab of (cabinets ?? []) as Cabinet[]) {
    const r = { cabinet: cab.name, factures_recurrentes: 0, relances: 0, relances_echec: 0, rappels_rdv: 0, recaps: 0 };
    try {
      await recurring(sb, cab, today, r);
      if (cab.reminders_enabled) await reminders(sb, cab, today, r);
      if (cab.appointment_reminders) await appointmentReminders(sb, cab, today, r);
      if (cab.daily_digest) await digests(sb, cab, today, r);
    } catch (e: any) {
      (r as any).erreur = e.message;
    }
    report.push(r);
  }
  return NextResponse.json({ date: today, report });
}

type SB = ReturnType<typeof adminClient>;

// ---------------------------------------------------------------- 1. Honoraires récurrents
async function recurring(sb: SB, cab: Cabinet, today: string, r: any) {
  const { data: clients } = await sb.from('mya_clients').select('*')
    .eq('cabinet_id', cab.id).eq('status', 'actif').neq('fee_frequency', 'ponctuel')
    .gt('fee_amount', 0).lte('fee_next_date', today);

  for (const c of (clients ?? []) as Client[]) {
    const months = FREQ_MONTHS[c.fee_frequency] ?? 1;
    const period = frDate(c.fee_next_date!, { month: 'long', year: 'numeric' });
    const lines = [{ label: `${c.fee_label || 'Honoraires'} — ${period}`, qty: 1, unit_price: Number(c.fee_amount) }];
    const t = computeTotals(lines, cab.default_vat_rate);
    const { data: inv, error } = await sb.from('mya_invoices').insert({
      cabinet_id: cab.id, client_id: c.id, label: c.fee_label || 'Honoraires', lines, vat_rate: cab.default_vat_rate,
      amount_ht: t.ht, amount_ttc: t.ttc, issue_date: today, due_date: addDays(today, cab.payment_terms_days),
      status: 'brouillon', is_recurring: true, created_by: null,
    }).select('*').single();
    if (error || !inv) continue;

    if (cab.recurring_mode === 'auto') {
      const { data: number } = await sb.rpc('mya_next_invoice_number', { cab: cab.id });
      const { data: sent } = await sb.from('mya_invoices').update({ number, status: 'envoyee', sent_at: new Date().toISOString() }).eq('id', inv.id).select('*').single();
      const channels: Channel[] = c.preferred_channel === 'sms' ? ['email', 'sms'] : ['email'];
      if (sent) await sendInvoiceMessage({ sb, cab, inv: sent as Invoice, client: c, channels, subject: INVOICE_SUBJECT, body: INVOICE_BODY, kind: 'envoi_facture', automatic: true });
    }

    let next = c.fee_next_date!;
    while (next <= today) next = addMonths(next, months);
    await sb.from('mya_clients').update({ fee_next_date: next }).eq('id', c.id);
    r.factures_recurrentes++;
  }
}

// ---------------------------------------------------------------- 2. Relances de paiement
async function reminders(sb: SB, cab: Cabinet, today: string, r: any) {
  const [{ data: rules }, { data: invs }] = await Promise.all([
    sb.from('mya_reminder_rules').select('*').eq('cabinet_id', cab.id).order('step'),
    sb.from('mya_invoices').select('*, mya_clients(*)').eq('cabinet_id', cab.id).eq('status', 'envoyee').eq('reminders_paused', false),
  ]);
  for (const row of (invs ?? []) as (Invoice & { mya_clients: Client })[]) {
    const client = row.mya_clients;
    if (!client || client.reminders_paused || invoiceBalance(row) <= 0) continue;
    const rule = dueRule(row, (rules ?? []) as ReminderRule[], today);
    if (!rule) continue;

    // WhatsApp ne peut pas partir tout seul : on envoie par email/SMS et on garde WhatsApp pour le bouton manuel
    let channels = rule.channels.filter((c) => c === 'email' || c === 'sms') as Channel[];
    if (client.preferred_channel === 'sms' && !channels.includes('sms')) channels.push('sms');
    if (!client.email) channels = channels.filter((c) => c !== 'email');
    if (!intlPhone(client.phone) || !process.env.BREVO_API_KEY) channels = channels.filter((c) => c !== 'sms');

    let ok = false;
    let lastError = client.email || client.phone ? 'Canal non configuré' : 'Aucun email ni mobile dans la fiche';
    if (channels.length) {
      const res = await sendInvoiceMessage({ sb, cab, inv: row, client, channels, subject: rule.subject, body: rule.body, tone: rule.tone, step: rule.step, kind: 'relance', automatic: true });
      ok = res.results.some((x) => x.ok);
      lastError = res.results.find((x) => !x.ok)?.error ?? lastError;
    }
    await sb.from('mya_invoices').update({ reminder_level: rule.step, last_reminder_at: ok ? new Date().toISOString() : row.last_reminder_at }).eq('id', row.id);

    if (ok) r.relances++;
    else {
      r.relances_echec++;
      // Rien ne doit passer à la trappe : on crée une tâche pour relancer à la main
      await sb.from('mya_tasks').insert({
        cabinet_id: cab.id, client_id: client.id, category: 'relance', priority: 'haute', due_date: today,
        title: `Relancer ${client.name} — facture ${row.number} (${eur(invoiceBalance(row))})`,
        notes: `La relance automatique (étape ${rule.step}) n'a pas pu partir : ${lastError}.`,
        assigned_to: client.owner_member, created_by: null,
      });
    }
  }
}

// ---------------------------------------------------------------- 3. Rappels de rendez-vous
async function appointmentReminders(sb: SB, cab: Cabinet, today: string, r: any) {
  const tomorrow = addDays(today, 1);
  const from = new Date();
  const to = new Date(Date.now() + 50 * 3600e3);
  const { data } = await sb.from('mya_appointments').select('*, mya_clients(*)')
    .eq('cabinet_id', cab.id).eq('status', 'prevu').eq('remind_client', true).is('reminded_at', null)
    .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString());

  for (const a of (data ?? []) as (Appointment & { mya_clients: Client | null })[]) {
    if (todayISO(new Date(a.starts_at)) !== tomorrow || !a.mya_clients) continue;
    const c = a.mya_clients;
    const when = `${frDate(a.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })} à ${frTime(a.starts_at)}`;
    const where = a.kind === 'visio' ? `en visio${a.location ? ` : ${a.location}` : ''}` : a.kind === 'telephone' ? 'par téléphone' : a.kind === 'chez_client' ? 'dans vos locaux' : `au cabinet${cab.address ? ` (${cab.address})` : ''}`;
    const text = `Bonjour ${c.contact_name || c.name},\n\nPetit rappel : nous avons rendez-vous demain, ${when}, ${where}.\nObjet : ${a.title}\n\nEn cas d'empêchement, merci de nous prévenir au ${cab.phone || 'cabinet'}.\n\nÀ demain,\n${cab.name}`;
    let sent = false;
    if (c.email) {
      const e = await sendEmail({ to: c.email, subject: `Rappel : rendez-vous demain à ${frTime(a.starts_at)}`, text, replyTo: cab.email, fromName: cab.name });
      await log(sb, cab, a, c, 'email', c.email, text, e);
      sent ||= e.ok;
    }
    const phone = intlPhone(c.phone);
    if (phone && process.env.BREVO_API_KEY) {
      const sms = `${cab.name} : rappel de votre RDV demain ${frTime(a.starts_at)} (${where}). Empêchement ? ${cab.phone || 'Prévenez-nous'}`;
      const s = await sendSms({ to: phone, text: sms, sender: cab.sms_sender || cab.name });
      await log(sb, cab, a, c, 'sms', phone, sms, s);
      sent ||= s.ok;
    }
    if (sent) { await sb.from('mya_appointments').update({ reminded_at: new Date().toISOString() }).eq('id', a.id); r.rappels_rdv++; }
  }
}

async function log(sb: SB, cab: Cabinet, a: Appointment, c: Client, channel: 'email' | 'sms', recipient: string, message: string, res: { ok: boolean; error?: string }) {
  await sb.from('mya_reminders_log').insert({
    cabinet_id: cab.id, client_id: c.id, appointment_id: a.id, kind: 'rappel_rdv', channel,
    status: res.ok ? 'envoye' : 'echec', recipient, message, error: res.ok ? null : res.error, automatic: true,
  });
}

// ---------------------------------------------------------------- 4. Programme du jour
async function digests(sb: SB, cab: Cabinet, today: string, r: any) {
  if (!process.env.RESEND_API_KEY) return;
  const [{ data: members }, { data: tasks }, { data: reqs }, { data: appts }, { data: invs }, { data: logs }] = await Promise.all([
    sb.from('mya_members').select('*').eq('cabinet_id', cab.id),
    sb.from('mya_tasks').select('title,due_date,assigned_to,mya_clients(name)').eq('cabinet_id', cab.id).neq('status', 'fait').lte('due_date', today),
    sb.from('mya_requests').select('subject,assigned_to,priority,mya_clients(name),contact_name').eq('cabinet_id', cab.id).in('status', ['nouvelle', 'en_cours']),
    sb.from('mya_appointments').select('title,starts_at,member_id,mya_clients(name)').eq('cabinet_id', cab.id).neq('status', 'annule')
      .gte('starts_at', new Date(Date.now() - 6 * 3600e3).toISOString()).lt('starts_at', new Date(Date.now() + 24 * 3600e3).toISOString()).order('starts_at'),
    sb.from('mya_invoices').select('amount_ttc,paid_amount,due_date').eq('cabinet_id', cab.id).eq('status', 'envoyee'),
    sb.from('mya_reminders_log').select('id').eq('cabinet_id', cab.id).eq('automatic', true).eq('status', 'envoye').gte('created_at', new Date(Date.now() - 3600e3).toISOString()),
  ]);

  const late = (invs ?? []).filter((i) => i.due_date < today);
  const lateSum = late.reduce((s, i) => s + invoiceBalance(i), 0);

  for (const m of (members ?? []) as Member[]) {
    if (!m.email) continue;
    const mine = <T extends Record<string, any>>(rows: T[] | null, k: string) => (rows ?? []).filter((x) => x[k] === m.user_id);
    const t = mine(tasks as any[], 'assigned_to');
    const q = (reqs ?? []).filter((x: any) => x.assigned_to === m.user_id || !x.assigned_to);
    const a = mine(appts as any[], 'member_id').filter((x: any) => todayISO(new Date(x.starts_at)) === today);
    if (!t.length && !q.length && !a.length && m.role !== 'titulaire') continue;

    const name = (x: any) => x.mya_clients?.name ?? x.contact_name ?? 'Cabinet';
    const lines: string[] = [`Bonjour ${m.full_name.split(' ')[0]},`, '', `Voici votre programme du ${frDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}.`, ''];
    lines.push(`RENDEZ-VOUS (${a.length})`);
    lines.push(...(a.length ? a.map((x: any) => `• ${frTime(x.starts_at)} — ${x.title} (${name(x)})`) : ['• Aucun']), '');
    lines.push(`TÂCHES DU JOUR ET EN RETARD (${t.length})`);
    lines.push(...(t.length ? t.slice(0, 15).map((x: any) => `• ${x.title} — ${name(x)}${x.due_date < today ? ' (en retard)' : ''}`) : ['• Rien d\'urgent']), '');
    lines.push(`DEMANDES EN ATTENTE (${q.length})`);
    lines.push(...(q.length ? q.slice(0, 10).map((x: any) => `• ${x.subject} — ${name(x)}${x.priority === 'urgente' ? ' (URGENT)' : ''}`) : ['• Boîte vide']), '');
    if (m.role === 'titulaire') {
      lines.push('ARGENT');
      lines.push(`• ${late.length} facture(s) en retard : ${eur(lateSum)}`);
      lines.push(`• ${(logs ?? []).length} relance(s) envoyée(s) automatiquement ce matin`, '');
    }
    lines.push(`Ouvrir My Assistanad : ${appUrl()}/app`, '', 'Belle journée !');
    const res = await sendEmail({ to: m.email, subject: `Votre journée — ${a.length} RDV, ${t.length} tâche(s)`, text: lines.join('\n'), fromName: 'My Assistanad' });
    if (res.ok) r.recaps++;
  }
}
