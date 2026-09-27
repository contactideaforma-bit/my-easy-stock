// Lettre de mission : modèle par défaut et remplissage des variables.
// Modèle de départ à relire et adapter par l'expert-comptable (normes de l'Ordre, spécificités du cabinet).
import { eur, fillTemplate, frDate, LABELS, todayISO } from './utils';
import type { Cabinet, Client } from './types';

export const ENGAGEMENT_VARS = ['{client}', '{forme}', '{siren}', '{adresse}', '{contact}', '{activite}', '{mission}', '{honoraires}', '{frequence}', '{cloture}', '{paiement}', '{delai_paiement}', '{cabinet}', '{cabinet_adresse}', '{cabinet_siret}', '{date}'];

export const DEFAULT_ENGAGEMENT = `LETTRE DE MISSION

Entre :
{cabinet}, {cabinet_adresse}, SIRET {cabinet_siret}, ci-après « le cabinet »,
et :
{client} ({forme}), SIREN {siren}, {adresse}, représenté(e) par {contact}, ci-après « le client ».

1. OBJET DE LA MISSION
Le client confie au cabinet la mission suivante : {mission}.
Activité du client : {activite}. Date de clôture de l'exercice : {cloture}.
La mission est réalisée conformément aux normes professionnelles de l'Ordre des experts-comptables.

2. DURÉE
La mission prend effet à la date de signature pour une durée d'un exercice comptable. Elle se renouvelle ensuite chaque année par tacite reconduction, sauf résiliation par l'une des parties par lettre recommandée au moins trois mois avant la date de clôture de l'exercice.

3. OBLIGATIONS DU CLIENT
Le client s'engage à transmettre au cabinet, dans les délais convenus, l'ensemble des pièces et informations nécessaires (relevés bancaires, factures d'achat et de vente, caisse, stocks, contrats, emprunts…) et à informer le cabinet de tout événement important concernant son activité. Tout retard dans la transmission des pièces peut entraîner un décalage des travaux dont le cabinet ne saurait être tenu responsable.

4. HONORAIRES
Les honoraires sont fixés à {honoraires} HT, facturés selon une périodicité {frequence}.
Les travaux exceptionnels ou non prévus à la présente lettre feront l'objet d'une facturation complémentaire, après accord du client.

5. MODALITÉS DE PAIEMENT
Les factures sont payables à {delai_paiement} jours à compter de leur date d'émission, par {paiement}.
Conformément à l'article L441-10 du Code de commerce, tout retard de paiement entraîne de plein droit l'application de pénalités de retard égales à trois fois le taux d'intérêt légal, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €.

6. SUSPENSION DES TRAVAUX EN CAS D'IMPAYÉ
En cas de non-paiement d'une facture à son échéance, et après une relance restée sans effet pendant 15 jours, le cabinet se réserve le droit de suspendre l'exécution de sa mission jusqu'au complet règlement des sommes dues, sans que cette suspension puisse lui être reprochée ni engager sa responsabilité, notamment au regard des échéances déclaratives. Le client en est informé par écrit.

7. RESPONSABILITÉ
Le cabinet est tenu à une obligation de moyens. Sa responsabilité civile professionnelle est assurée conformément à la réglementation. Il ne peut être tenu responsable des conséquences d'informations inexactes ou incomplètes fournies par le client.

8. LUTTE CONTRE LE BLANCHIMENT
Conformément aux articles L561-1 et suivants du Code monétaire et financier, le cabinet procède à l'identification du client et de ses bénéficiaires effectifs. Le client s'engage à fournir les justificatifs demandés.

9. DONNÉES PERSONNELLES
Les données transmises sont traitées exclusivement pour l'exécution de la mission et conservées pendant la durée légale. Le client dispose d'un droit d'accès, de rectification et de suppression auprès du cabinet.

10. LITIGES
En cas de différend, les parties rechercheront une solution amiable, le cas échéant avec l'aide du Conseil régional de l'Ordre des experts-comptables, avant toute action judiciaire.

Fait le {date}.
Le client déclare avoir pris connaissance de la présente lettre de mission et en accepter les termes.`;

export function engagementVars(client: Partial<Client>, cab: Partial<Cabinet>) {
  const fee = client.fee_amount ? eur(client.fee_amount) : '[montant à préciser]';
  return {
    client: client.name,
    forme: client.legal_form || (client.kind ? LABELS.kind[client.kind] : ''),
    siren: client.siren || '[SIREN]',
    adresse: client.address || '[adresse]',
    contact: client.contact_name || client.name,
    activite: client.activity || '[activité]',
    mission: client.mission || 'tenue de la comptabilité, établissement des comptes annuels et des déclarations fiscales',
    honoraires: fee,
    frequence: client.fee_frequency ? LABELS.freq[client.fee_frequency].toLowerCase() : 'mensuelle',
    cloture: client.fiscal_year_end ? client.fiscal_year_end.split('-').reverse().join('/') : '31/12',
    paiement: client.payment_method ? LABELS.method[client.payment_method].toLowerCase() : 'virement',
    delai_paiement: cab.payment_terms_days ?? 30,
    cabinet: cab.legal_name || cab.name,
    cabinet_adresse: (cab.address || '[adresse du cabinet]').replace(/\n/g, ', '),
    cabinet_siret: cab.siret || '[SIRET]',
    date: frDate(todayISO(), { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

export function buildEngagement(client: Partial<Client>, cab: Partial<Cabinet>) {
  return fillTemplate(cab.engagement_template || DEFAULT_ENGAGEMENT, engagementVars(client, cab));
}
