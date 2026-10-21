# Revue d'architecture avant le gel du schéma (DES-4)

> 19/10/2026 · agent `architect` · lecture seule, sur `main` : PRD v1.1, TRD v0.4, BACKEND_SCHEMA v0.4, APP_FLOW v0.4, 50 stories, `notifications.json`.

**Verdict : le schéma ne peut pas encore être figé.** 37 constats : 5 bloquants, 15 importants, 17 mineurs. La couverture des noms est bonne. Les 25 commandes, les 17 Edge Functions et les 9 RPC servent tous à au moins une story ou un écran, et les codes et clés cités par les stories existent. Les problèmes portent sur les règles, les droits et les tâches planifiées.

Étiquettes : **[A]** = alignement entre documents, sans décision ; **[D]** = vraie décision, avec qui tranche.

## Bloquants

| #   | Où                                                                       | Problème                                                                                                                                                                                                                                                                                                                                                                                                    | Correction proposée                                                                                                                                                                                                                                                      | Décide       |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 1   | BACKEND_SCHEMA §5 `ticket_contacts` ; ADR-011, K14                       | L'index unique sur `phone_hash` (contacts actifs) interdit le signalement autorisé par K14 quand le numéro a déjà un rendez-vous saisi. Rien ne dit qu'un ticket `join_queue` a une ligne de contact, donc « un ticket actif par numéro » ne couvre pas un walk-in au même numéro, et la fusion ne peut pas reconnaître le numéro.                                                                          | Une ligne `ticket_contacts` (au moins l'empreinte) pour tout ticket dont le numéro est connu ; index partiel qui exclut `pending_confirmation` ; la fusion clôt le contact du ticket annulé.                                                                             | D Koni       |
| 2   | BACKEND_SCHEMA §4.13 à §4.16 ; `account-delete` (K17)                    | `tickets.client_id`, `notifications.recipient_profile_id` et `actor_profile_id` des journaux pointent vers `profiles` sans règle de suppression. Une mise à `null` dans les journaux est refusée par `prevent_update_delete()`, donc la suppression du compte échoue.                                                                                                                                       | `on delete set null` sur `tickets` et `notifications` ; `actor_profile_id` en uuid sans clé étrangère dans les journaux ; préciser la valeur d'anonymisation de `display_name`.                                                                                          | D Koni       |
| 3   | BACKEND_SCHEMA §4.1, §12 étape 3                                         | `profiles.first_name` est non nul, mais le profil est créé à l'inscription Auth, avant la saisie du prénom (F-C3 étape 4). Même cas pour les gérants et les coiffeurs.                                                                                                                                                                                                                                      | Prénom facultatif jusqu'à la complétion, ou profil créé par `join_queue`, `salon-signup` et `activate-invitation` ; `is_guest = false` pour le personnel.                                                                                                                | A Koni       |
| 4   | PRD §5.2 (transitions 2, 3, E6) ; BACKEND_SCHEMA §4.13, §4.16 ; skill §2 | Les clés `your_turn:<n>` et `arrival_reminder:<n>` supposent un numéro d'appel qu'aucune colonne ne porte. On ne remet pas à zéro `reminder_sent_at` ni `release_due_at` au retour en attente. Le client appelé « repris en tête » (E6) n'a ni transition ni marqueur de priorité.                                                                                                                          | Colonne `call_count`, remise à zéro des colonnes d'appel en quittant `called`, marqueur de priorité en tête ; transition « Appelé → En attente (coiffeur indisponible) » ajoutée au PRD.                                                                                 | D Koni + Ely |
| 5   | BACKEND_SCHEMA §6, §7.2                                                  | Plusieurs restrictions par colonne ne peuvent pas venir du RLS seul, puisque clients et personnel partagent le rôle `authenticated` : jetons cachés au personnel, collègues limités au prénom, à la photo et au rôle, vérification SIRET brute cachée au gérant, gérant limité aux champs de configuration. De plus, `search_salons` en `security invoker` sur `public_salons` ne renverrait rien à `anon`. | `tickets` lus par RPC seulement pour le personnel ; `revoke select` des colonnes de jetons ; droits par colonne pour les écritures, avec un déclencheur pour la fiche du coiffeur ; vues publiques exécutées avec les droits du propriétaire, sur des colonnes limitées. | D Koni       |

## Importants

| #   | Problème                                                                                                                                                                                                              | Correction proposée                                                                                                                         | Décide           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 6   | `queue-tick` n'a pas l'expiration à 10 min de `stylist_change_pending_since` (transition 8, E7), ni l'annulation en fin de journée de service (E5, invariant 9)                                                       | Ajouter les deux tâches ; l'heure de la seconde dépend d'E24                                                                                | A Koni           |
| 7   | Le push au personnel `appointment_checked_in` (K21) heurte `unique (ticket_id, channel, dedupe_key)` avec deux destinataires, et serait bloqué par la règle de consentement                                           | Consentement et plafond SMS pour les clients seulement ; clé `appointment_checked_in:<member_id>` ; préciser le cas des e-mails sans ticket | A Koni           |
| 8   | `push_subscriptions` « L/É les siennes » (§7.2) permettrait de s'abonner aux push d'un membre                                                                                                                         | Écriture par le serveur seulement (`push-subscribe`)                                                                                        | D Koni           |
| 9   | L'interrupteur « Me prévenir » de `/account` (U-13, F-C11) n'a pas de commande                                                                                                                                        | `set_notifications_consent` (client ou porteur du jeton)                                                                                    | D Koni           |
| 10  | Rien ne publie le salon (S-07, F-M3) ni n'écrit `setup_test_passed_at`                                                                                                                                                | Edge Function ou commande `publish_salon` ; le test réussi est écrit par `complete_service` sur un ticket `is_test`                         | D Koni           |
| 11  | « File complète » n'est pas stockée mais est affichée : l'interface devrait recalculer une règle de file (contraire au TRD §1)                                                                                        | `salons.is_full` calculé par le moteur et exposé dans `public_salons`                                                                       | D Koni           |
| 12  | `send-notifications` tourne en parallèle (cron et après chaque commande) : double envoi et plafond SMS dépassé possibles                                                                                              | Réservation `for update skip locked` ; plafond vérifié sous verrou par ticket                                                               | D Koni           |
| 13  | E-mails sans `ticket_id` non dédupliqués ; récapitulatif déclenché « à la fermeture » (TRD) ou « toutes les 15 min » (schéma)                                                                                         | Index unique `(salon_id, channel, dedupe_key)` sans ticket, clé `daily_summary:<date>` ; aligner le déclenchement                           | A Koni           |
| 14  | `queue-tick`, `deactivate-member` et `account-delete` écrivent la file hors `queue-command` (ADR-003)                                                                                                                 | Un même mécanisme commun verrou + moteur, inscrit dans ADR-003 et le skill                                                                  | A Koni           |
| 15  | `assigned_member_id` : rempli à la création pour un coiffeur demandé (schéma), mais fixé à l'appel (ADR-015, transition 2) ; aucune colonne pour une réaffectation acceptée                                           | Fixer le sens de la colonne ; réaffectation sur `requested_member_id` ou une colonne dédiée (E27 pour les rendez-vous)                      | D Koni           |
| 16  | Données jamais purgées : `notifications.params` (prénom, code), `last_error`, abonnements push liés à un ticket clos, `processed_commands.response`                                                                   | Purge à 30 jours ou anonymisation, dans `daily-maintenance` ; avis RGPD                                                                     | D Koni           |
| 17  | Ouverture et fermeture automatiques de la file selon les horaires (schéma §10), alors que le PRD et APP_FLOW ne prévoient que le gérant ; même question pour la fin de pause, `shift_end_at` et le coiffeur en retard | Règle à trancher (nouvelle question E32), puis colonne qui empêche de rouvrir une file fermée à la main                                     | D Ely, puis Koni |
| 18  | E2 : le PRD §11 dit « compteur de 10 min à partir de l'heure annoncée », les autres sections et documents disent « libéré à l'heure annoncée » ; heure du rappel non fixée en cas de retard                           | Aligner le §11 sur « libéré à l'heure annoncée » ; rappel 5 min avant `release_due_at` (E33)                                                | A + D Ely        |
| 19  | `get_stylist_queue` ne renvoie pas les rendez-vous du jour (F-S10, C-11) ; contenu de « Ensuite » flou                                                                                                                | Ajouter les rendez-vous du jour ; « Ensuite » = tickets pressentis pour ce coiffeur                                                         | A Koni           |
| 20  | 389 questions encore ouvertes dans les stories, dont beaucoup réglées par K13-K27 ; d'autres nouvelles, sans numéro                                                                                                   | Tri par `product-analyst` avant la porte 3 ; nouvelles questions numérotées E32 et suivantes                                                | A                |

## Mineurs (alignements, sauf mention)

21. **Dictionnaire.** Textes manquants :
    - erreurs de file : `appointment_not_today`, `member_required`, `invalid_merge_target`, `ticket_closed`, `duration_limit_reached`, `closing_not_reached` ;
    - autres erreurs : `team.member_not_found`, `team.already_deactivated`, `account.delete_failed` ;
    - modèle de notification `appointment_checked_in`.
22. **TRD §6.2.** Codes hors `queue-command` :
    - `team.member_not_found` est attribué à `regenerate-qr`, qui ne vise aucun membre ;
    - il manque les codes `team.*` d'`invite-member`, dont `team.last_manager` ;
    - aucun code pour `admin-decide-salon` ni pour `push-subscribe`.
23. **Contraintes `check` à ajouter.** Elles traduisent des règles déjà décidées :
    - appelé, en prestation ou terminé ⇒ coiffeur attribué ;
    - en prestation ⇒ `arrived_at` ;
    - `pending_confirmation` ⇒ signalé par le client ;
    - signalé puis accepté ⇒ `confirmed_at` ;
    - `late` ⇔ retard déclaré ;
    - les deux colonnes de réaffectation renseignées ensemble ;
    - `reason_code ~ '^[a-z_]+$'`.
24. **`reassignment_choice`.** Cette énumération n'a pas de colonne : préciser qu'elle vit dans `ticket_events`.
25. **TRD §14, essai de verrou.** Le second `call_ticket` reçoit le ticket éligible suivant, ou `no_eligible_ticket`. Il ne reçoit pas `invalid_transition`.
26. **Lot des fichiers ADR.** Le TRD §5 dit DEV-0, le plan dit DES-4 : aligner sur DES-4.
27. **`preview_presence_change`.** Il lui manque `shift_end_at?` et `break_type?`.
28. **Codes et motifs d'annulation manquants :**
    - `no_eligible_ticket` pour `take_next` ;
    - un code pour `wait` quand ce choix n'est pas proposé ;
    - le motif d'annulation de « J'annule » en T-30 et en fin de journée.
29. **Stories à aligner sur la v0.4 :**
    - `member_id?` manque dans P-02 et S-17 ;
    - une note de U-17 est périmée ;
    - des variables sont encore en camelCase dans U-06 ;
    - `estimate_change_reason` et `merged` ne sont pas utilisés.
30. **K22, fermeture des canaux d'un membre révoqué.** Aucun mécanisme Supabase n'est documenté pour la faire côté serveur. La marquer 🔬 ou la retirer : les messages ne portent que `{ version }`.
31. **`check_in_appointment`.** Il ne reçoit pas de `qr_token`, et le canal du ticket créé n'est pas fixé.
32. **E-mails Auth et `signup_resume`.** Il manque l'expéditeur, et leurs textes sont hors du dictionnaire.
33. **`salon_events`.**
    - Il n'a pas de `ticket_id`, utile pour `admin_viewed_client_data`.
    - On ne sait pas qui écrit `settings_updated` lors des écritures directes, ni comment éviter le texte libre.
34. **Convention §1.** `created_at` et `updated_at` manquent sur `opening_hours`, `salon_closures` et `stylist_presence`.
35. **H8, « dès son arrivée ».** S'agit-il de l'arrivée physique ou de l'heure déclarée ? Si c'est l'arrivée physique, aucun écran ne la saisit pour un ticket en attente. _Ely._
36. **Transition 1b.** Le TRD refuse le signalement quand la file est fermée, mais l'accepte pendant une pause : aligner le PRD. _Ely._
37. **`display_name` à l'anonymisation.** La colonne est non nulle : dire quelle valeur la remplace.

## Questions d'Ely dont le schéma dépend

- **À trancher avant le gel :**
  - E17 : messages indispensables, consentement des walk-ins et des rendez-vous saisis ;
  - E19 : délai et rappel d'un rendez-vous à confirmer ;
  - E24 : heure et motif d'annulation en fin de journée ;
  - E27 : résultat d'une réaffectation visible par le gérant ;
  - E28 : déduplication de l'avertissement d'absences ;
  - E29 : motif d'annulation d'un rendez-vous.
- **Moteur seulement :** E18, E20, E22, E26.
- **Sans impact sur le schéma :** E21, E23, E25, E30, E31.

## Valeurs 🟡 et 🔬 qui bloquent DES-4

- ADR-016 et ADR-017 attendent les réponses d'Ely.
- 🔬 Fournisseur SMS : sa compatibilité avec le _Send SMS Hook_ conditionne ADR-005. C'est l'essai PLN-3, prévu avant DES-4.

## ADR à écrire au lot DES-4

| N°  | Titre                                             | État                               |
| --- | ------------------------------------------------- | ---------------------------------- |
| 001 | Supabase région UE                                | Prêt                               |
| 002 | Monorepo, deux PWA                                | Prêt                               |
| 003 | Écritures de file sous verrou par salon           | Après le constat 14                |
| 004 | Idempotence par `command_id`                      | Prêt                               |
| 005 | Identification client par code SMS                | Après l'essai SMS                  |
| 006 | Lien de suivi par jeton et lien court             | Prêt                               |
| 007 | Téléphone du coiffeur, aucune donnée stockée      | Prêt                               |
| 008 | Outbox des notifications                          | Attend E17, E28                    |
| 009 | Temps réel par invalidation                       | Prêt                               |
| 010 | Temps UTC, journée de service                     | Attend E24                         |
| 011 | Téléphone hors des tables lues par les salons     | Après le constat 1                 |
| 012 | Recherche de proximité PostGIS                    | Prêt                               |
| 013 | Pas de position GPS stockée                       | Prêt                               |
| 014 | Dictionnaire de textes                            | Prêt                               |
| 015 | Distribution au moment de l'appel                 | Après le constat 15 ; attend E27   |
| 016 | Un rendez-vous est un ticket (avec la fusion K14) | Attend E18-E21, E24, E26, E27, E29 |
| 017 | Prochain créneau libre                            | Attend E22                         |
| 018 | Temps réel public sans donnée personnelle         | Prêt                               |
| 019 | Révocation en 15 min                              | Prêt, en précisant K22             |
| 020 | Consentement porté par le ticket (K11, K18)       | Attend E17                         |
| 021 | Journal sans prénom ni texte libre (K10, K25)     | Prêt                               |
| 022 | Absences comptées par empreinte du numéro (K8)    | Attend E28                         |
| 023 | Raisons d'un changement d'heure (E11, K19, K26)   | Prêt                               |
