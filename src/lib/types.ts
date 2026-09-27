export type Role = 'titulaire' | 'collaborateur';

export interface Cabinet {
  id: string;
  name: string;
  legal_name: string | null;
  siret: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  iban: string | null;
  bic: string | null;
  vat_number: string | null;
  logo_url: string | null;
  invoice_prefix: string;
  next_invoice_number: number;
  payment_terms_days: number;
  default_vat_rate: number;
  invoice_footer: string | null;
  reminders_enabled: boolean;
  appointment_reminders: boolean;
  daily_digest: boolean;
  recurring_mode: 'brouillon' | 'auto';
  sms_sender: string | null;
}

export interface Member {
  cabinet_id: string;
  user_id: string;
  role: Role;
  full_name: string;
  email: string | null;
  color: string;
}

export type FeeFrequency = 'mensuel' | 'trimestriel' | 'annuel' | 'ponctuel';

export interface Client {
  id: string;
  cabinet_id: string;
  kind: string;
  name: string;
  legal_form: string | null;
  siren: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  activity: string | null;
  tax_regime: string | null;
  vat_regime: string | null;
  fiscal_year_end: string | null;
  mission: string | null;
  fee_amount: number | null;
  fee_frequency: FeeFrequency;
  fee_label: string | null;
  fee_next_date: string | null;
  payment_method: string | null;
  owner_member: string | null;
  status: 'actif' | 'prospect' | 'archive';
  reminders_paused: boolean;
  preferred_channel: 'email' | 'sms' | 'whatsapp';
  notes: string | null;
  created_at: string;
}

export interface Request {
  id: string;
  cabinet_id: string;
  client_id: string | null;
  contact_name: string | null;
  channel: 'telephone' | 'email' | 'whatsapp' | 'sms' | 'visite' | 'autre';
  subject: string;
  details: string | null;
  priority: Priority;
  status: 'nouvelle' | 'en_cours' | 'attente_client' | 'traitee';
  assigned_to: string | null;
  due_date: string | null;
  received_at: string;
  done_at: string | null;
  mya_clients?: { name: string } | null;
}

export type Priority = 'basse' | 'normale' | 'haute' | 'urgente';

export interface Task {
  id: string;
  cabinet_id: string;
  client_id: string | null;
  request_id: string | null;
  title: string;
  notes: string | null;
  category: string;
  due_date: string | null;
  priority: Priority;
  status: 'a_faire' | 'en_cours' | 'fait';
  assigned_to: string | null;
  recurrence: 'aucune' | 'hebdo' | 'mensuelle' | 'trimestrielle' | 'annuelle';
  done_at: string | null;
  mya_clients?: { name: string } | null;
}

export interface Appointment {
  id: string;
  cabinet_id: string;
  client_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string | null;
  kind: 'cabinet' | 'visio' | 'telephone' | 'chez_client';
  location: string | null;
  notes: string | null;
  member_id: string | null;
  remind_client: boolean;
  reminded_at: string | null;
  status: 'prevu' | 'fait' | 'annule' | 'absent';
  mya_clients?: { name: string; phone: string | null; email: string | null } | null;
}

export interface InvoiceLine {
  label: string;
  qty: number;
  unit_price: number;
}

export interface Invoice {
  id: string;
  cabinet_id: string;
  client_id: string;
  number: string | null;
  issue_date: string;
  due_date: string;
  label: string;
  lines: InvoiceLine[];
  vat_rate: number;
  amount_ht: number;
  amount_ttc: number;
  paid_amount: number;
  status: 'brouillon' | 'envoyee' | 'payee' | 'annulee';
  sent_at: string | null;
  paid_at: string | null;
  reminder_level: number;
  last_reminder_at: string | null;
  reminders_paused: boolean;
  payment_link: string | null;
  notes: string | null;
  is_recurring: boolean;
  public_token: string;
  created_at: string;
  mya_clients?: Pick<Client, 'name' | 'email' | 'phone' | 'contact_name' | 'reminders_paused'> | null;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  paid_on: string;
  method: string;
  note: string | null;
}

export interface ReminderRule {
  id: string;
  cabinet_id: string;
  step: number;
  offset_days: number;
  channels: string[];
  tone: 'courtois' | 'ferme' | 'mise_en_demeure';
  subject: string;
  body: string;
  active: boolean;
}

export interface ReminderLog {
  id: string;
  invoice_id: string | null;
  client_id: string | null;
  kind: 'envoi_facture' | 'relance' | 'rappel_rdv' | 'recap';
  step: number | null;
  channel: 'email' | 'sms' | 'whatsapp';
  status: 'envoye' | 'echec' | 'prepare';
  recipient: string | null;
  subject: string | null;
  message: string | null;
  error: string | null;
  automatic: boolean;
  created_at: string;
  mya_clients?: { name: string } | null;
  mya_invoices?: { number: string | null } | null;
}
