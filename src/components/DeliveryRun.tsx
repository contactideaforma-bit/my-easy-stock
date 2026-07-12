'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 🥚 Easter egg « Livraison express » — runner façon dino :
 * un carton de marchandise saute par-dessus les obstacles de l'entrepôt.
 * Tap / espace pour sauter. High-score conservé sur l'appareil.
 * Se lance en tapant 7 fois sur « Bonjour » de l'accueil.
 */
export default function DeliveryRun({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const stateRef = useRef({ running: true, jumpQueued: false });

  useEffect(() => {
    setBest(Number(localStorage.getItem('mes_runner_hiscore') || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const W = (canvas.width = Math.min(window.innerWidth - 32, 480));
    const H = (canvas.height = 260);
    const GROUND = H - 40;

    // Carton
    const box = { x: 50, y: GROUND, w: 34, h: 30, vy: 0, onGround: true };
    let obstacles: { x: number; w: number; h: number; type: 'palette' | 'cone' }[] = [];
    let speed = 4.2;
    let dist = 0;
    let next = 0;
    let raf = 0;
    const st = stateRef.current;
    st.running = true;

    function spawn() {
      const type = Math.random() < 0.6 ? 'palette' : 'cone';
      obstacles.push({ x: W + 20, w: type === 'palette' ? 42 : 18, h: type === 'palette' ? 26 : 30, type });
      next = 55 + Math.random() * 70;
    }

    function jump() {
      if (box.onGround && st.running) {
        box.vy = -11.5;
        box.onGround = false;
        if (navigator.vibrate) navigator.vibrate(15);
      }
    }

    function drawBox() {
      // carton avec scotch
      ctx.fillStyle = '#c8955c';
      ctx.fillRect(box.x, box.y - box.h, box.w, box.h);
      ctx.fillStyle = '#a97b45';
      ctx.fillRect(box.x, box.y - box.h, box.w, 5);
      ctx.fillStyle = '#f0e4d2';
      ctx.fillRect(box.x + box.w / 2 - 3, box.y - box.h, 6, box.h);
      ctx.strokeStyle = '#8a6236';
      ctx.strokeRect(box.x + 0.5, box.y - box.h + 0.5, box.w - 1, box.h - 1);
    }

    function drawObstacle(o: { x: number; w: number; h: number; type: string }) {
      if (o.type === 'palette') {
        ctx.fillStyle = '#8a6236';
        for (let i = 0; i < 3; i++) ctx.fillRect(o.x, GROUND - o.h + i * 9, o.w, 5);
        ctx.fillRect(o.x + 2, GROUND - o.h, 5, o.h);
        ctx.fillRect(o.x + o.w - 7, GROUND - o.h, 5, o.h);
      } else {
        ctx.fillStyle = '#f05e23';
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, GROUND - o.h);
        ctx.lineTo(o.x + o.w, GROUND);
        ctx.lineTo(o.x, GROUND);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(o.x + o.w / 2 - 6, GROUND - o.h / 2 - 2, 12, 4);
      }
    }

    function loop() {
      if (!st.running) return;
      if (st.jumpQueued) {
        st.jumpQueued = false;
        jump();
      }

      // physique
      box.vy += 0.62;
      box.y += box.vy;
      if (box.y >= GROUND) {
        box.y = GROUND;
        box.vy = 0;
        box.onGround = true;
      }

      dist += speed;
      speed = Math.min(11, 4.2 + dist / 2600);
      next -= 1;
      if (next <= 0) spawn();
      obstacles.forEach((o) => (o.x -= speed));
      obstacles = obstacles.filter((o) => o.x + o.w > -10);

      // collision
      for (const o of obstacles) {
        if (box.x + box.w - 6 > o.x && box.x + 6 < o.x + o.w && box.y - 4 > GROUND - o.h) {
          st.running = false;
          const s = Math.floor(dist / 10);
          setScore(s);
          setBest((prev) => {
            const b = Math.max(prev, s);
            localStorage.setItem('mes_runner_hiscore', String(b));
            return b;
          });
          setOver(true);
          if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
          return;
        }
      }

      // dessin
      ctx.clearRect(0, 0, W, H);
      // ciel + sol
      ctx.fillStyle = 'rgba(96,184,250,0.12)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#2b5a8c';
      ctx.beginPath();
      ctx.moveTo(0, GROUND + 0.5);
      ctx.lineTo(W, GROUND + 0.5);
      ctx.stroke();
      // marquage au sol qui défile
      ctx.fillStyle = 'rgba(43,90,140,0.35)';
      for (let x = -((dist * 1.2) % 34); x < W; x += 34) ctx.fillRect(x, GROUND + 8, 16, 3);

      drawBox();
      obstacles.forEach(drawObstacle);

      // score
      ctx.fillStyle = '#0d2b4e';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.floor(dist / 10)).padStart(5, '0'), W - 12, 26);

      raf = requestAnimationFrame(loop);
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        st.jumpQueued = true;
      }
    };
    window.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(loop);

    return () => {
      st.running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]); // relance une partie quand `over` repasse à false

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
      onClick={() => (stateRef.current.jumpQueued = true)}
    >
      <div className="glass-strong p-4 space-y-3 w-full max-w-[512px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">📦 Livraison express</h3>
          <button className="btn-glass !py-1.5 !px-3 text-sm" onClick={onClose}>Fermer</button>
        </div>
        <div className="relative" onClick={() => (stateRef.current.jumpQueued = true)}>
          <canvas ref={canvasRef} className="w-full rounded-2xl" style={{ touchAction: 'manipulation' }} />
          {over && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 rounded-2xl">
              <p className="text-ink font-bold text-xl">Colis renversé ! 📦💥</p>
              <p className="text-ink/70 text-sm">Score : <b>{score}</b> · Record : <b>{best}</b></p>
              <button
                className="btn-accent !py-2 !px-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setOver(false);
                }}
              >
                Rejouer
              </button>
            </div>
          )}
        </div>
        <p className="text-ink/45 text-xs text-center">Touchez l&apos;écran (ou Espace) pour sauter par-dessus palettes et cônes.</p>
      </div>
    </div>
  );
}
