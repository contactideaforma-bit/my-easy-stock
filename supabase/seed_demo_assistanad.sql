-- ============================================================
-- MY ASSISTANAD — Données de démonstration (entièrement fictives)
-- Compte : myriam@test.fr — à exécuter dans Supabase > SQL Editor > Run.
-- Relançable à volonté : efface puis recrée les données du cabinet de ce compte.
-- Les dates sont relatives au jour d'exécution : la démo reste toujours « fraîche ».
-- ============================================================
do $$
declare
  v_me uuid;
  v_cab uuid;
  c record;
  n int := 0;
  v_tpl text;
begin
  select id into v_me from auth.users where email = 'myriam@test.fr';
  if v_me is null then raise exception 'Compte myriam@test.fr introuvable : créez-le d''abord dans Authentication > Users'; end if;

  select cabinet_id into v_cab from public.mya_members where user_id = v_me limit 1;
  if v_cab is null then
    insert into public.mya_cabinets (name) values ('Cabinet Myriam Expertise') returning id into v_cab;
    insert into public.mya_members (cabinet_id, user_id, role, full_name, email) values (v_cab, v_me, 'titulaire', 'Myriam Ayouaz', 'myriam@test.fr');
  end if;

  -- Remise à zéro du cabinet de démonstration
  delete from public.mya_reminders_log where cabinet_id = v_cab;
  delete from public.mya_engagements where cabinet_id = v_cab;
  delete from public.mya_payments where cabinet_id = v_cab;
  delete from public.mya_invoices where cabinet_id = v_cab;
  delete from public.mya_tasks where cabinet_id = v_cab;
  delete from public.mya_requests where cabinet_id = v_cab;
  delete from public.mya_appointments where cabinet_id = v_cab;
  delete from public.mya_clients where cabinet_id = v_cab;
  delete from public.mya_reminder_rules where cabinet_id = v_cab;
  perform public.mya_default_rules(v_cab);

  update public.mya_cabinets set
    name = 'Cabinet Myriam Expertise', legal_name = 'ME Expertise Comptable SARL', siret = '901 234 567 00018',
    address = E'18 rue Grignan\n13001 Marseille', email = 'contact@cabinet-me-expertise.fr', phone = '04 91 00 00 00',
    iban = 'FR76 3000 4000 0500 0012 3456 789', bic = 'BNPAFRPPXXX', vat_number = 'FR12901234567',
    invoice_prefix = 'F', payment_terms_days = 30, default_vat_rate = 20,
    payment_link_template = 'https://paiement.exemple-banque.fr/cabinet-me?montant={montant}&ref={numero}',
    payment_link_label = 'Payer en ligne', reminders_enabled = true, appointment_reminders = true,
    daily_digest = true, recurring_mode = 'brouillon', fiscal_calendar = true, vat_due_day = 15, sms_sender = 'CabinetME'
  where id = v_cab;
  update public.mya_members set full_name = coalesce(nullif(full_name, ''), 'Myriam Ayouaz'), color = '#cc3a73' where user_id = v_me and cabinet_id = v_cab;

  v_tpl := 'LETTRE DE MISSION

Entre :
{cabinet}, {cabinet_adresse}, SIRET {cabinet_siret}, ci-après « le cabinet »,
et :
{client} ({forme}), SIREN {siren}, {adresse}, représenté(e) par {contact}, ci-après « le client ».

1. OBJET DE LA MISSION
Le client confie au cabinet la mission suivante : {mission}.
Activité du client : {activite}. Date de clôture de l''exercice : {cloture}.
La mission est réalisée conformément aux normes professionnelles de l''Ordre des experts-comptables.

2. DURÉE
La mission prend effet à la date de signature pour une durée d''un exercice comptable. Elle se renouvelle ensuite chaque année par tacite reconduction, sauf résiliation par l''une des parties par lettre recommandée au moins trois mois avant la date de clôture de l''exercice.

3. OBLIGATIONS DU CLIENT
Le client s''engage à transmettre au cabinet, dans les délais convenus, l''ensemble des pièces et informations nécessaires (relevés bancaires, factures d''achat et de vente, caisse, stocks, contrats, emprunts…) et à informer le cabinet de tout événement important concernant son activité. Tout retard dans la transmission des pièces peut entraîner un décalage des travaux dont le cabinet ne saurait être tenu responsable.

4. HONORAIRES
Les honoraires sont fixés à {honoraires} HT, facturés selon une périodicité {frequence}.
Les travaux exceptionnels ou non prévus à la présente lettre feront l''objet d''une facturation complémentaire, après accord du client.

5. MODALITÉS DE PAIEMENT
Les factures sont payables à {delai_paiement} jours à compter de leur date d''émission, par {paiement}.
Conformément à l''article L441-10 du Code de commerce, tout retard de paiement entraîne de plein droit l''application de pénalités de retard égales à trois fois le taux d''intérêt légal, ainsi qu''une indemnité forfaitaire pour frais de recouvrement de 40 €.

6. SUSPENSION DES TRAVAUX EN CAS D''IMPAYÉ
En cas de non-paiement d''une facture à son échéance, et après une relance restée sans effet pendant 15 jours, le cabinet se réserve le droit de suspendre l''exécution de sa mission jusqu''au complet règlement des sommes dues, sans que cette suspension puisse lui être reprochée ni engager sa responsabilité, notamment au regard des échéances déclaratives. Le client en est informé par écrit.

7. RESPONSABILITÉ
Le cabinet est tenu à une obligation de moyens. Sa responsabilité civile professionnelle est assurée conformément à la réglementation. Il ne peut être tenu responsable des conséquences d''informations inexactes ou incomplètes fournies par le client.

8. LUTTE CONTRE LE BLANCHIMENT
Conformément aux articles L561-1 et suivants du Code monétaire et financier, le cabinet procède à l''identification du client et de ses bénéficiaires effectifs. Le client s''engage à fournir les justificatifs demandés.

9. DONNÉES PERSONNELLES
Les données transmises sont traitées exclusivement pour l''exécution de la mission et conservées pendant la durée légale. Le client dispose d''un droit d''accès, de rectification et de suppression auprès du cabinet.

10. LITIGES
En cas de différend, les parties rechercheront une solution amiable, le cas échéant avec l''aide du Conseil régional de l''Ordre des experts-comptables, avant toute action judiciaire.

Fait à Marseille.
Le client déclare avoir pris connaissance de la présente lettre de mission et en accepter les termes.';
  create temp table if not exists demo_ids (k text primary key, id uuid) on commit drop;
  truncate demo_ids;

  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Boulangerie Durand', 'SARL', '812345671', 'Pierre Durand', 'contact@boulangerie-durand.fr', '0611223344', '14 rue de Rome, 13001 Marseille', 'Boulangerie-pâtisserie', 'IS', 'mensuel', '12-31', 'Tenue, bilan, liasse, TVA', 290, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'prelevement', v_me, 'actif', false, 'email', 'Client historique, très fiable. Prélèvement mensuel.', now() - interval '527 days')
  returning id into c; insert into demo_ids values ('durand', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'SAS Kalo Digital', 'SAS', '899112233', 'Inès Kalo', 'ines@kalo-digital.fr', '0622334455', '5 quai de la Joliette, 13002 Marseille', 'Agence web', 'IS', 'mensuel', '12-31', 'Tenue, bilan, paie (3 salariés)', 450, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'email', 'Souhaite un point trimestriel sur la trésorerie.', now() - interval '257 days')
  returning id into c; insert into demo_ids values ('kalo', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'entreprise_individuelle', 'Cabinet Kiné Prado', 'EI', '790556677', 'Julien Roux', 'j.roux.kine@exemple.fr', '0633445566', '210 avenue du Prado, 13008 Marseille', 'Masseur-kinésithérapeute', 'BNC', 'franchise', '12-31', 'Déclaration 2035, conseil', 150, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'email', null, now() - interval '212 days')
  returning id into c; insert into demo_ids values ('kine', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Agence Immobilière Azur', 'SARL', '834778899', 'Nadia Ferhat', 'direction@azur-immo.fr', '0644556677', '32 La Canebière, 13001 Marseille', 'Transaction et gestion locative', 'IS', 'trimestriel', '12-31', 'Tenue, bilan, TVA, juridique annuel', 390, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'email', null, now() - interval '579 days')
  returning id into c; insert into demo_ids values ('azur', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'particulier', 'Mme Sophie Martin', null, null, 'Sophie Martin', 'sophie.martin@exemple.fr', '0655667788', '8 rue Paradis, 13006 Marseille', 'Particulier (revenus fonciers)', 'IR', null, '12-31', 'Déclaration de revenus et 2044', 250, 'annuel', 'Forfait comptable annuel', (date_trunc('year', current_date) + interval '1 year')::date, 'virement', v_me, 'actif', false, 'email', null, now() - interval '340 days')
  returning id into c; insert into demo_ids values ('martin', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'entreprise_individuelle', 'Atelier Lina Couture', 'EI', '901223344', 'Lina Haddad', 'atelier.lina@exemple.fr', '0666778899', '3 rue Saint-Ferréol, 13001 Marseille', 'Retouches et création', 'micro-BIC', 'franchise', '12-31', 'Déclarations micro, conseil', 90, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'whatsapp', null, now() - interval '325 days')
  returning id into c; insert into demo_ids values ('lina', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'sci', 'SCI Les Calanques', 'SCI', '823445566', 'Marc Olivier', 'marc.olivier@exemple.fr', '0677889900', '12 bd Michelet, 13009 Marseille', 'Location nue', 'IR', null, '12-31', 'Comptabilité SCI, 2072', 600, 'annuel', 'Forfait comptable annuel', (date_trunc('year', current_date) + interval '1 year')::date, 'virement', v_me, 'actif', false, 'email', null, now() - interval '314 days')
  returning id into c; insert into demo_ids values ('calanques', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Fleurs de Provence', 'EURL', '845667788', 'Claire Aubert', 'claire@fleurs-provence.fr', '0688990011', '45 rue de la République, 13002 Marseille', 'Fleuriste', 'IR', 'trimestriel', '12-31', 'Tenue, bilan, TVA', 180, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'email', null, now() - interval '271 days')
  returning id into c; insert into demo_ids values ('fleurs', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'association', 'Association Sport & Quartier', 'Association loi 1901', '508990011', 'Karim Belkacem', 'tresorier@sportquartier.org', '0699001122', 'Gymnase de la Belle de Mai, 13003 Marseille', 'Association sportive', null, null, '08-31', 'Comptes annuels, AG', 600, 'annuel', 'Forfait comptable annuel', (date_trunc('year', current_date) + interval '1 year')::date, 'cheque', v_me, 'actif', false, 'email', null, now() - interval '577 days')
  returning id into c; insert into demo_ids values ('sport', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Restaurant Le Vieux-Port', 'SAS', '852334455', 'Antoine Rizzo', 'antoine@levieuxport-resto.fr', '0610203040', '2 quai du Port, 13002 Marseille', 'Restauration', 'IS', 'mensuel', '12-31', 'Tenue, paie (6 salariés), bilan', 420, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'email', null, now() - interval '252 days')
  returning id into c; insert into demo_ids values ('vieuxport', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Transports Rapides 13', 'SAS', '877665544', 'Yannick Moreau', 'compta@transports13.fr', '0620304050', 'ZI des Estroublans, 13127 Vitrolles', 'Transport de marchandises', 'IS', 'mensuel', '12-31', 'Tenue, bilan, paie, TVA', 520, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'sms', null, now() - interval '546 days')
  returning id into c; insert into demo_ids values ('transports', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Boutique Mode Joliette', 'SAS', '880112233', 'Sarah Benhamou', 'sarah@modejoliette.fr', '0630405060', 'Les Docks, 13002 Marseille', 'Prêt-à-porter', 'IS', 'trimestriel', '06-30', 'Tenue, bilan au 30/06, TVA', 260, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'email', null, now() - interval '579 days')
  returning id into c; insert into demo_ids values ('joliette', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'SARL Méditerranée Pneus', 'SARL', '819998877', 'Farid Mansouri', 'farid@medpneus.fr', '0640506070', '120 chemin du Littoral, 13016 Marseille', 'Négoce de pneumatiques', 'IS', 'trimestriel', '12-31', 'Tenue, bilan, TVA', 320, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'sms', null, now() - interval '656 days')
  returning id into c; insert into demo_ids values ('pneus', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Maçonnerie Benali & Fils', 'SARL', '828887766', 'Rachid Benali', 'benali.maconnerie@exemple.fr', '0650607080', '9 traverse des Pins, 13013 Marseille', 'Maçonnerie générale', 'IS', 'mensuel', '12-31', 'Tenue, bilan, paie (4 salariés)', 350, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'cheque', v_me, 'actif', true, 'whatsapp', 'Échéancier accordé en septembre : 3 versements. Relances automatiques en pause.', now() - interval '479 days')
  returning id into c; insert into demo_ids values ('benali', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Garage de l''Estaque', 'SARL', '815556644', 'Didier Fabre', 'garage.estaque@exemple.fr', '0660708090', '31 plage de l''Estaque, 13016 Marseille', 'Mécanique automobile', 'IS', 'mensuel', '12-31', 'Tenue, bilan, TVA', 380, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'sms', 'Toujours injoignable le lundi. Préfère les SMS. Menacer de suspendre les travaux si pas de règlement.', now() - interval '244 days')
  returning id into c; insert into demo_ids values ('estaque', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'entreprise_individuelle', 'Snack Chez Momo', 'EI', '910334455', 'Mohamed Saïdi', null, '0670809010', '77 rue d''Aubagne, 13001 Marseille', 'Restauration rapide', 'micro-BIC', 'franchise', '12-31', 'Déclarations micro, conseil', 80, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'especes', v_me, 'actif', false, 'sms', 'Pas d''email : relancer par SMS ou WhatsApp. Paie souvent en espèces au cabinet.', now() - interval '502 days')
  returning id into c; insert into demo_ids values ('momo', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'entreprise_individuelle', 'Plomberie Vidal', 'EI', '921445566', 'Thomas Vidal', 'plomberie.vidal@exemple.fr', '0680901020', '4 impasse des Lilas, 13012 Marseille', 'Plomberie-chauffage', 'IR BIC', 'trimestriel', '12-31', 'Tenue, 2031, TVA', 140, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'actif', false, 'email', null, now() - interval '416 days')
  returning id into c; insert into demo_ids values ('vidal', c.id);
  insert into public.mya_clients (cabinet_id, kind, name, legal_form, siren, contact_name, email, phone, address, activity, tax_regime, vat_regime, fiscal_year_end, mission, fee_amount, fee_frequency, fee_label, fee_next_date, payment_method, owner_member, status, reminders_paused, preferred_channel, notes, created_at)
  values (v_cab, 'societe', 'Café des Arts', 'SAS', null, 'Élodie Blanc', 'elodie@cafedesarts.fr', '0691020304', '10 place Jean-Jaurès, 13005 Marseille', 'Café-bar', 'IS', 'mensuel', '12-31', 'Reprise de dossier', 280, 'mensuel', 'Forfait comptable mensuel', date_trunc('month', current_date + 31)::date, 'virement', v_me, 'prospect', false, 'email', null, now() - interval '216 days')
  returning id into c; insert into demo_ids values ('arts', c.id);

  -- Factures d'honoraires (numérotées plus bas dans l'ordre chronologique)
  create temp table demo_inv on commit drop as
  select * from (values
    ('durand',-177,-147,290,0,-153,null,'Forfait comptable','prelevement'),
    ('durand',-147,-117,290,1,-117,null,'Forfait comptable','prelevement'),
    ('durand',-117,-87,290,1,-87,null,'Forfait comptable','prelevement'),
    ('durand',-87,-57,290,1,-58,null,'Forfait comptable','prelevement'),
    ('durand',-57,-27,290,1,-28,null,'Forfait comptable','prelevement'),
    ('durand',-27,3,290,1,null,null,'Forfait comptable','prelevement'),
    ('kalo',-177,-147,450,0,-153,null,'Forfait comptable','virement'),
    ('kalo',-147,-117,450,1,-118,null,'Forfait comptable','virement'),
    ('kalo',-117,-87,450,1,-87,null,'Forfait comptable','virement'),
    ('kalo',-87,-57,450,1,-57,null,'Forfait comptable','virement'),
    ('kalo',-57,-27,450,1,-28,null,'Forfait comptable','virement'),
    ('kalo',-27,3,450,1,null,null,'Forfait comptable','virement'),
    ('kine',-177,-147,150,0,-150,null,'Forfait comptable','virement'),
    ('kine',-147,-117,150,0,-123,null,'Forfait comptable','virement'),
    ('kine',-117,-87,150,1,-88,null,'Forfait comptable','virement'),
    ('kine',-87,-57,150,1,-58,null,'Forfait comptable','virement'),
    ('kine',-57,-27,150,1,-27,null,'Forfait comptable','virement'),
    ('kine',-27,3,150,1,null,null,'Forfait comptable','virement'),
    ('azur',-177,-147,390,0,-150,null,'Forfait comptable','virement'),
    ('azur',-147,-117,390,1,-117,null,'Forfait comptable','virement'),
    ('azur',-117,-87,390,0,-93,null,'Forfait comptable','virement'),
    ('azur',-87,-57,390,1,-58,null,'Forfait comptable','virement'),
    ('azur',-57,-27,390,1,-28,null,'Forfait comptable','virement'),
    ('azur',-27,3,390,1,null,null,'Forfait comptable','virement'),
    ('martin',-330,-300,250,1,-300,null,'Honoraires annuels','virement'),
    ('martin',-20,10,250,0,null,null,'Honoraires annuels','virement'),
    ('lina',-177,-147,90,2,-141,null,'Forfait comptable','virement'),
    ('lina',-147,-117,90,2,-112,null,'Forfait comptable','virement'),
    ('lina',-117,-87,90,2,-82,null,'Forfait comptable','virement'),
    ('lina',-87,-57,90,2,-54,null,'Forfait comptable','virement'),
    ('lina',-57,-27,90,2,-21,null,'Forfait comptable','virement'),
    ('lina',-27,3,90,1,null,null,'Forfait comptable','virement'),
    ('calanques',-330,-300,600,2,-295,null,'Honoraires annuels','virement'),
    ('calanques',-40,-10,600,2,null,null,'Honoraires annuels','virement'),
    ('fleurs',-177,-147,180,2,-140,null,'Forfait comptable','virement'),
    ('fleurs',-147,-117,180,2,-110,null,'Forfait comptable','virement'),
    ('fleurs',-117,-87,180,2,-84,null,'Forfait comptable','virement'),
    ('fleurs',-87,-57,180,2,-51,null,'Forfait comptable','virement'),
    ('fleurs',-57,-27,180,2,-20,null,'Forfait comptable','virement'),
    ('fleurs',-27,3,180,1,null,null,'Forfait comptable','virement'),
    ('sport',-330,-300,600,2,-297,null,'Honoraires annuels','cheque'),
    ('sport',-40,-10,600,2,null,null,'Honoraires annuels','cheque'),
    ('vieuxport',-177,-147,420,3,-130,null,'Forfait comptable','virement'),
    ('vieuxport',-147,-117,420,2,-108,null,'Forfait comptable','virement'),
    ('vieuxport',-117,-87,420,3,-75,null,'Forfait comptable','virement'),
    ('vieuxport',-87,-57,420,3,-47,null,'Forfait comptable','virement'),
    ('vieuxport',-57,-27,420,4,null,null,'Forfait comptable','virement'),
    ('vieuxport',-27,3,420,1,null,null,'Forfait comptable','virement'),
    ('transports',-177,-147,520,3,-136,null,'Forfait comptable','virement'),
    ('transports',-147,-117,520,3,-104,null,'Forfait comptable','virement'),
    ('transports',-117,-87,520,3,-75,null,'Forfait comptable','virement'),
    ('transports',-87,-57,520,3,-44,null,'Forfait comptable','virement'),
    ('transports',-57,-27,520,3,-11,null,'Forfait comptable','virement'),
    ('transports',-27,3,520,1,null,null,'Forfait comptable','virement'),
    ('joliette',-177,-147,260,3,-133,null,'Forfait comptable','virement'),
    ('joliette',-147,-117,260,3,-99,null,'Forfait comptable','virement'),
    ('joliette',-117,-87,260,3,-68,null,'Forfait comptable','virement'),
    ('joliette',-87,-57,260,3,-43,null,'Forfait comptable','virement'),
    ('joliette',-57,-27,260,4,null,null,'Forfait comptable','virement'),
    ('joliette',-27,3,260,1,null,null,'Forfait comptable','virement'),
    ('pneus',-177,-147,320,4,-121,null,'Forfait comptable','virement'),
    ('pneus',-147,-117,320,4,-88,null,'Forfait comptable','virement'),
    ('pneus',-117,-87,320,4,-62,null,'Forfait comptable','virement'),
    ('pneus',-87,-57,320,4,-22,null,'Forfait comptable','virement'),
    ('pneus',-57,-27,320,4,null,null,'Forfait comptable','virement'),
    ('pneus',-27,3,320,1,null,null,'Forfait comptable','virement'),
    ('benali',-177,-147,350,4,-105,null,'Forfait comptable','cheque'),
    ('benali',-147,-117,350,4,-92,null,'Forfait comptable','cheque'),
    ('benali',-117,-87,350,4,-51,null,'Forfait comptable','cheque'),
    ('benali',-87,-57,350,4,-21,null,'Forfait comptable','cheque'),
    ('benali',-57,-27,350,4,null,168.0,'Forfait comptable','cheque'),
    ('benali',-27,3,350,1,null,null,'Forfait comptable','cheque'),
    ('estaque',-177,-147,380,4,-96,null,'Forfait comptable','virement'),
    ('estaque',-147,-117,380,4,-62,null,'Forfait comptable','virement'),
    ('estaque',-117,-87,380,4,-10,null,'Forfait comptable','virement'),
    ('estaque',-87,-57,380,4,null,null,'Forfait comptable','virement'),
    ('estaque',-57,-27,380,4,null,null,'Forfait comptable','virement'),
    ('estaque',-27,3,380,1,null,null,'Forfait comptable','virement'),
    ('momo',-177,-147,80,4,-97,null,'Forfait comptable','especes'),
    ('momo',-147,-117,80,4,-54,null,'Forfait comptable','especes'),
    ('momo',-117,-87,80,4,-31,null,'Forfait comptable','especes'),
    ('momo',-87,-57,80,4,null,null,'Forfait comptable','especes'),
    ('momo',-57,-27,80,4,null,null,'Forfait comptable','especes'),
    ('momo',-27,3,80,1,null,null,'Forfait comptable','especes'),
    ('vidal',-12,18,140,0,null,null,'Forfait comptable','virement'),
    ('kalo',-75,-45,850,0,-47,null,'Prévisionnel et dossier bancaire','virement'),
    ('vieuxport',-50,-20,600,3,null,null,'Assistance contrôle URSSAF','virement'),
    ('azur',-25,5,480,0,null,null,'Approbation des comptes et formalités','virement')
  ) v(ck, iss, due, ht, lvl, paid, partial, label, method);
  alter table demo_inv add column inv_id uuid default gen_random_uuid();
  insert into public.mya_invoices (id, cabinet_id, client_id, issue_date, due_date, label, lines, vat_rate, amount_ht, amount_ttc, status, sent_at, reminder_level, last_reminder_at, reminders_paused, created_at)
  select v.inv_id, v_cab, d.id, current_date + v.iss, current_date + v.due, v.label,
         jsonb_build_array(jsonb_build_object('label', v.label, 'qty', 1, 'unit_price', v.ht)), 20, v.ht, round(v.ht * 1.2, 2), 'envoyee',
         (current_date + v.iss)::timestamptz + interval '9 hours', v.lvl,
         case when v.lvl > 0 then (current_date + least(v.due + (array[-3, 3, 10, 25])[v.lvl], 0))::timestamptz + interval '8 hours' end,
         (v.ck = 'benali' and v.paid is null), (current_date + v.iss)::timestamptz + interval '9 hours'
  from demo_inv v join demo_ids d on d.k = v.ck;
  insert into public.mya_payments (cabinet_id, invoice_id, amount, paid_on, method)
  select v_cab, v.inv_id, round(v.ht * 1.2, 2), current_date + v.paid, v.method from demo_inv v where v.paid is not null;
  insert into public.mya_payments (cabinet_id, invoice_id, amount, paid_on, method, note)
  select v_cab, v.inv_id, v.partial, current_date - 6, 'cheque', '1er versement de l''échéancier (3 fois)' from demo_inv v where v.partial is not null;
  insert into public.mya_invoices (cabinet_id, client_id, issue_date, due_date, label, lines, vat_rate, amount_ht, amount_ttc, status, is_recurring)
  values (v_cab, (select id from demo_ids where k = 'durand'), current_date, current_date + 30, 'Forfait comptable', '[{"label": "Forfait comptable mensuel", "qty": 1, "unit_price": 290}]'::jsonb, 20, 290, 348.0, 'brouillon', true);
  insert into public.mya_invoices (cabinet_id, client_id, issue_date, due_date, label, lines, vat_rate, amount_ht, amount_ttc, status, is_recurring)
  values (v_cab, (select id from demo_ids where k = 'kalo'), current_date, current_date + 30, 'Forfait comptable', '[{"label": "Forfait comptable mensuel", "qty": 1, "unit_price": 450}]'::jsonb, 20, 450, 540.0, 'brouillon', true);
  insert into public.mya_invoices (cabinet_id, client_id, issue_date, due_date, label, lines, vat_rate, amount_ht, amount_ttc, status, is_recurring)
  values (v_cab, (select id from demo_ids where k = 'fleurs'), current_date, current_date + 30, 'Forfait comptable', '[{"label": "Forfait comptable mensuel", "qty": 1, "unit_price": 180}]'::jsonb, 20, 180, 216.0, 'brouillon', true);

  -- Numérotation continue, dans l'ordre chronologique
  update public.mya_invoices i set number = 'F-' || to_char(x.issue_date, 'YYYY') || '-' || lpad(x.rn::text, 4, '0')
  from (select id, issue_date, row_number() over (partition by extract(year from issue_date) order by issue_date, created_at, id) rn
        from public.mya_invoices where cabinet_id = v_cab and status <> 'brouillon') x
  where i.id = x.id;
  select count(*) + 1 into n from public.mya_invoices where cabinet_id = v_cab and number like 'F-' || to_char(current_date, 'YYYY') || '-%';
  update public.mya_cabinets set next_invoice_number = n where id = v_cab;


  -- Journal : envoi des factures récentes
  insert into public.mya_reminders_log (cabinet_id, invoice_id, client_id, kind, channel, status, recipient, subject, message, error, automatic, created_at)
  select v_cab, i.id, i.client_id, 'envoi_facture', 'email', case when cl.email is null then 'echec' else 'envoye' end, cl.email,
         'Votre facture ' || i.number || ' — Cabinet Myriam Expertise',
         'Bonjour ' || coalesce(cl.contact_name, cl.name) || E',\n\nVeuillez trouver votre facture ' || i.number || ' d''un montant de ' || replace(to_char(i.amount_ttc, 'FM99990.00'), '.', ',') || E' €.\nConsulter et régler en ligne : lien sécurisé de la facture.\n\nCabinet Myriam Expertise',
         case when cl.email is null then 'Pas d''email pour ce client' end, false, i.sent_at + interval '12 minutes'
  from public.mya_invoices i join public.mya_clients cl on cl.id = i.client_id
  where i.cabinet_id = v_cab and i.status <> 'brouillon' and i.issue_date > current_date - 70;

  -- Journal : relances automatiques (texte réel des modèles du scénario)
  insert into public.mya_reminders_log (cabinet_id, invoice_id, client_id, kind, step, channel, status, recipient, subject, message, error, automatic, created_at)
  select v_cab, i.id, i.client_id, 'relance', r.step, ch,
         case when ch = 'email' and cl.email is null then 'echec' else 'envoye' end,
         case when ch = 'email' then cl.email else '33' || substr(regexp_replace(cl.phone, '\D', '', 'g'), 2) end,
         case when ch = 'email' then replace(replace(replace(r.subject, '{numero}', i.number), '{echeance}', to_char(i.due_date, 'DD/MM/YYYY')), '{jours_retard}', greatest(r.offset_days, 0)::text) end,
         case when ch = 'email' then
           replace(replace(replace(replace(replace(replace(replace(replace(replace(r.body, '{jours_retard}', greatest(r.offset_days, 0)::text),
             '{contact}', coalesce(cl.contact_name, cl.name)), '{numero}', i.number),
             '{reste}', replace(to_char(i.amount_ttc, 'FM99990.00'), '.', ',') || ' €'), '{echeance}', to_char(i.due_date, 'DD/MM/YYYY')),
             '{lien}', 'https://my-assistanad.vercel.app/f/…'), '{iban}', 'FR76 3000 4000 0500 0012 3456 789'),
             '{cabinet}', 'Cabinet Myriam Expertise'), '{tel_cabinet}', '04 91 00 00 00')
         else 'Cabinet ME - ' || case r.tone when 'mise_en_demeure' then 'DERNIER RAPPEL' when 'ferme' then 'Relance' else 'Rappel' end
              || ' : facture ' || i.number || ' (' || replace(to_char(i.amount_ttc, 'FM99990.00'), '.', ',') || ' €) échue le ' || to_char(i.due_date, 'DD/MM') || '. Règlement : lien de paiement. Tél 04 91 00 00 00' end,
         case when ch = 'email' and cl.email is null then 'Pas d''email pour ce client' end,
         true, (i.due_date + r.offset_days)::timestamptz + interval '6 hours' + (random() * 40) * interval '1 minute'
  from public.mya_invoices i
  join public.mya_clients cl on cl.id = i.client_id
  join public.mya_reminder_rules r on r.cabinet_id = i.cabinet_id and r.step <= i.reminder_level
  cross join lateral unnest(r.channels) ch
  where i.cabinet_id = v_cab and i.due_date + r.offset_days <= current_date;

  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, message, automatic, sent_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'momo'), 'relance', 'whatsapp', 'prepare', '33670809010', 'Bonjour Mohamed, petit rappel pour vos factures en attente. Vous pouvez passer au cabinet ou payer en ligne. Merci !', false, v_me, now() - interval '2 days 3 hours'),
         (v_cab, (select id from demo_ids where k = 'benali'), 'relance', 'whatsapp', 'prepare', '33650607080', 'Bonjour M. Benali, comme convenu : échéancier en 3 fois, 1er versement bien reçu. Merci !', false, v_me, now() - interval '6 days');

  -- Demandes entrantes
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'kalo'), null, 'telephone', 'Attestation de chiffre d’affaires pour la banque', 'Prêt pour du matériel informatique, besoin avant vendredi.', 'urgente', 'nouvelle', v_me, current_date + 1, now() + interval '-0.1 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'vieuxport'), null, 'whatsapp', 'Question sur la paie d’octobre (heures sup.)', 'Deux serveurs ont fait des heures supplémentaires le week-end.', 'haute', 'nouvelle', v_me, current_date + 2, now() + interval '-0.2 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, null, 'M. Olivier Garcia (boulangerie Endoume)', 'telephone', 'Demande de devis : reprise de dossier comptable', 'Actuellement chez un autre cabinet, mécontent des délais. Rappeler mardi matin.', 'haute', 'nouvelle', v_me, current_date + 3, now() + interval '-0.3 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'azur'), null, 'email', 'Envoi des relevés bancaires de septembre', 'Relevés reçus en pièce jointe, à intégrer.', 'normale', 'en_cours', v_me, current_date + 4, now() + interval '-1 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'transports'), null, 'email', 'Contrôle URSSAF : quels documents préparer ?', 'Avis de contrôle reçu pour le mois prochain.', 'urgente', 'en_cours', v_me, current_date + 2, now() + interval '-1.3 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'lina'), null, 'whatsapp', 'Dépasse-t-elle le plafond micro-entreprise ?', 'CA prévisionnel 2026 autour de 80 k€.', 'normale', 'nouvelle', v_me, current_date + 6, now() + interval '-1.5 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'fleurs'), null, 'visite', 'A déposé les factures d’achat du trimestre', 'Classeur rouge déposé à l’accueil.', 'basse', 'en_cours', v_me, current_date + 4, now() + interval '-2 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'estaque'), null, 'telephone', 'Conteste le montant de la dernière facture', 'Pense avoir déjà payé en juillet : vérifier le relevé.', 'haute', 'attente_client', v_me, current_date + 3, now() + interval '-3 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'martin'), null, 'email', 'Déduction des travaux de rénovation (revenus fonciers)', null, 'normale', 'attente_client', v_me, current_date + 10, now() + interval '-4 days', null, v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'joliette'), null, 'telephone', 'Préparer l’inventaire de clôture au 30/06', 'Stock à valoriser, rendez-vous à fixer.', 'normale', 'traitee', v_me, null, now() + interval '-8 days', now() + interval '-7 days', v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'durand'), null, 'email', 'Mise à jour du RIB pour le prélèvement', null, 'basse', 'traitee', v_me, null, now() + interval '-10 days', now() + interval '-9 days', v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'sport'), null, 'email', 'Convocation AG : besoin du rapport financier', null, 'normale', 'traitee', v_me, null, now() + interval '-12 days', now() + interval '-11 days', v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'benali'), null, 'telephone', 'Demande d’échéancier pour les honoraires', 'Accord pour 3 versements mensuels.', 'haute', 'traitee', v_me, null, now() + interval '-20 days', now() + interval '-19 days', v_me);
  insert into public.mya_requests (cabinet_id, client_id, contact_name, channel, subject, details, priority, status, assigned_to, due_date, received_at, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'kine'), null, 'sms', 'Achat d’une table de massage : amortissable ?', null, 'basse', 'nouvelle', v_me, current_date + 7, now() + interval '-0.6 days', null, v_me);

  -- Tâches
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'kalo'), 'Préparer l’attestation de CA pour la banque', 'admin', current_date + 0, 'urgente', 'a_faire', v_me, 'aucune', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'vieuxport'), 'Bulletins de paie d’octobre', 'social', current_date + 3, 'haute', 'a_faire', v_me, 'mensuelle', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'transports'), 'Bulletins de paie d’octobre', 'social', current_date + 3, 'haute', 'a_faire', v_me, 'mensuelle', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'transports'), 'Rassembler les pièces pour le contrôle URSSAF', 'social', current_date + 5, 'urgente', 'en_cours', v_me, 'aucune', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'azur'), 'Saisie des relevés bancaires de septembre', 'saisie', current_date + -1, 'normale', 'a_faire', v_me, 'mensuelle', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'fleurs'), 'Saisie des achats du 3e trimestre', 'saisie', current_date + 2, 'normale', 'en_cours', v_me, 'trimestrielle', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'estaque'), 'Appeler M. Fabre : 3 factures impayées', 'relance', current_date + 0, 'haute', 'a_faire', v_me, 'aucune', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'momo'), 'Relancer Snack Chez Momo — facture impayée (pas d’email)', 'relance', current_date + -1, 'haute', 'a_faire', v_me, 'aucune', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'lina'), 'Simulation passage au régime réel', 'fiscal', current_date + 6, 'normale', 'a_faire', v_me, 'aucune', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, null, 'Renouveler l’assurance RC professionnelle du cabinet', 'admin', current_date + 12, 'normale', 'a_faire', v_me, 'annuelle', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, null, 'Point d’équipe hebdomadaire', 'admin', current_date + 1, 'basse', 'a_faire', v_me, 'hebdo', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'joliette'), 'Valorisation du stock au 30/06', 'bilan', current_date + -2, 'haute', 'a_faire', v_me, 'aucune', null, v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'durand'), 'Révision des comptes — 1er semestre', 'bilan', current_date + -5, 'normale', 'fait', v_me, 'aucune', now() - interval '1 day', v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'kalo'), 'Paie de septembre', 'social', current_date + -4, 'haute', 'fait', v_me, 'aucune', now() - interval '1 day', v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'sport'), 'Rapport financier pour l’AG', 'juridique', current_date + -9, 'normale', 'fait', v_me, 'aucune', now() - interval '1 day', v_me);
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, recurrence, done_at, created_by) values (v_cab, (select id from demo_ids where k = 'martin'), 'Calcul du déficit foncier 2025', 'fiscal', current_date + 9, 'normale', 'a_faire', v_me, 'aucune', null, v_me);

  -- Échéances fiscales des 90 prochains jours (+ quelques-unes passées, faites)
  for c in select cl.id, cl.vat_regime, cl.tax_regime, cl.kind, cl.name from public.mya_clients cl where cl.cabinet_id = v_cab and cl.status = 'actif' loop
    if c.vat_regime = 'mensuel' then
      insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, fiscal_key)
      select v_cab, c.id, 'TVA ' || case when extract(month from m) in (4, 8, 10) then 'd’' else 'de ' end ||
               (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from m)::int] || ' ' || to_char(m, 'YYYY') || ' (CA3)',
             'tva', (m + interval '1 month' + interval '14 days')::date, 'haute',
             case when (m + interval '1 month' + interval '14 days')::date < current_date then 'fait' else 'a_faire' end, v_me,
             'tva-' || to_char(m, 'YYYY-MM')
      from generate_series(date_trunc('month', current_date) - interval '2 months', date_trunc('month', current_date) + interval '2 months', interval '1 month') m
      on conflict (client_id, fiscal_key) do nothing;
    elsif c.vat_regime = 'trimestriel' then
      insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, fiscal_key)
      select v_cab, c.id, 'TVA du ' || extract(quarter from qd) || case when extract(quarter from qd) = 1 then 'er' else 'e' end || ' trimestre ' || to_char(qd, 'YYYY') || ' (CA3)',
             'tva', (qd + interval '3 months' + interval '14 days')::date, 'haute',
             case when (qd + interval '3 months' + interval '14 days')::date < current_date then 'fait' else 'a_faire' end, v_me,
             'tva-' || to_char(qd, 'YYYY') || '-T' || extract(quarter from qd)
      from generate_series(date_trunc('quarter', current_date) - interval '3 months', date_trunc('quarter', current_date), interval '3 months') qd
      on conflict (client_id, fiscal_key) do nothing;
    end if;
    if c.kind <> 'particulier' and c.kind <> 'association' then
      insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, fiscal_key)
      values (v_cab, c.id, 'CFE ' || to_char(current_date, 'YYYY') || ' : vérifier l’avis et le paiement', 'fiscal', make_date(extract(year from current_date)::int, 12, 15), 'normale', 'a_faire', v_me, 'cfe-' || to_char(current_date, 'YYYY'))
      on conflict (client_id, fiscal_key) do nothing;
    end if;
    if upper(coalesce(c.tax_regime, '')) = 'IS' then
      insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, fiscal_key)
      select v_cab, c.id, 'Acompte d’IS n°' || ((extract(month from d)::int) / 3), 'fiscal', d, 'normale',
             case when d < current_date then 'fait' else 'a_faire' end, v_me, 'is-acompte-' || to_char(d, 'YYYY-MM')
      from (select make_date(extract(year from current_date)::int, mm, 15) d from unnest(array[9, 12]) mm) s
      on conflict (client_id, fiscal_key) do nothing;
    end if;
  end loop;
  -- Clôture au 30/06 : bilan et liasse à rendre
  insert into public.mya_tasks (cabinet_id, client_id, title, category, due_date, priority, status, assigned_to, fiscal_key)
  values (v_cab, (select id from demo_ids where k = 'joliette'), 'Bilan et liasse fiscale — exercice clos le 30 juin', 'bilan', current_date + 18, 'haute', 'en_cours', v_me, 'liasse-' || to_char(current_date, 'YYYY')),
         (v_cab, (select id from demo_ids where k = 'sport'), 'Comptes annuels de l’association (clôture 31/08)', 'bilan', current_date + 25, 'normale', 'a_faire', v_me, 'liasse-' || to_char(current_date, 'YYYY'))
  on conflict (client_id, fiscal_key) do nothing;

  -- Rendez-vous
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'durand'), 'Remise des pièces du 3e trimestre', ((current_date + 0) + time '09:30') at time zone 'Europe/Paris', (((current_date + 0) + time '09:30') at time zone 'Europe/Paris') + interval '45 minutes', 'cabinet', null, v_me, true, (((current_date + 0) + time '09:30') at time zone 'Europe/Paris') - interval '1 day', 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'kalo'), 'Point trésorerie et prêt bancaire', ((current_date + 0) + time '14:00') at time zone 'Europe/Paris', (((current_date + 0) + time '14:00') at time zone 'Europe/Paris') + interval '60 minutes', 'visio', 'https://meet.exemple.fr/cabinet-me', v_me, true, (((current_date + 0) + time '14:00') at time zone 'Europe/Paris') - interval '1 day', 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'estaque'), 'Rendez-vous impayés + situation comptable', ((current_date + 1) + time '10:00') at time zone 'Europe/Paris', (((current_date + 1) + time '10:00') at time zone 'Europe/Paris') + interval '30 minutes', 'cabinet', null, v_me, true, (((current_date + 1) + time '10:00') at time zone 'Europe/Paris') - interval '1 day', 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, null, 'Découverte : reprise de dossier boulangerie Endoume', ((current_date + 1) + time '16:30') at time zone 'Europe/Paris', (((current_date + 1) + time '16:30') at time zone 'Europe/Paris') + interval '45 minutes', 'telephone', null, v_me, false, null, 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'transports'), 'Préparation du contrôle URSSAF', ((current_date + 2) + time '09:00') at time zone 'Europe/Paris', (((current_date + 2) + time '09:00') at time zone 'Europe/Paris') + interval '90 minutes', 'chez_client', 'ZI des Estroublans, 13127 Vitrolles', v_me, true, null, 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'joliette'), 'Inventaire et arrêté des comptes', ((current_date + 3) + time '11:00') at time zone 'Europe/Paris', (((current_date + 3) + time '11:00') at time zone 'Europe/Paris') + interval '120 minutes', 'chez_client', 'Les Docks, 13002 Marseille', v_me, true, null, 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'lina'), 'Conseil : micro ou régime réel ?', ((current_date + 4) + time '15:00') at time zone 'Europe/Paris', (((current_date + 4) + time '15:00') at time zone 'Europe/Paris') + interval '45 minutes', 'cabinet', null, v_me, true, null, 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'arts'), 'Présentation de l’offre au Café des Arts', ((current_date + 7) + time '10:30') at time zone 'Europe/Paris', (((current_date + 7) + time '10:30') at time zone 'Europe/Paris') + interval '60 minutes', 'chez_client', '10 place Jean-Jaurès, 13005 Marseille', v_me, true, null, 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'azur'), 'Préparation de l’AG', ((current_date + 8) + time '14:30') at time zone 'Europe/Paris', (((current_date + 8) + time '14:30') at time zone 'Europe/Paris') + interval '60 minutes', 'cabinet', null, v_me, true, null, 'prevu');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'vieuxport'), 'Point paie et heures supplémentaires', ((current_date + -1) + time '11:00') at time zone 'Europe/Paris', (((current_date + -1) + time '11:00') at time zone 'Europe/Paris') + interval '30 minutes', 'telephone', null, v_me, true, (((current_date + -1) + time '11:00') at time zone 'Europe/Paris') - interval '1 day', 'fait');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'fleurs'), 'Remise des factures du trimestre', ((current_date + -2) + time '17:00') at time zone 'Europe/Paris', (((current_date + -2) + time '17:00') at time zone 'Europe/Paris') + interval '30 minutes', 'cabinet', null, v_me, true, (((current_date + -2) + time '17:00') at time zone 'Europe/Paris') - interval '1 day', 'fait');
  insert into public.mya_appointments (cabinet_id, client_id, title, starts_at, ends_at, kind, location, member_id, remind_client, reminded_at, status) values (v_cab, (select id from demo_ids where k = 'momo'), 'Rendez-vous déclarations', ((current_date + -3) + time '10:00') at time zone 'Europe/Paris', (((current_date + -3) + time '10:00') at time zone 'Europe/Paris') + interval '30 minutes', 'cabinet', null, v_me, true, (((current_date + -3) + time '10:00') at time zone 'Europe/Paris') - interval '1 day', 'absent');
  insert into public.mya_reminders_log (cabinet_id, client_id, appointment_id, kind, channel, status, recipient, message, automatic, created_at)
  select a.cabinet_id, a.client_id, a.id, 'rappel_rdv', 'sms', 'envoye', '336' || right(cl.phone, 8), 'Cabinet ME : rappel de votre RDV demain ' || to_char(a.starts_at at time zone 'Europe/Paris', 'HH24:MI') || '. Empêchement ? 04 91 00 00 00', true, a.reminded_at
  from public.mya_appointments a join public.mya_clients cl on cl.id = a.client_id
  where a.cabinet_id = v_cab and a.reminded_at is not null;

  -- Lettres de mission
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'durand'), 'Lettre de mission ' || to_char(current_date + -220, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Boulangerie Durand'), '{forme}', 'SARL'), '{siren}', '812345671'), '{adresse}', '14 rue de Rome, 13001 Marseille'), '{contact}', 'Pierre Durand'), '{activite}', 'Boulangerie-pâtisserie'), '{mission}', 'Tenue, bilan, liasse, TVA'), '{honoraires}', '290,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'prélèvement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -221)::timestamptz + interval '10 hours', (current_date + -220)::timestamptz + interval '18 hours 42 minutes',
    'Pierre Durand', '92.184.85.57', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 60 L15 63 L20 58 L25 49 L30 41 L35 37 L40 38 L45 43 L50 45 L55 44 L60 39 L65 34 L70 34 L75 40 L80 50 L85 59 L90 63 L95 59 L100 50 L105 41 L110 36 L115 36 L120 40 L125 44 L130 45 L135 41 L140 37 L145 36 L150 40 L155 49 L160 59 L165 63 L170 60 L175 51 L180 41 L185 35 L190 34 L195 38 L200 43 L205 45 L210 43 L215 39 L220 37 L225 40 L230 48 L235 57 L240 62 L245 61 L250 52 L255 42 L260 34 L265 32 L270 36 L275 42 L280 46 L285 45 L290 41 L295 39 L300 41 L305 47 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -222)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'durand'), 'lettre_mission', 'email', 'envoye', 'contact@boulangerie-durand.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -221)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'kalo'), 'Lettre de mission ' || to_char(current_date + -180, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'SAS Kalo Digital'), '{forme}', 'SAS'), '{siren}', '899112233'), '{adresse}', '5 quai de la Joliette, 13002 Marseille'), '{contact}', 'Inès Kalo'), '{activite}', 'Agence web'), '{mission}', 'Tenue, bilan, paie (3 salariés)'), '{honoraires}', '450,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -181)::timestamptz + interval '10 hours', (current_date + -180)::timestamptz + interval '18 hours 42 minutes',
    'Inès Kalo', '92.184.24.150', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 61 L15 54 L20 43 L25 35 L30 33 L35 36 L40 42 L45 45 L50 45 L55 41 L60 38 L65 39 L70 46 L75 55 L80 61 L85 62 L90 55 L95 44 L100 35 L105 31 L110 34 L115 40 L120 45 L125 46 L130 43 L135 40 L140 40 L145 45 L150 53 L155 60 L160 61 L165 55 L170 45 L175 35 L180 30 L185 32 L190 39 L195 45 L200 48 L205 46 L210 42 L215 41 L220 45 L225 52 L230 59 L235 61 L240 56 L245 46 L250 35 L255 29 L260 30 L265 37 L270 44 L275 49 L280 48 L285 45 L290 43 L295 44 L300 50 L305 57 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -182)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'kalo'), 'lettre_mission', 'email', 'envoye', 'ines@kalo-digital.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -181)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'kine'), 'Lettre de mission ' || to_char(current_date + -300, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Cabinet Kiné Prado'), '{forme}', 'EI'), '{siren}', '790556677'), '{adresse}', '210 avenue du Prado, 13008 Marseille'), '{contact}', 'Julien Roux'), '{activite}', 'Masseur-kinésithérapeute'), '{mission}', 'Déclaration 2035, conseil'), '{honoraires}', '150,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -301)::timestamptz + interval '10 hours', (current_date + -300)::timestamptz + interval '18 hours 42 minutes',
    'Julien Roux', '92.184.198.140', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 48 L15 37 L20 30 L25 30 L30 36 L35 43 L40 48 L45 48 L50 44 L55 42 L60 44 L65 50 L70 57 L75 60 L80 57 L85 48 L90 37 L95 30 L100 29 L105 34 L110 43 L115 49 L120 50 L125 47 L130 44 L135 44 L140 48 L145 55 L150 59 L155 57 L160 49 L165 38 L170 30 L175 28 L180 33 L185 42 L190 49 L195 52 L200 50 L205 46 L210 44 L215 47 L220 53 L225 57 L230 57 L235 50 L240 39 L245 30 L250 27 L255 32 L260 40 L265 49 L270 53 L275 52 L280 48 L285 45 L290 46 L295 51 L300 55 L305 56 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -302)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'kine'), 'lettre_mission', 'email', 'envoye', 'j.roux.kine@exemple.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -301)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'azur'), 'Lettre de mission ' || to_char(current_date + -150, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Agence Immobilière Azur'), '{forme}', 'SARL'), '{siren}', '834778899'), '{adresse}', '32 La Canebière, 13001 Marseille'), '{contact}', 'Nadia Ferhat'), '{activite}', 'Transaction et gestion locative'), '{mission}', 'Tenue, bilan, TVA, juridique annuel'), '{honoraires}', '390,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -151)::timestamptz + interval '10 hours', (current_date + -150)::timestamptz + interval '18 hours 42 minutes',
    'Nadia Ferhat', '92.184.25.193', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 60 L15 63 L20 58 L25 49 L30 41 L35 37 L40 38 L45 43 L50 45 L55 44 L60 39 L65 34 L70 34 L75 40 L80 50 L85 59 L90 63 L95 59 L100 50 L105 41 L110 36 L115 36 L120 40 L125 44 L130 45 L135 41 L140 37 L145 36 L150 40 L155 49 L160 59 L165 63 L170 60 L175 51 L180 41 L185 35 L190 34 L195 38 L200 43 L205 45 L210 43 L215 39 L220 37 L225 40 L230 48 L235 57 L240 62 L245 61 L250 52 L255 42 L260 34 L265 32 L270 36 L275 42 L280 46 L285 45 L290 41 L295 39 L300 41 L305 47 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -152)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'azur'), 'lettre_mission', 'email', 'envoye', 'direction@azur-immo.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -151)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'martin'), 'Lettre de mission ' || to_char(current_date + -90, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Mme Sophie Martin'), '{forme}', 'Particulier'), '{siren}', '—'), '{adresse}', '8 rue Paradis, 13006 Marseille'), '{contact}', 'Sophie Martin'), '{activite}', 'Particulier (revenus fonciers)'), '{mission}', 'Déclaration de revenus et 2044'), '{honoraires}', '250,00 €'), '{frequence}', 'annuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -91)::timestamptz + interval '10 hours', (current_date + -90)::timestamptz + interval '18 hours 42 minutes',
    'Sophie Martin', '92.184.90.16', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 61 L15 54 L20 43 L25 35 L30 33 L35 36 L40 42 L45 45 L50 45 L55 41 L60 38 L65 39 L70 46 L75 55 L80 61 L85 62 L90 55 L95 44 L100 35 L105 31 L110 34 L115 40 L120 45 L125 46 L130 43 L135 40 L140 40 L145 45 L150 53 L155 60 L160 61 L165 55 L170 45 L175 35 L180 30 L185 32 L190 39 L195 45 L200 48 L205 46 L210 42 L215 41 L220 45 L225 52 L230 59 L235 61 L240 56 L245 46 L250 35 L255 29 L260 30 L265 37 L270 44 L275 49 L280 48 L285 45 L290 43 L295 44 L300 50 L305 57 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -92)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'martin'), 'lettre_mission', 'email', 'envoye', 'sophie.martin@exemple.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -91)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'calanques'), 'Lettre de mission ' || to_char(current_date + -400, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'SCI Les Calanques'), '{forme}', 'SCI'), '{siren}', '823445566'), '{adresse}', '12 bd Michelet, 13009 Marseille'), '{contact}', 'Marc Olivier'), '{activite}', 'Location nue'), '{mission}', 'Comptabilité SCI, 2072'), '{honoraires}', '600,00 €'), '{frequence}', 'annuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -401)::timestamptz + interval '10 hours', (current_date + -400)::timestamptz + interval '18 hours 42 minutes',
    'Marc Olivier', '92.184.22.151', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 48 L15 37 L20 30 L25 30 L30 36 L35 43 L40 48 L45 48 L50 44 L55 42 L60 44 L65 50 L70 57 L75 60 L80 57 L85 48 L90 37 L95 30 L100 29 L105 34 L110 43 L115 49 L120 50 L125 47 L130 44 L135 44 L140 48 L145 55 L150 59 L155 57 L160 49 L165 38 L170 30 L175 28 L180 33 L185 42 L190 49 L195 52 L200 50 L205 46 L210 44 L215 47 L220 53 L225 57 L230 57 L235 50 L240 39 L245 30 L250 27 L255 32 L260 40 L265 49 L270 53 L275 52 L280 48 L285 45 L290 46 L295 51 L300 55 L305 56 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -402)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'calanques'), 'lettre_mission', 'email', 'envoye', 'marc.olivier@exemple.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -401)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'vieuxport'), 'Lettre de mission ' || to_char(current_date + -260, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Restaurant Le Vieux-Port'), '{forme}', 'SAS'), '{siren}', '852334455'), '{adresse}', '2 quai du Port, 13002 Marseille'), '{contact}', 'Antoine Rizzo'), '{activite}', 'Restauration'), '{mission}', 'Tenue, paie (6 salariés), bilan'), '{honoraires}', '420,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -261)::timestamptz + interval '10 hours', (current_date + -260)::timestamptz + interval '18 hours 42 minutes',
    'Antoine Rizzo', '92.184.132.130', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 60 L15 63 L20 58 L25 49 L30 41 L35 37 L40 38 L45 43 L50 45 L55 44 L60 39 L65 34 L70 34 L75 40 L80 50 L85 59 L90 63 L95 59 L100 50 L105 41 L110 36 L115 36 L120 40 L125 44 L130 45 L135 41 L140 37 L145 36 L150 40 L155 49 L160 59 L165 63 L170 60 L175 51 L180 41 L185 35 L190 34 L195 38 L200 43 L205 45 L210 43 L215 39 L220 37 L225 40 L230 48 L235 57 L240 62 L245 61 L250 52 L255 42 L260 34 L265 32 L270 36 L275 42 L280 46 L285 45 L290 41 L295 39 L300 41 L305 47 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -262)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'vieuxport'), 'lettre_mission', 'email', 'envoye', 'antoine@levieuxport-resto.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -261)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'transports'), 'Lettre de mission ' || to_char(current_date + -210, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Transports Rapides 13'), '{forme}', 'SAS'), '{siren}', '877665544'), '{adresse}', 'ZI des Estroublans, 13127 Vitrolles'), '{contact}', 'Yannick Moreau'), '{activite}', 'Transport de marchandises'), '{mission}', 'Tenue, bilan, paie, TVA'), '{honoraires}', '520,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -211)::timestamptz + interval '10 hours', (current_date + -210)::timestamptz + interval '18 hours 42 minutes',
    'Yannick Moreau', '92.184.245.220', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 61 L15 54 L20 43 L25 35 L30 33 L35 36 L40 42 L45 45 L50 45 L55 41 L60 38 L65 39 L70 46 L75 55 L80 61 L85 62 L90 55 L95 44 L100 35 L105 31 L110 34 L115 40 L120 45 L125 46 L130 43 L135 40 L140 40 L145 45 L150 53 L155 60 L160 61 L165 55 L170 45 L175 35 L180 30 L185 32 L190 39 L195 45 L200 48 L205 46 L210 42 L215 41 L220 45 L225 52 L230 59 L235 61 L240 56 L245 46 L250 35 L255 29 L260 30 L265 37 L270 44 L275 49 L280 48 L285 45 L290 43 L295 44 L300 50 L305 57 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -212)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'transports'), 'lettre_mission', 'email', 'envoye', 'compta@transports13.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -211)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'joliette'), 'Lettre de mission ' || to_char(current_date + -120, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Boutique Mode Joliette'), '{forme}', 'SAS'), '{siren}', '880112233'), '{adresse}', 'Les Docks, 13002 Marseille'), '{contact}', 'Sarah Benhamou'), '{activite}', 'Prêt-à-porter'), '{mission}', 'Tenue, bilan au 30/06, TVA'), '{honoraires}', '260,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '30/06'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -121)::timestamptz + interval '10 hours', (current_date + -120)::timestamptz + interval '18 hours 42 minutes',
    'Sarah Benhamou', '92.184.145.42', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    'data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 320 90''><path d=''M10 48 L15 37 L20 30 L25 30 L30 36 L35 43 L40 48 L45 48 L50 44 L55 42 L60 44 L65 50 L70 57 L75 60 L80 57 L85 48 L90 37 L95 30 L100 29 L105 34 L110 43 L115 49 L120 50 L125 47 L130 44 L135 44 L140 48 L145 55 L150 59 L155 57 L160 49 L165 38 L170 30 L175 28 L180 33 L185 42 L190 49 L195 52 L200 50 L205 46 L210 44 L215 47 L220 53 L225 57 L230 57 L235 50 L240 39 L245 30 L250 27 L255 32 L260 40 L265 49 L270 53 L275 52 L280 48 L285 45 L290 46 L295 51 L300 55 L305 56 M30 75 L290 68'' fill=''none'' stroke=''%232b1b28'' stroke-width=''3'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>', null, v_me, (current_date + -122)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'joliette'), 'lettre_mission', 'email', 'envoye', 'sarah@modejoliette.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -121)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'fleurs'), 'Lettre de mission ' || to_char(current_date + -4, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Fleurs de Provence'), '{forme}', 'EURL'), '{siren}', '845667788'), '{adresse}', '45 rue de la République, 13002 Marseille'), '{contact}', 'Claire Aubert'), '{activite}', 'Fleuriste'), '{mission}', 'Tenue, bilan, TVA'), '{honoraires}', '180,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -5)::timestamptz + interval '10 hours', null,
    null, null, null,
    null, null, v_me, (current_date + -6)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'fleurs'), 'lettre_mission', 'email', 'envoye', 'claire@fleurs-provence.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -5)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'pneus'), 'Lettre de mission ' || to_char(current_date + -12, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'SARL Méditerranée Pneus'), '{forme}', 'SARL'), '{siren}', '819998877'), '{adresse}', '120 chemin du Littoral, 13016 Marseille'), '{contact}', 'Farid Mansouri'), '{activite}', 'Négoce de pneumatiques'), '{mission}', 'Tenue, bilan, TVA'), '{honoraires}', '320,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -13)::timestamptz + interval '10 hours', null,
    null, null, null,
    null, null, v_me, (current_date + -14)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'pneus'), 'lettre_mission', 'email', 'envoye', 'farid@medpneus.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -13)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'vidal'), 'Lettre de mission ' || to_char(current_date + -2, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Plomberie Vidal'), '{forme}', 'EI'), '{siren}', '921445566'), '{adresse}', '4 impasse des Lilas, 13012 Marseille'), '{contact}', 'Thomas Vidal'), '{activite}', 'Plomberie-chauffage'), '{mission}', 'Tenue, 2031, TVA'), '{honoraires}', '140,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'envoyee', (current_date + -3)::timestamptz + interval '10 hours', null,
    null, null, null,
    null, null, v_me, (current_date + -4)::timestamptz);
  insert into public.mya_reminders_log (cabinet_id, client_id, kind, channel, status, recipient, subject, message, automatic, sent_by, created_at) values (v_cab, (select id from demo_ids where k = 'vidal'), 'lettre_mission', 'email', 'envoye', 'plomberie.vidal@exemple.fr', 'Lettre de mission à signer', 'Voici votre lettre de mission à lire et signer en 1 minute.', false, v_me, (current_date + -3)::timestamptz + interval '10 hours');
  insert into public.mya_engagements (cabinet_id, client_id, title, content, status, sent_at, signed_at, signer_name, signer_ip, signer_ua, signature, content_hash, created_by, created_at)
  values (v_cab, (select id from demo_ids where k = 'lina'), 'Lettre de mission ' || to_char(current_date + 0, 'YYYY'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v_tpl, '{client}', 'Atelier Lina Couture'), '{forme}', 'EI'), '{siren}', '901223344'), '{adresse}', '3 rue Saint-Ferréol, 13001 Marseille'), '{contact}', 'Lina Haddad'), '{activite}', 'Retouches et création'), '{mission}', 'Déclarations micro, conseil'), '{honoraires}', '90,00 €'), '{frequence}', 'mensuelle'), '{cloture}', '31/12'), '{paiement}', 'virement'), '{delai_paiement}', '30'), '{cabinet}', 'ME Expertise Comptable SARL'), '{cabinet_adresse}', '18 rue Grignan, 13001 Marseille'), '{cabinet_siret}', '901 234 567 00018'), 'brouillon', null, null,
    null, null, null,
    null, null, v_me, (current_date + -2)::timestamptz);

  update public.mya_engagements set content_hash = encode(sha256(convert_to(content, 'UTF8')), 'hex') where cabinet_id = v_cab and signed_at is not null;
  update public.mya_engagements set status = 'signee' where cabinet_id = v_cab and signed_at is not null;
  raise notice 'Démo prête : % clients, % factures, % tâches, % demandes, % rendez-vous',
    (select count(*) from public.mya_clients where cabinet_id = v_cab),
    (select count(*) from public.mya_invoices where cabinet_id = v_cab),
    (select count(*) from public.mya_tasks where cabinet_id = v_cab),
    (select count(*) from public.mya_requests where cabinet_id = v_cab),
    (select count(*) from public.mya_appointments where cabinet_id = v_cab);
end $$;
