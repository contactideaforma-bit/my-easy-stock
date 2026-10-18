export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6d5efc" /><stop offset="1" stopColor="#14c3d6" /></linearGradient>
          <radialGradient id="lg2" cx="0.32" cy="0.28" r="0.5"><stop offset="0" stopColor="#fff" stopOpacity="0.95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        <path d="M20 3c6 8 13 14 13 22a13 13 0 1 1-26 0C7 17 14 11 20 3z" fill="url(#lg1)" />
        <path d="M20 3c6 8 13 14 13 22a13 13 0 1 1-26 0C7 17 14 11 20 3z" fill="url(#lg2)" />
        <circle cx="21" cy="25" r="6" fill="none" stroke="#fff" strokeWidth="2.4" opacity=".95" />
        <path d="M25.5 29.5l4 4" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div className="display" style={{ fontWeight: 700, fontSize: 19 }}>MyEasy SEO</div>
        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>by IDEA · MyEasyDev</div>
      </div>
    </div>
  );
}
