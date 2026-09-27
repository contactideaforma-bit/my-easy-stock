'use client';

import { supabase } from './supabase';
import { fiscalTaskRows } from './fiscal';
import { todayISO } from './utils';
import type { Client } from './types';

/** Crée (sans doublon) les échéances fiscales d'un client sur les `days` prochains jours. Renvoie le nombre créé. */
export async function generateFiscal(client: Client, vatDay: number, days = 365): Promise<number> {
  const rows = fiscalTaskRows(client, todayISO(), days, vatDay);
  if (!rows.length) return 0;
  const { data, error } = await supabase().from('mya_tasks')
    .upsert(rows, { onConflict: 'client_id,fiscal_key', ignoreDuplicates: true }).select('id');
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
