'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

/**
 * Scanner code-barres plein écran (caméra arrière).
 * Vibre à chaque détection. Anti-doublon 1,5 s.
 */
export default function Scanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ code: string; t: number }>({ code: '', t: 0 });
  const callbackRef = useRef(onDetected);
  callbackRef.current = onDetected;
  const [error, setError] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result) => {
          if (!result || cancelled) return;
          const code = result.getText();
          const now = Date.now();
          if (code === lastRef.current.code && now - lastRef.current.t < 1500) return;
          lastRef.current = { code, t: now };
          if (navigator.vibrate) navigator.vibrate(80);
          callbackRef.current(code);
        }
      )
      .then((controls) => {
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      })
      .catch(() => setError("Impossible d'accéder à la caméra. Vérifiez les autorisations."));

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        {/* Cadre de visée */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-44 rounded-2xl border-2 border-crystal-300/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <div className="w-full h-0.5 bg-crystal-400/90 mt-20 animate-pulse rounded" />
          </div>
        </div>
        {error && (
          <div className="absolute inset-x-4 top-6 glass p-4 text-center text-rose-200 text-sm">{error}</div>
        )}
      </div>
      <div className="p-4 pb-8 bg-black/60">
        <button className="btn-glass w-full" onClick={onClose}>
          Fermer le scanner
        </button>
      </div>
    </div>
  );
}
