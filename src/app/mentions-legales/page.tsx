import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Mentions légales — My Easy Stock' };

/*
 * ⚠️ À PERSONNALISER : remplacez les champs entre [crochets] par les
 * informations réelles de la société avant la mise en production.
 */

const sections = [
  {
    title: 'Éditeur du site',
    body: `Le site et l'application My Easy Stock sont édités par :
[Nom de la société] — [forme juridique, ex. SARL au capital de X €]
Siège social : [adresse complète]
SIRET : [numéro SIRET] — RCS : [ville d'immatriculation]
Directeur de la publication : [nom du dirigeant]
Contact : [email] — [téléphone]`,
  },
  {
    title: 'Hébergement',
    body: `L'application est hébergée par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).
Les données sont stockées par Supabase Inc. (supabase.com) sur des serveurs situés dans l'Union européenne.`,
  },
  {
    title: 'Données personnelles (RGPD)',
    body: `Les données enregistrées dans l'application (fiches clients, vendeurs, ventes) sont traitées par [Nom de la société] pour les seuls besoins de la gestion commerciale de son activité, sur la base de son intérêt légitime.
Elles ne sont ni cédées ni vendues à des tiers, et sont conservées pendant la durée légale applicable aux documents commerciaux.
Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés, toute personne concernée peut exercer ses droits d'accès, de rectification, d'effacement et d'opposition en écrivant à : [email de contact].
Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (cnil.fr).`,
  },
  {
    title: 'Cookies',
    body: `L'application n'utilise aucun cookie publicitaire ni traceur tiers. Seuls des jetons techniques strictement nécessaires à l'authentification des utilisateurs sont stockés sur l'appareil.`,
  },
  {
    title: 'Propriété intellectuelle',
    body: `L'ensemble des éléments du site (structure, textes, logo, interface) est la propriété de [Nom de la société] ou de ses concédants. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.`,
  },
];

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto w-full max-w-3xl flex items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="My Easy Stock" className="w-10 h-10 rounded-xl" />
          <span className="font-bold text-ink text-lg tracking-tight">My Easy Stock</span>
        </Link>
        <Link href="/" className="btn-glass !py-2 !px-4 text-sm">
          Retour
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20">
        <h1 className="text-3xl font-extrabold text-ink tracking-tight mt-6 mb-8">Mentions légales</h1>
        <div className="space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="glass p-5">
              <h2 className="font-semibold text-ink mb-2">{s.title}</h2>
              <p className="text-ink/65 text-sm leading-relaxed whitespace-pre-line">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="text-ink/40 text-xs mt-6">Dernière mise à jour : {new Date().getFullYear()}.</p>
      </main>
    </div>
  );
}
