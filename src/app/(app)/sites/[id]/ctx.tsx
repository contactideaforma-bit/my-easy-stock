'use client';

import { createContext, useContext } from 'react';
import type { AuditRow, Site } from '@/lib/types';

export type AuditLite = { id: string; score: number | null; created_at: string; pages_crawled: number };
export type SiteCtxT = { site: Site; audits: AuditLite[]; latest: AuditRow | null; refresh: () => Promise<void>; runAudit: () => Promise<void>; running: boolean; runError: string | null };
export const SiteCtx = createContext<SiteCtxT>(null as any);
export const useSite = () => useContext(SiteCtx);
