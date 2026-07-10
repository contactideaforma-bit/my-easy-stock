'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  IconScan,
  IconUsers,
  IconCash,
  IconClipboard,
  IconInvoice,
  IconChart,
  IconCheck,
  IconBox,
} from '@/components/Icons';

/* ------------------------------------------------------------------ */
/* Données de contenu                                                  */
/* ------------------------------------------------------------------ */

const marqueeWords = [
  'Stock en temps réel', 'Scan code-barres', 'Vendeurs en dépôt', 'Caisse mobile',
  'Reversements', 'Factures conformes', 'Inventaire éclair', 'Marges par vendeur',
  'Ticket WhatsApp', 'Exports comptables',
];

const sections = [
  {
    id: 'caisse',
    kicker: 'Encaissement',
    title: <>La vente ne prend plus que <em>quelques secondes</em></>,
    chips: ['Scan', 'Caisse', 'Monnaie', 'Ticket WhatsApp'],
    text: `Scannez l'étiquette ou tapez deux lettres : l'article est au panier. Espèces avec monnaie
    calculée, carte ou crédit client — et le ticket part sur WhatsApp en deux gestes. Une erreur ?
    La vente s'annule, le stock revient tout seul.`,
    mock: 'caisse' as const,
  },
  {
    id: 'vendeurs',
    kicker: 'Vendeurs en dépôt',
    title: <>Vous savez enfin <em>qui détient quoi</em>, et qui doit combien</>,
    chips: ['Lots', 'Stock par vendeur', 'Reversements', 'CA par vendeur'],
    text: `Remettez un lot à un vendeur : la marchandise passe de votre dépôt à son stock. Chacune de
    ses ventes alimente son solde « à reverser ». Plus de cahier, plus de disputes : les chiffres
    sont là, à jour, pour vous comme pour lui.`,
    mock: 'vendeur' as const,
  },
  {
    id: 'gestion',
    kicker: 'Pilotage & comptabilité',
    title: <>La paperasse se fait <em>toute seule</em></>,
    chips: ['Factures', 'TVA', 'Exports Excel', 'Marges'],
    text: `Chaque vente peut devenir une facture conforme — coordonnées, SIRET, TVA, RIB — en un clic.
    Le stock valorisé et le journal des ventes s'exportent pour votre comptable, et le tableau de
    bord vous dit chaque matin où vous en êtes.`,
    mock: 'facture' as const,
  },
];

const faqs = [
  {
    q: 'Faut-il un ordinateur ou du matériel de caisse ?',
    a: `Non. My Easy Stock fonctionne entièrement depuis un téléphone : la caméra sert de scanner
    code-barres et l'application s'installe sur l'écran d'accueil comme une app classique.`,
  },
  {
    q: 'Comment mes vendeurs sont-ils suivis ?',
    a: `Vous créez chaque vendeur en quelques secondes, puis vous lui remettez des lots : l'application
    tient à jour son stock, ses ventes du mois et le montant qu'il doit vous reverser. Vous pouvez
    reprendre la marchandise à tout moment.`,
  },
  {
    q: 'Les factures sont-elles conformes ?',
    a: `Oui : numérotation continue, coordonnées et SIRET de votre société, détail HT / TVA / TTC,
    RIB et mentions obligatoires (y compris la franchise en base de TVA si vous y êtes). Vous les
    imprimez ou les enregistrez en PDF.`,
  },
  {
    q: 'Que se passe-t-il si je me trompe sur une vente ?',
    a: `Chaque vente peut être annulée depuis le journal : la marchandise revient automatiquement dans
    le bon stock (dépôt ou vendeur) et tous les chiffres se corrigent.`,
  },
  {
    q: 'Mes données sont-elles en sécurité ?',
    a: `Vos données sont hébergées en Europe sur une base sécurisée, accessibles uniquement avec vos
    comptes utilisateurs. Vous pouvez exporter votre stock et vos ventes en Excel à tout moment.`,
  },
];

/* ------------------------------------------------------------------ */
/* Mockups produit (purs CSS)                                          */
/* ------------------------------------------------------------------ */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[270px] rounded-[2.2rem] border border-ink/10 bg-white/80 backdrop-blur-xl shadow-[0_30px_60px_rgba(29,101,216,0.18)] p-3">
      <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-ink/10" />
      <div className="space-y-2.5">{children}</div>
      <div className="mx-auto mt-3 h-1 w-24 rounded-full bg-ink/10" />
    </div>
  );
}

function MockCaisse() {
  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-1">
        <span className="font-bold text-ink text-sm">Caisse</span>
        <span className="chip !text-[10px]">Stock : Dépôt</span>
      </div>
      {[
        ['Baskets Runner', '42 · Noir', '45,00 €'],
        ['T-shirt coton', 'L · Blanc', '12,00 €'],
        ['Robe été', 'M · Bleu', '25,00 €'],
      ].map(([n, v, p]) => (
        <div key={n} className="glass !rounded-xl px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-ink text-xs font-semibold">{n}</p>
            <p className="text-ink/50 text-[10px]">{v}</p>
          </div>
          <span className="text-ink text-xs font-bold">{p}</span>
        </div>
      ))}
      <div className="btn-accent !rounded-xl !py-2.5 flex justify-between px-4 text-sm">
        <span>Encaisser</span>
        <span>82,00 €</span>
      </div>
    </PhoneFrame>
  );
}

function MockVendeur() {
  return (
    <PhoneFrame>
      <div className="flex items-center gap-2 px-1">
        <span className="w-8 h-8 rounded-xl text-white text-sm font-bold flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#60b8fa,#257ceb)' }}>A</span>
        <div>
          <p className="font-bold text-ink text-sm leading-none">Amina</p>
          <p className="text-ink/50 text-[10px] mt-0.5">27 pièces en dépôt</p>
        </div>
      </div>
      <div className="glass !rounded-xl px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-ink/55 text-[10px] uppercase tracking-wide">À reverser</span>
          <span className="text-coral-600 font-extrabold text-lg">340 €</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-ink/10 overflow-hidden">
          <div className="h-full w-2/3 rounded-full" style={{ background: 'linear-gradient(90deg,#ff8a55,#f05e23)' }} />
        </div>
      </div>
      {[
        ['CA du mois', '1 240 €'],
        ['Ventes', '18'],
      ].map(([k, v]) => (
        <div key={k} className="glass !rounded-xl px-3 py-2 flex items-center justify-between">
          <span className="text-ink/55 text-xs">{k}</span>
          <span className="text-ink font-bold text-sm">{v}</span>
        </div>
      ))}
      <div className="btn-primary !rounded-xl !py-2.5 text-sm">Donner un lot</div>
    </PhoneFrame>
  );
}

function MockFacture() {
  return (
    <div className="mx-auto w-[290px] rounded-2xl bg-white shadow-[0_30px_60px_rgba(29,101,216,0.18)] border border-ink/10 p-5 text-left">
      <div className="flex justify-between items-start border-b-2 pb-3" style={{ borderColor: '#257ceb' }}>
        <div>
          <p className="font-extrabold text-sm" style={{ color: '#1d65d8' }}>Votre Société</p>
          <p className="text-[9px] text-gray-500">SIRET 000 000 000 00000</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-xs text-gray-800">FACTURE</p>
          <p className="text-[9px] text-gray-500">FAC-2026-00042</p>
        </div>
      </div>
      {[
        ['2 × Baskets Runner — 42', '75,00 €'],
        ['1 × T-shirt coton — L', '10,00 €'],
      ].map(([l, p]) => (
        <div key={l} className="flex justify-between text-[10px] text-gray-700 py-1.5 border-b border-gray-100">
          <span>{l}</span><span>{p}</span>
        </div>
      ))}
      <div className="flex justify-between text-[10px] text-gray-500 pt-2"><span>Total HT</span><span>85,00 €</span></div>
      <div className="flex justify-between text-[10px] text-gray-500 pt-0.5"><span>TVA (20 %)</span><span>17,00 €</span></div>
      <div className="flex justify-between font-extrabold text-sm pt-1.5">
        <span className="text-gray-800">Total TTC</span><span style={{ color: '#1d65d8' }}>102,00 €</span>
      </div>
      <div className="mt-3 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[9px] text-gray-500">
        IBAN FR76 •••• •••• •••• — Paiement à réception
      </div>
    </div>
  );
}

const MOCKS = { caisse: MockCaisse, vendeur: MockVendeur, facture: MockFacture };

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  // Apparition au défilement
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-dvh">
      {/* ---------- Header sticky ---------- */}
      <header className="sticky top-0 z-50">
        <div className="bottom-nav mx-auto max-w-6xl mt-3 rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-192.png" alt="" className="w-8 h-8" />
            <span className="font-extrabold text-ink tracking-tight">My Easy Stock</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-ink/60 font-medium">
            <a href="#caisse" className="hover:text-ink">Caisse</a>
            <a href="#vendeurs" className="hover:text-ink">Vendeurs</a>
            <a href="#gestion" className="hover:text-ink">Gestion</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <Link href="/app" className="btn-primary !py-2 !px-4 sm:!px-5 text-sm">
            Ouvrir l&apos;app
          </Link>
        </div>
      </header>

      <main>
        {/* ---------- Héro ---------- */}
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24 pb-14">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="fade-up fade-up-1 inline-flex items-center gap-2 chip !px-4 !py-1.5">
                <span className="w-2 h-2 rounded-full bg-coral-500" />
                Conçu pour les grossistes textile &amp; chaussures
              </p>
              <h1 className="fade-up fade-up-2 mt-5 text-[2.6rem] leading-[1.05] sm:text-6xl font-extrabold text-ink tracking-tight">
                Le stock,
                <br />les vendeurs,
                <br />
                <span className="relative inline-block">
                  <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg,#257ceb,#f05e23)' }}>
                    l&apos;argent.
                  </span>
                  <svg viewBox="0 0 220 12" className="absolute -bottom-2 left-0 w-full" aria-hidden>
                    <path d="M3 9 Q 60 2 110 7 T 217 5" fill="none" stroke="#ff8a55" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
                  </svg>
                </span>
                <span className="text-ink"> Tenu.</span>
              </h1>
              <p className="fade-up fade-up-3 mt-6 text-lg text-ink/60 max-w-md leading-relaxed">
                Du carton fournisseur au reversement du vendeur, chaque pièce est tracée.
                Sur votre téléphone, sans cahier, sans tableur, sans oubli.
              </p>
              <div className="fade-up fade-up-4 mt-8 flex flex-wrap gap-3">
                <Link href="/app" className="btn-accent !px-8 !py-4">Commencer maintenant</Link>
                <a href="#caisse" className="btn-glass !px-8 !py-4">Voir comment</a>
              </div>
              <div className="fade-up fade-up-5 mt-10 flex gap-8">
                {[
                  ['3 s', 'pour scanner une pièce'],
                  ['1 clic', 'pour la facture'],
                  ['0 papier', 'tout est tracé'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-2xl font-extrabold text-ink">{k}</p>
                    <p className="text-xs text-ink/50 mt-0.5 max-w-[7rem]">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup héro */}
            <div className="fade-up fade-up-3 relative hidden lg:block">
              <div className="float-slow"><MockVendeur /></div>
              <div className="absolute -left-6 top-8 glass-strong px-4 py-3 rounded-2xl float-slow" style={{ animationDelay: '-1.4s' }}>
                <p className="text-[10px] text-ink/50">Ventes du mois</p>
                <p className="font-extrabold text-crystal-700">4 280 €</p>
              </div>
              <div className="absolute -right-2 bottom-16 glass-strong px-4 py-3 rounded-2xl float-slow" style={{ animationDelay: '-2.4s' }}>
                <p className="text-[10px] text-ink/50 flex items-center gap-1">
                  <IconCheck className="w-3 h-3 text-emerald-600" /> Inventaire à jour
                </p>
                <p className="font-extrabold text-ink text-sm">312 pièces</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Bandeau défilant ---------- */}
        <div className="border-y border-ink/10 bg-white/40 backdrop-blur-md overflow-hidden py-3.5">
          <div className="marquee-track">
            {[...marqueeWords, ...marqueeWords].map((w, i) => (
              <span key={i} className="flex items-center text-sm font-semibold text-ink/50 uppercase tracking-wider">
                <span className="mx-6">{w}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-coral-400" />
              </span>
            ))}
          </div>
        </div>

        {/* ---------- Sections alternées ---------- */}
        {sections.map((s, i) => {
          const Mock = MOCKS[s.mock];
          return (
            <section key={s.id} id={s.id} className="mx-auto max-w-6xl px-5 py-20 sm:py-28 scroll-mt-24">
              <div className={`grid lg:grid-cols-2 gap-12 items-center ${i % 2 ? 'lg:[direction:rtl]' : ''}`}>
                <div className="reveal lg:[direction:ltr]">
                  <p className="text-coral-600 font-bold text-sm uppercase tracking-widest">{s.kicker}</p>
                  <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-ink tracking-tight leading-tight [&_em]:not-italic [&_em]:text-crystal-600">
                    {s.title}
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {s.chips.map((c) => <span key={c} className="chip">{c}</span>)}
                  </div>
                  <p className="mt-5 text-ink/60 leading-relaxed max-w-lg">{s.text}</p>
                  <Link href="/app" className="inline-flex items-center gap-1.5 mt-6 font-semibold text-crystal-700 hover:text-crystal-800">
                    Essayer dans l&apos;application
                    <span aria-hidden>→</span>
                  </Link>
                </div>
                <div className="reveal lg:[direction:ltr]"><Mock /></div>
              </div>
            </section>
          );
        })}

        {/* ---------- Différenciateurs ---------- */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <h2 className="reveal text-center text-3xl font-extrabold text-ink tracking-tight mb-12">
            Ce qui rend My Easy Stock <span className="text-coral-600">différent</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                icon: IconBox,
                t: 'Pensé dépôt-vente',
                d: 'Le seul outil qui suit la marchandise confiée à vos vendeurs comme une banque suit un compte : lots, ventes, reversements.',
              },
              {
                icon: IconScan,
                t: 'Zéro matériel',
                d: 'Pas de caisse, pas de douchette, pas d\'ordinateur : un téléphone suffit. Les étiquettes s\'impriment depuis l\'app.',
              },
              {
                icon: IconChart,
                t: 'Des chiffres qui décident',
                d: 'Marges réelles par vendeur et par produit, alertes stock bas, exports comptables : vous tranchez avec des faits.',
              },
            ].map((c) => (
              <div key={c.t} className="reveal glass-strong p-6">
                <span className="inline-flex w-12 h-12 rounded-2xl items-center justify-center text-white mb-4"
                  style={{ background: 'linear-gradient(135deg,#ff8a55,#f05e23)' }}>
                  <c.icon className="w-6 h-6" />
                </span>
                <h3 className="font-bold text-ink text-lg">{c.t}</h3>
                <p className="text-ink/55 text-sm mt-2 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="mx-auto max-w-3xl px-5 pb-24 scroll-mt-24">
          <h2 className="reveal text-center text-3xl font-extrabold text-ink tracking-tight mb-10">
            Vous vous posez peut-être <span className="text-crystal-600">ces questions</span>
          </h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="faq reveal glass px-5 py-4">
                <summary className="font-semibold text-ink pr-6">{f.q}</summary>
                <p className="text-ink/60 text-sm leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- CTA final ---------- */}
        <section className="mx-auto max-w-5xl px-5 pb-24">
          <div className="reveal relative overflow-hidden rounded-[2rem] px-6 py-14 sm:py-16 text-center"
            style={{ background: 'linear-gradient(135deg,#1d65d8,#257ceb 55%,#f05e23 140%)' }}>
            <div className="absolute inset-0 opacity-20"
              style={{ background: 'repeating-radial-gradient(ellipse 60rem 30rem at 20% 0%, rgba(255,255,255,0.6) 0 2px, transparent 2px 80px)' }} />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Votre commerce mérite mieux qu&apos;un cahier.
              </h2>
              <p className="text-white/75 mt-3 max-w-lg mx-auto">
                Installez My Easy Stock sur votre téléphone et reprenez la main sur votre stock dès aujourd&apos;hui.
              </p>
              <Link href="/app" className="btn !px-9 !py-4 mt-8 bg-white text-crystal-800 font-bold shadow-xl">
                Ouvrir My Easy Stock
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-ink/10 bg-white/40 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-12 grid sm:grid-cols-4 gap-8">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-192.png" alt="" className="w-8 h-8" />
              <span className="font-extrabold text-ink">My Easy Stock</span>
            </div>
            <p className="text-ink/50 text-sm mt-3 max-w-xs leading-relaxed">
              La gestion de stock et de vendeurs en dépôt, pensée pour les grossistes en textile et chaussures.
            </p>
          </div>
          <div>
            <p className="section-title !text-xs mb-3">Produit</p>
            <ul className="space-y-2 text-sm text-ink/60">
              <li><a href="#caisse" className="hover:text-ink">Caisse &amp; scan</a></li>
              <li><a href="#vendeurs" className="hover:text-ink">Vendeurs en dépôt</a></li>
              <li><a href="#gestion" className="hover:text-ink">Factures &amp; exports</a></li>
              <li><Link href="/app" className="hover:text-ink">Ouvrir l&apos;application</Link></li>
            </ul>
          </div>
          <div>
            <p className="section-title !text-xs mb-3">Informations</p>
            <ul className="space-y-2 text-sm text-ink/60">
              <li><Link href="/mentions-legales" className="hover:text-ink">Mentions légales</Link></li>
              <li><Link href="/login" className="hover:text-ink">Connexion</Link></li>
              <li><a href="mailto:contact.ideaforma@gmail.com" className="hover:text-ink">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink/10 py-4 text-center text-xs text-ink/40">
          © {new Date().getFullYear()} My Easy Stock — Tous droits réservés
        </div>
      </footer>
    </div>
  );
}
