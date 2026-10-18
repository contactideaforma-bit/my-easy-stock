'use client';

import { createContext, useContext } from 'react';
import type { Site } from '@/lib/types';

export type Ctx = { sites: (Site & { last_score?: number | null })[]; reload: () => Promise<void>; userEmail: string };
export const SitesCtx = createContext<Ctx>({ sites: [], reload: async () => {}, userEmail: '' });
export const useSites = () => useContext(SitesCtx);
