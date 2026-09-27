'use client';

import { daysBetween, LABELS, todayISO } from '@/lib/utils';
import type { Invoice } from '@/lib/types';

export function InvoiceBadge({ i }: { i: Pick<Invoice, 'status' | 'due_date'> }) {
  const today = todayISO();
  if (i.status === 'envoyee' && i.due_date < today) return <span className="chip-clay">Retard {daysBetween(i.due_date, today)} j</span>;
  const cls = i.status === 'payee' ? 'chip-sage' : i.status === 'brouillon' ? 'chip-honey' : i.status === 'annulee' ? 'chip-gray' : 'chip-gray';
  return <span className={cls}>{LABELS.invoiceStatus[i.status]}</span>;
}
