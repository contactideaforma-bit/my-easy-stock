type P = { className?: string };
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const IconHome = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>
);
export const IconBox = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/></svg>
);
export const IconCash = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M6 10h.01M18 14h.01"/></svg>
);
export const IconClipboard = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a3 3 0 0 1 6 0"/><path d="m9 13 2 2 4-4"/></svg>
);
export const IconDots = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
);
export const IconScan = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
);
export const IconPlus = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="M12 5v14M5 12h14"/></svg>
);
export const IconSearch = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
);
export const IconTrash = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
);
export const IconUsers = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14a6.5 6.5 0 0 1 4 6"/></svg>
);
export const IconTruck = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="M2 6h12v11H2zM14 10h4l3 3v4h-7z"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
);
export const IconChart = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>
);
export const IconAlert = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17.5h.01"/></svg>
);
export const IconBack = ({ className = 'w-6 h-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="m14 6-6 6 6 6"/></svg>
);
export const IconTag = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="m3 12 9-9h9v9l-9 9z"/><circle cx="16.5" cy="7.5" r="1.2"/></svg>
);
export const IconLogout = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>
);
export const IconCheck = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...S}><path d="m4 12.5 5 5L20 6.5"/></svg>
);
