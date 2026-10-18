export const scoreColor = (s: number | null | undefined) => (s == null ? '#9aa3c0' : s >= 80 ? '#0fa37f' : s >= 55 ? '#e39a12' : '#e5484d');
export const scoreWord = (s: number | null | undefined) => (s == null ? '—' : s >= 80 ? 'Bon' : s >= 55 ? 'Moyen' : 'Faible');

export function ScoreRing({ score, size = 150, label = 'Score SEO' }: { score: number | null; size?: number; label?: string }) {
  const r = 44, c = 2 * Math.PI * r;
  const v = score ?? 0;
  const col = scoreColor(score);
  const id = `g${Math.round(v)}${size}`;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={col} /><stop offset="1" stopColor="#6d5efc" stopOpacity=".85" /></linearGradient>
          <filter id={id + 'f'}><feGaussianBlur stdDeviation="2.2" /></filter>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={`url(#${id})`} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} filter={`url(#${id}f)`} opacity=".45" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="display" style={{ fontSize: size * 0.28, fontWeight: 700, lineHeight: 1 }}>{score ?? '—'}</div>
          <div className="muted" style={{ fontSize: Math.max(10, size * 0.075), marginTop: 4 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

export function Meter({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div>
      <div className="row between" style={{ fontSize: 14, marginBottom: 6 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 700, color: scoreColor(value) }}>{value ?? '—'}{value != null && <span className="muted" style={{ fontWeight: 400 }}>/100</span>}</span>
      </div>
      <div className="meter"><i style={{ width: `${value ?? 0}%`, background: `linear-gradient(90deg, ${scoreColor(value)}, #6d5efc)` }} /></div>
    </div>
  );
}
