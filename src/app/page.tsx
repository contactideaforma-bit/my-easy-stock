import Link from 'next/link';
import {
  IconScan,
  IconUsers,
  IconCash,
  IconClipboard,
  IconInvoice,
  IconChart,
} from '@/components/Icons';

const features = [
  {
    icon: IconScan,
    title: 'Scan code-barres',
    desc: 'Étiquettes EAN-13 générées et imprimées ; vendez et inventoriez en scannant avec la caméra du téléphone.',
  },
  {
    icon: IconUsers,
    title: 'Vendeurs en dépôt',
    desc: 'Remettez des lots à vos vendeurs, suivez qui détient quoi, encaissez leurs reversements.',
  },
  {
    icon: IconCash,
    title: 'Caisse mobile',
    desc: 'Espèces avec calcul de monnaie, carte ou crédit client. Ticket partageable sur WhatsApp en deux gestes.',
  },
  {
    icon: IconClipboard,
    title: 'Inventaire éclair',
    desc: 'Comptez en scannant, les écarts sont calculés et le stock corrigé automatiquement.',
  },
  {
    icon: IconInvoice,
    title: 'Factures conformes',
    desc: 'Facture avec vos coordonnées, SIRET, TVA et RIB, générée en un clic depuis chaque vente.',
  },
  {
    icon: IconChart,
    title: 'Pilotage en temps réel',
    desc: 'Ventes du mois, marges par vendeur, alertes stock bas, exports Excel pour le comptable.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Barre de navigation */}
      <header className="fade-up fade-up-1 mx-auto w-full max-w-5xl flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-192.png" alt="My Easy Stock" className="w-10 h-10" />
          <span className="font-bold text-ink text-lg tracking-tight">My Easy Stock</span>
        </div>
        <Link href="/app" className="btn-primary !py-2 !px-5 text-sm">
          Ouvrir l&apos;application
        </Link>
      </header>

      <main className="flex-1">
        {/* Héro */}
        <section className="mx-auto max-w-5xl px-5 pt-10 pb-16 text-center">
          <h1 className="fade-up fade-up-2 text-4xl sm:text-5xl font-extrabold text-ink tracking-tight leading-tight">
            Votre stock, vos vendeurs,
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #257ceb 30%, #f05e23)' }}
            >
              pilotés depuis votre poche.
            </span>
          </h1>
          <p className="fade-up fade-up-3 text-ink/60 max-w-xl mx-auto mt-5 text-lg">
            L&apos;application de gestion pensée pour les grossistes en textile et chaussures :
            du carton fournisseur jusqu&apos;au reversement du vendeur, tout est suivi, rien ne se perd.
          </p>
          <div className="fade-up fade-up-4 flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link href="/app" className="btn-accent !px-8 !py-4 text-base">
              Commencer
            </Link>
            <a href="#fonctions" className="btn-glass !px-8 !py-4 text-base">
              Découvrir
            </a>
          </div>

          {/* Cartes flottantes de démonstration */}
          <div className="fade-up fade-up-5 relative max-w-md mx-auto mt-14 grid grid-cols-2 gap-4 text-left">
            <div className="glass-strong p-4 float-slow">
              <p className="text-ink/55 text-xs">Ventes du mois</p>
              <p className="text-2xl font-extrabold text-crystal-700 mt-1">4 280 €</p>
              <p className="text-emerald-600 text-xs mt-1">Marge : 1 512 €</p>
            </div>
            <div className="glass-strong p-4 float-slow" style={{ animationDelay: '-1.6s' }}>
              <p className="text-ink/55 text-xs">Amina — à reverser</p>
              <p className="text-2xl font-extrabold text-coral-600 mt-1">340 €</p>
              <p className="text-ink/45 text-xs mt-1">27 pièces en dépôt</p>
            </div>
          </div>
        </section>

        {/* Fonctionnalités */}
        <section id="fonctions" className="mx-auto max-w-5xl px-5 pb-20">
          <h2 className="text-center text-2xl font-bold text-ink tracking-tight mb-8">
            Tout ce qu&apos;il faut, rien de superflu
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={f.title} className={`glass p-5 fade-up fade-up-${Math.min(5, i + 1)}`}>
                <span
                  className="inline-flex w-11 h-11 rounded-2xl items-center justify-center text-white mb-3"
                  style={{
                    background:
                      i % 3 === 1
                        ? 'linear-gradient(135deg,#ff8a55,#f05e23)'
                        : 'linear-gradient(135deg,#60b8fa,#257ceb)',
                  }}
                >
                  <f.icon className="w-5 h-5" />
                </span>
                <h3 className="font-semibold text-ink">{f.title}</h3>
                <p className="text-ink/55 text-sm mt-1 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Appel final */}
        <section className="mx-auto max-w-3xl px-5 pb-24 text-center">
          <div className="glass-strong p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-ink tracking-tight">
              Installez-la sur votre téléphone, c&apos;est prêt.
            </h2>
            <p className="text-ink/55 mt-2">
              Aucune installation compliquée : ouvrez l&apos;application et ajoutez-la à votre écran d&apos;accueil.
            </p>
            <Link href="/app" className="btn-accent !px-8 !py-4 text-base mt-6">
              Ouvrir My Easy Stock
            </Link>
          </div>
        </section>
      </main>

      {/* Pied de page */}
      <footer className="border-t border-ink/10 py-6">
        <div className="mx-auto max-w-5xl px-5 flex flex-wrap items-center justify-between gap-3 text-sm text-ink/50">
          <span>© {new Date().getFullYear()} My Easy Stock</span>
          <nav className="flex gap-5">
            <Link href="/mentions-legales" className="hover:text-ink/80">Mentions légales</Link>
            <Link href="/login" className="hover:text-ink/80">Connexion</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
