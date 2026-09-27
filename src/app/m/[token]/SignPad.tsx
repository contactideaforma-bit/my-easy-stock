'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignPad({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState(defaultName);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr; c.height = r.height * dpr;
      const ctx = c.getContext('2d')!;
      ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#2b1b28';
      setHasInk(false);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current!.getContext('2d')!; const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext('2d')!; const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke(); setHasInk(true);
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = canvas.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHasInk(false);
  };

  async function submit() {
    setErr(null);
    if (!hasInk) return setErr('Signez dans le cadre avec votre doigt ou la souris.');
    setBusy(true);
    const res = await fetch('/api/engagements/sign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, accept, signature: canvas.current!.toDataURL('image/png') }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(j.error || 'Une erreur est survenue, réessayez.');
    router.refresh();
  }

  return (
    <div className="border-2 border-ink rounded-2xl bg-white p-4 sm:p-6 space-y-4 no-print">
      <h2 className="font-display text-2xl">Signer la lettre de mission</h2>
      <label className="block"><span className="label">Vos prénom et nom</span>
        <input className="input text-base" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <div>
        <div className="flex items-center justify-between mb-1"><span className="label mb-0">Votre signature</span>
          <button type="button" onClick={clear} className="text-xs underline text-ink-mute">Effacer</button></div>
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          className="w-full h-44 rounded-xl border border-dashed border-rose-300 bg-rose-50/40 touch-none cursor-crosshair" />
        {!hasInk && <p className="text-xs text-ink-mute mt-1">Signez dans le cadre avec le doigt (téléphone) ou la souris.</p>}
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="accent-rose-600 w-5 h-5 mt-0.5" />
        <span>J'ai lu la lettre de mission ci-dessus et j'en accepte les termes.</span>
      </label>
      {err && <p className="text-sm text-clay-700 bg-clay-50 rounded-lg px-3 py-2">{err}</p>}
      <button onClick={submit} disabled={busy || !accept} className="btn-primary w-full text-base py-3.5">{busy ? 'Signature…' : 'Je signe'}</button>
      <p className="text-[11px] text-ink-mute">Signature électronique : la date, l'heure, votre nom et une empreinte du document sont enregistrés comme preuve.</p>
    </div>
  );
}
