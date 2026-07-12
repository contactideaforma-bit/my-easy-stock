'use client';

import { useEffect, useState } from 'react';

/**
 * My-bot — la mascotte de l'appli 🤖📦
 * Poses disponibles (fichiers dans /public/mybot/) :
 *  - happy   : rangement joyeux (accueil serein, états vides)
 *  - confus  : inquiétude de comptage (stock bas, écarts)
 *  - succes  : organisation terminée (validations réussies)
 *  - panique : article manquant (retards, ruptures)
 *  - scan    : scan de précision (analyses en cours)
 *  - restock : réassort prêt (suggestions de commande)
 */
export type MyBotPose = 'happy' | 'confus' | 'succes' | 'panique' | 'scan' | 'restock';

export default function MyBot({
  pose = 'happy',
  message,
  size = 88,
  className = '',
}: {
  pose?: MyBotPose;
  message?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/mybot/${pose}.png`}
        alt=""
        aria-hidden
        className="shrink-0 object-contain select-none"
        style={{ width: size, height: size }}
        draggable={false}
        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
      />
      {message && (
        <div className="relative glass !rounded-2xl px-3.5 py-2.5 text-sm text-ink">
          {/* petite pointe de bulle vers My-bot */}
          <span
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rotate-45"
            style={{ background: 'rgba(255,255,255,0.55)' }}
          />
          <span className="relative">{message}</span>
        </div>
      )}
    </div>
  );
}

/**
 * My-bot en mode guide : une astuce d'utilisation par page, qui change chaque jour.
 * Le ✕ masque les astuces de la page pendant 14 jours (mémorisé sur l'appareil).
 */
export function MyBotTip({ page, tips, pose = 'happy' }: { page: string; tips: string[]; pose?: MyBotPose }) {
  const [visible, setVisible] = useState(false);
  const [tip, setTip] = useState('');

  useEffect(() => {
    try {
      const off = Number(localStorage.getItem(`mybot_tips_off_${page}`) || 0);
      if (off && Date.now() - off < 14 * 86400000) return;
    } catch {}
    // Rotation quotidienne parmi les astuces de la page
    const day = Math.floor(Date.now() / 86400000);
    setTip(tips[day % tips.length]);
    setVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  if (!visible || !tip) return null;
  return (
    <div className="relative">
      <MyBot pose={pose} size={64} message={tip} />
      <button
        className="absolute -top-1 right-0 text-ink/35 text-lg leading-none p-1"
        aria-label="Masquer les astuces de cette page"
        title="Masquer les astuces de cette page (14 jours)"
        onClick={() => {
          try {
            localStorage.setItem(`mybot_tips_off_${page}`, String(Date.now()));
          } catch {}
          setVisible(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
