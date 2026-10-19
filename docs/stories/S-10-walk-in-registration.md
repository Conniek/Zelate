# S-10 · Inscrire un client présent au salon (walk-in)

**En tant que** gérant, **je veux** inscrire en 10 s un client présent au salon (prénom, téléphone, prestation, coiffeur optionnel), **afin que** le client sans app ait sa place dans la file et reçoive par SMS une confirmation avec un lien de suivi.

- Priorité : I (PRD §5.3)
- Règles appliquées : seul le gérant inscrit un client présent au salon ; la prestation est facultative, 30 min comptées par défaut (PRD §5.1, §11 n° 16 et E12) ; « je ne sais pas encore » est accepté par tous les coiffeurs (PRD §5.1, E12) ; un seul ticket actif par client, tous salons confondus (PRD §5.1) ; H6 (numéro jamais affiché) ; H3 et PRD §5.4 (3 SMS maximum par ticket, hors « votre tour », annulation par le salon et avertissement d'absences, E1, E28 ; SMS d'inscription si pas de push) ; messages indispensables sans « Me prévenir », lien pour l'activer (PRD §5.1, E17) ; PRD §5.2 transition 1 ; métrique « temps d'inscription walk-in » médiane ≤ 10 s (PRD §8)
- Parcours : F-M7 ; F-M6 (bouton « + Client à l'accueil », raccourci `N`) ; suivi côté client F-C10 (lien SMS `/t/:shortCode`)
- Commandes et données : `register_walk_in` (`first_name`, `phone`, `service_id?`, `requested_member_id?`) · Edge Function `ticket-public` (lien court) · tables `tickets` (`channel` = `front_desk`, `display_name`, `service_id`, `planned_duration_minutes`, `requested_member_id`, `created_by_member_id`, `tracking_token`, `tracking_short_code`, `notifications_consent_at` vide à la création), `private.ticket_contacts` (`phone_e164`, `phone_hash`, `is_active` ; une ligne par ticket dont le numéro est connu, K28), `notifications` (`ticket_created`, canal `sms`), `ticket_events` (`created`) · `set_notifications_consent` (activation de « Me prévenir » depuis le lien, K34)

## Scénarios

### 1. Inscription nominale
- **Étant donné** une file ouverte et non complète, le gérant sur `/dashboard`
- **Quand** il clique sur « + Client à l'accueil »
- **Alors** la boîte « Client à l'accueil » s'ouvre avec le curseur dans le champ « Prénom »
- **Quand** il saisit le prénom et le téléphone, choisit une prestation, laisse « premier disponible » et appuie sur Entrée
- **Alors** la commande `register_walk_in` est envoyée
- **Alors** un ticket au canal `front_desk` est ajouté à la file du dashboard
- **Alors** le client reçoit un SMS avec son rang, son heure, son code de ticket et le lien de suivi
- **Alors** le gérant qui a inscrit le client est enregistré dans `created_by_member_id`
- **Alors** l'événement `created` est inscrit au journal du ticket

### 2. Inscription en 10 s au clavier
- **Étant donné** le dashboard ouvert
- **Quand** le gérant appuie sur `N`, tape le prénom, le téléphone, puis appuie sur Entrée
- **Alors** le ticket est créé sans que le gérant touche la souris
- **Alors** le temps entre l'ouverture de la boîte et la création du ticket est mesuré pour la métrique (médiane ≤ 10 s)

### 3. Numéro masqué dès l'enregistrement (confidentialité)
- **Étant donné** un ticket walk-in qui vient d'être créé
- **Quand** le gérant ou un coiffeur consulte la file, le ticket ou son panneau détail
- **Alors** le numéro du client n'est affiché nulle part
- **Alors** le numéro n'est enregistré que dans `private.ticket_contacts`, que l'API ne lit pas

### 4. Coiffeur demandé
- **Étant donné** la boîte « Client à l'accueil » ouverte
- **Quand** le gérant choisit le coiffeur Léa puis inscrit le client
- **Alors** le ticket demande Léa (`requested_member_id`)
- **Alors** le ticket apparaît dans la colonne de Léa et dans sa file sur son téléphone

### 5. Sans prestation choisie
- **Étant donné** la boîte « Client à l'accueil » ouverte
- **Quand** le gérant inscrit le client sans choisir de prestation
- **Alors** le ticket est créé sans prestation (`service_id` vide), avec une durée de calcul de 30 min (PRD §5.1 et §5.2, E12)
- **Alors** tout coiffeur présent peut être son coiffeur pressenti et l'appeler (PRD §5.1, E12)

### 5 bis. Coiffeur demandé indisponible
- **Étant donné** la coiffeuse Léa déclarée absente aujourd'hui
- **Quand** une commande `register_walk_in` arrive avec Léa comme coiffeur demandé
- **Alors** elle est refusée avec l'erreur `queue.stylist_unavailable` (TRD v0.5 §6.2)
- **Alors** aucun ticket n'est créé et aucun SMS n'est envoyé

### 6. Numéro qui a déjà un ticket actif
- **Étant donné** un numéro qui a déjà un ticket actif, dans ce salon ou dans un autre
- **Quand** le gérant essaie d'inscrire un client avec ce numéro
- **Alors** le message de l'erreur `queue.already_has_active_ticket` s'affiche
- **Alors** aucun ticket n'est créé et aucun SMS n'est envoyé
- **Alors** le message ne nomme pas l'autre salon (isolation par salon)

### 7. File fermée
- **Étant donné** une file fermée
- **Quand** le gérant essaie d'inscrire un client
- **Alors** le message de l'erreur `queue.queue_closed` s'affiche
- **Alors** aucun ticket n'est créé

### 7 bis. File en pause
- **Étant donné** une file en pause
- **Quand** le gérant essaie d'inscrire un client
- **Alors** le message de l'erreur `queue.queue_paused` s'affiche (TRD §6.2)
- **Alors** aucun ticket n'est créé

### 8. File complète
- **Étant donné** une file dont la prochaine prestation finirait après la fermeture
- **Quand** le gérant essaie d'inscrire un client
- **Alors** le message de l'erreur `queue.queue_full` s'affiche
- **Alors** aucun ticket n'est créé

### 9. Trop d'inscriptions en peu de temps
- **Étant donné** que le plafond de création de tickets est atteint
- **Quand** le gérant essaie d'inscrire un client
- **Alors** le message de l'erreur `queue.rate_limited` s'affiche
- **Alors** aucun ticket n'est créé

### 10. Numéro invalide ou non français
- **Étant donné** la boîte « Client à l'accueil » ouverte
- **Quand** le gérant saisit un numéro mal formé ou qui n'est pas un numéro +33
- **Alors** l'inscription est refusée avec le message de l'erreur `queue.invalid_phone` sous le champ « Téléphone » (TRD §6.2)
- **Alors** aucun SMS n'est envoyé

### 11. Prénom manquant ou trop long
- **Étant donné** la boîte « Client à l'accueil » ouverte
- **Quand** le prénom est vide ou fait plus de 30 caractères
- **Alors** l'inscription est refusée avec un message sous le champ « Prénom »

### 12. Le SMS d'inscription compte dans le plafond
- **Étant donné** un ticket walk-in créé, dont le client n'a pas de push actif
- **Quand** les SMS suivants du ticket partent
- **Alors** le SMS d'inscription compte comme le SMS 1 sur 3
- **Alors** aucun SMS au-delà du 3e n'est envoyé (`skipped`, `sms_cap_reached`), sauf « votre tour », l'annulation par le salon et l'avertissement d'absences, qui partent toujours (PRD §5.4, E1, E28)

### 12 ter. Messages indispensables sans « Me prévenir »
- **Étant donné** un ticket walk-in, dont la case « Me prévenir » n'a jamais été cochée (`notifications_consent_at` vide)
- **Quand** le client est appelé, puis relancé à 5 min, ou que le salon annule sa place, ou que son coiffeur demandé devient indisponible
- **Alors** les messages `your_turn`, `arrival_reminder`, `cancelled_by_salon` et `stylist_change_required` partent quand même : ce sont des messages indispensables (PRD §5.1, E17)
- **Quand** son heure de passage arrive à 10 min ou change de 10 min ou plus
- **Alors** `get_ready` et `estimate_changed` ne partent pas (`skipped`, `no_consent`) : ce sont des messages d'anticipation (E17)

### 12 quater. Le client active « Me prévenir » depuis le lien du SMS
- **Étant donné** le client walk-in sur sa page de suivi `/t/:shortCode`
- **Quand** il active « Me prévenir »
- **Alors** la commande `set_notifications_consent` (`consent` = vrai) part avec le jeton du ticket (TRD §6.2, K34 ; F-C10)
- **Alors** `tickets.notifications_consent_at` est renseigné pour ce ticket
- **Alors** les messages d'anticipation suivants lui sont envoyés (« préparez-vous » par SMS dans le plafond s'il n'a pas de push)
- **Quand** la commande arrive pour un ticket déjà terminé ou annulé
- **Alors** elle est refusée avec `queue.invalid_transition` (K34)

### 12 bis. « Votre tour » part même plafond atteint
- **Étant donné** un ticket walk-in qui a déjà reçu 3 SMS
- **Quand** un coiffeur appelle ce client
- **Alors** le SMS « votre tour » est envoyé (PRD §5.1, E1)

### 13. Suivi par le lien du SMS
- **Étant donné** le client qui a reçu le SMS d'inscription
- **Quand** il ouvre le lien court `zelate.fr/t/xxxxxxxx` (8 caractères) du SMS
- **Alors** le lien est résolu par `ticket-public` (TRD ADR-006, K5)
- **Alors** il voit son ticket sans se connecter (F-C10)

### 13 bis. Lien de suivi expiré
- **Étant donné** un ticket walk-in de plus de 24 h (F-C10 ; TRD §6.1 `ticket-public`)
- **Quand** le client ouvre le lien du SMS
- **Alors** il voit « Ce lien a expiré » (F-C10)

### 14. Double appui sur Entrée
- **Étant donné** la boîte remplie
- **Quand** le gérant appuie deux fois rapidement sur Entrée
- **Alors** un seul ticket est créé et un seul SMS est envoyé

### 15. Un coiffeur ne peut pas inscrire un client
- **Étant donné** un coiffeur connecté sur son téléphone
- **Quand** il regarde son espace coiffeur
- **Alors** aucune action d'inscription à l'accueil ne lui est proposée
- **Quand** une commande `register_walk_in` est envoyée depuis son compte
- **Alors** la commande est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.walk_in.open` | « + Client à l'accueil » | Libellé indicatif (APP_FLOW F-M6) ; raccourci `N` indiqué |
| `pro-manager.walk_in.title` | « Client à l'accueil » | Libellé indicatif (APP_FLOW F-M7) |
| `pro-manager.walk_in.first_name` | « Prénom » | 30 caractères maximum |
| `pro-manager.walk_in.phone` | « Téléphone » | +33 |
| `pro-manager.walk_in.phone_hint` | « Le client reçoit son lien de suivi par SMS. Le numéro est masqué dès l'enregistrement. » | H6 |
| `pro-manager.walk_in.service` | « Prestation (facultative) » | — |
| `pro-manager.walk_in.service_hint` | « Sans prestation, 30 min sont prévues. » | E12 |
| `pro-manager.walk_in.stylist` | « Coiffeur (facultatif) » | — |
| `pro-manager.walk_in.success` | « {first_name} est dans la file. » | — |
| `legal.consent.tracking_notifications.label` | « Me prévenir quand mon tour approche » | Activation depuis le lien de suivi (F-C10, E17) |
| `errors.queue.stylist_unavailable` | « Ce coiffeur n'est pas disponible pour le moment. Choisissez-en un autre, puis réessayez. » | TRD v0.5 §6.2 |
| `common.first_available` | « Premier disponible » | Partagée avec l'app client (F-C3) |
| `pro-manager.walk_in.submit` | « Inscrire » | Libellé indicatif (APP_FLOW F-M7) |
| `notifications.ticket_created.sms` | « {salon_name} : inscription confirmée. {count, plural, =0 {Personne avant vous} one {# client avant vous} other {# clients avant vous}}, passage vers {time}. Code {code}. Suivi : {link} » | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (TRD §9, K5) ; contient rang, heure, code du ticket, lien de suivi (APP_FLOW §7) |
| `client.tracking.expired` | « Ce lien a expiré » | APP_FLOW F-C10 ; partagée avec U-06 |
| `errors.queue.already_has_active_ticket` | « Ce numéro a déjà une place en cours. Une seule place à la fois est possible. » | Ne nomme pas l'autre salon |
| `errors.queue.queue_closed` | « La file est fermée : aucune nouvelle inscription n'est possible pour le moment. » | Partagée avec S-08 |
| `errors.queue.queue_paused` | « La file est en pause : aucune nouvelle inscription pour le moment. Réessayez à sa reprise. » | Partagée avec S-08 |
| `errors.queue.queue_full` | « La file est complète pour aujourd'hui : les prochaines prestations finiraient après la fermeture. » | Partagée avec S-08 |
| `errors.queue.rate_limited` | « Trop de demandes en peu de temps. Patientez quelques minutes, puis réessayez. » | — |
| `errors.queue.invalid_phone` | « Ce numéro n'est pas valide. Saisissez un numéro de téléphone français. » | Numéro +33 (TRD §6.2) |
| `errors.queue.forbidden` | « Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. » | Code commun (TRD §6.2) |
| `errors.validation.first_name` | « Indiquez un prénom de 30 caractères au plus. » | 1 à 30 caractères |

## Questions ouvertes
- **Résolu le 18/10** (E12, PRD §5.1) : la prestation d'un walk-in est facultative, 30 min comptées par défaut.
- **Résolu le 18/10** (K5, TRD §9 et ADR-006) : le SMS porte un lien court `zelate.fr/t/xxxxxxxx` (8 caractères) ; prénom ≤ 30, nom du salon tronqué à 40, accents translittérés.
- **Résolu le 18/10** (K1, TRD §6.2) : un coiffeur qui envoie `register_walk_in` reçoit `queue.forbidden` ; un numéro invalide donne `queue.invalid_phone`, une file en pause `queue.queue_paused`.
- **Résolu le 19/10** (E17, K18, K34 ; PRD §5.1, TRD §6.2, APP_FLOW F-C10) : un walk-in reçoit tous les messages indispensables sans case cochée ; seuls les messages d'anticipation (`turn_approaching`, `get_ready`, `estimate_changed`, `end_of_day_risk`) demandent « Me prévenir », que le client active depuis le lien de suivi (`set_notifications_consent`, consentement porté par le ticket). Avis RGPD encore à obtenir (PRD §9 n° 9).
- **Résolu en partie le 19/10** (TRD v0.5 §6.2) : `register_walk_in` renvoie `stylist_unavailable` pour un coiffeur indisponible. **Reste ouvert (APP_FLOW)** : la boîte F-M7 propose-t-elle les coiffeurs absents ce jour-là ?
- **TRD** : le plafond de création de tickets (`rate_limits`) n'a pas de valeur chiffrée. Quel seuil s'applique pour `queue.rate_limited` ?
- **TRD** : si le client a déjà un compte client avec ce numéro, le ticket walk-in est-il rattaché à son compte (`client_id` est vide pour un walk-in) ? Le client le voit-il dans `/ticket` après s'être connecté par code SMS ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
