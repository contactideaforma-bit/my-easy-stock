'use client';

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
