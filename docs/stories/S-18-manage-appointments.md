# S-18 · Saisir, modifier et annuler les rendez-vous du jour

**En tant que** gérant, **je veux** saisir, modifier et annuler les rendez-vous du jour de mes coiffeurs (prénom, heure, prestation, coiffeur, téléphone facultatif), **afin que** les rendez-vous pris hors de Zelaté occupent leur créneau dans la file et que les clients de dernière minute ne les retardent pas.

- Priorité : I (PRD §5.3)
- Règles appliquées : H10 et PRD §5.2 « Distribution » règles 6 à 8 (R1, R2, R3, R7 : marge de 0 min) ; PRD §5.2 transitions 1 et 6 ; « Prévenir avant de partir » (PRD §5.2, R5) ; H3 et PRD §5.4 (3 SMS maximum par ticket) ; H6 et PRD §5.1 (numéro jamais affiché au salon ni au coiffeur) ; R4, R6 (saisie par le gérant et par chaque coiffeur pour ses clients) ; un seul ticket actif par numéro (PRD §5.1) ; changement d'heure de 10 min ou plus expliqué (PRD §5.1, E11) ; saisie le jour même seulement, dans les horaires du salon, acceptée pour un coiffeur en pause, avec un avertissement s'il est absent (PRD §5.1, E26) ; annulation avec un motif obligatoire choisi dans une liste, envoyé au client (E29) ; messages indispensables sans « Me prévenir », lien pour l'activer (E17) ; alertes de retard : une alerte avec le retard du moment, pas d'alerte de rattrapage, arrêt à l'arrivée ou à l'appel (E23) ; « en retard de X min » = retard du salon, dès 10 min (E30) ; isolation par salon (PRD §5.1)
- Parcours : F-M13 (`/dashboard/appointments`) ; F-M6 (bouton « Rendez-vous », liste globale) ; côté client F-C13 et F-C10 (lien SMS) ; événements « Ticket créé » et « Retard sur un rendez-vous » (APP_FLOW §7)
- Commandes et données : `create_appointment` (chevauchement, tolérance de 15 min, 60 créations par heure et par salon, K15), `update_appointment` (`phone?`), `cancel_appointment` (`reason_code` obligatoire, E29) · tables `tickets` (`removal_reason`, `notifications_consent_at`), `tickets` (`kind` = `appointment`, `appointment_source` = `salon_entry`, `channel` = `front_desk`, `scheduled_at`, `assigned_member_id`, `display_name`, `service_id`, `planned_duration_minutes`, `created_by_member_id`, `appointment_delay_warned_steps`, `cancel_reason`), `private.ticket_contacts` (`phone_e164`, `phone_hash`, `is_active`), `notifications` (`ticket_created`, `appointment_delay`, `estimate_changed`, `cancelled_by_salon`), `ticket_events` (`created`, `appointment_updated`, `cancelled`, `appointment_delay_warned`), `private.processed_commands` · canaux `salon:{salon_id}`, `ticket-token:{token_key}`

## Scénarios

### 1. Saisie nominale sans téléphone

- **Étant donné** Nadia, gérante, sur `/dashboard/appointments`
- **Quand** elle appuie sur `R` (ou clique sur « + Rendez-vous »)
- **Alors** la boîte de saisie s'ouvre avec le curseur dans le champ « Prénom »
- **Quand** elle saisit « Léa », choisit 14h30, la coiffeuse Inès et la prestation « Coupe femme », sans téléphone, puis valide
- **Alors** la commande `create_appointment` est envoyée
- **Et** un ticket de type `appointment` est créé au statut « En attente », attribué à Inès, avec l'heure 14h30 (`scheduled_at`)
- **Et** le rendez-vous apparaît dans la liste du jour, à 14h30, chez Inès, au statut « à venir »
- **Et** il apparaît dans la colonne d'Inès et dans la liste globale du dashboard avec le badge « RDV 14h30 »
- **Et** il apparaît dans la file d'Inès sur son téléphone en moins de 2 s
- **Et** Nadia est enregistrée comme membre qui a saisi le rendez-vous (`created_by_member_id`)
- **Et** l'événement `created` est inscrit au journal du ticket, avec Nadia comme actrice
- **Et** aucune notification n'est envoyée

### 2. Saisie avec téléphone : SMS de suivi

- **Étant donné** la boîte de saisie ouverte
- **Quand** Nadia saisit aussi le téléphone de Léa et valide
- **Alors** le rendez-vous est créé comme au scénario 1
- **Et** Léa reçoit un SMS (`ticket_created`, variante `appointment`) avec l'heure du rendez-vous, l'heure de passage, le code du ticket et le lien de suivi `/t/:shortCode`
- **Et** ce SMS compte comme le SMS 1 sur 3 du ticket
- **Et** Léa ouvre son rendez-vous par le lien, sans se connecter (F-C10)
- **Et** son ticket n'a pas « Me prévenir » (`notifications_consent_at` vide) : elle reçoit les messages indispensables, et peut activer « Me prévenir » depuis le lien (`set_notifications_consent`, PRD §5.1, E17, K34)

### 3. Téléphone jamais réaffiché (H6)

- **Étant donné** un rendez-vous saisi avec téléphone
- **Quand** Nadia rouvre ce rendez-vous dans la liste, dans le panneau du ticket ou avec « Modifier »
- **Alors** le numéro n'est affiché nulle part
- **Quand** Inès consulte sa file ou ses rendez-vous sur son téléphone
- **Alors** le numéro n'est affiché nulle part
- **Et** le numéro n'est enregistré que dans `private.ticket_contacts`, que l'API ne lit pas

### 4. Sans prestation

- **Étant donné** la boîte de saisie ouverte
- **Quand** Nadia saisit un rendez-vous sans choisir de prestation
- **Alors** le rendez-vous est créé avec une durée de calcul de 30 min (`planned_duration_minutes`, BACKEND_SCHEMA §4.13)

### 5. Un client de dernière minute ne passe avant que s'il finit avant (règle 6, R1, R7)

- **Étant donné** le rendez-vous de Léa à 14h30 chez Inès, Inès libre à 14h00
- **Et** dans la file, sans préférence, Karim pour une prestation de 20 min et Sofia pour une prestation de 45 min
- **Quand** le moteur recalcule après la saisie
- **Alors** Karim peut être placé avant Léa chez Inès, car sa prestation finit avant 14h30
- **Et** Sofia n'est pas placée avant Léa chez Inès, car elle finirait après 14h30 (marge de 0 min)
- **Et** le client dont l'heure de passage change de 10 min ou plus par rapport à la dernière heure annoncée reçoit l'explication du changement

### 6. File fermée, en pause ou complète

- **Étant donné** la file du salon fermée, en pause ou complète
- **Quand** Nadia saisit un rendez-vous dans les horaires d'ouverture du jour
- **Alors** le rendez-vous est créé (la condition « file ouverte et non complète » ne s'applique pas aux rendez-vous, PRD §5.2 transition 1)

### 6 bis. Coiffeur en pause ou absent

- **Étant donné** Inès en pause
- **Quand** Nadia saisit un rendez-vous pour Inès dans les horaires
- **Alors** le rendez-vous est créé, sans message (PRD §5.1, E26)
- **Étant donné** Karim déclaré absent aujourd'hui
- **Quand** Nadia saisit un rendez-vous pour Karim
- **Alors** le rendez-vous est créé
- **Et** Nadia voit un avertissement « coiffeur absent » (E26 ; forme 🟡 au TRD §6.2, proposition `data.warnings: ['stylist_absent']`)

### 6 ter. Rendez-vous d'un autre jour

- **Étant donné** la boîte de saisie ouverte
- **Quand** une commande `create_appointment` arrive avec une heure de demain
- **Alors** elle est refusée avec `queue.appointment_not_today` (PRD §5.1, E26 ; TRD §6.2)
- **Et** aucun rendez-vous n'est créé

### 7. Chevauchement avec un autre rendez-vous du coiffeur

- **Étant donné** un rendez-vous d'Inès déjà saisi à 14h30 pour une prestation de 45 min
- **Quand** Nadia saisit pour Inès un rendez-vous à 15h00
- **Alors** le message de l'erreur `queue.appointment_overlap` s'affiche (chevauchement mesuré sur la durée de la prestation, K15)
- **Et** aucun rendez-vous n'est créé
- **Et** aucun SMS n'est envoyé

### 7 bis. Deux rendez-vous bout à bout

- **Étant donné** un rendez-vous d'Inès à 14h30, sans prestation (30 min comptées)
- **Quand** Nadia saisit pour Inès un rendez-vous à 15h00
- **Alors** le rendez-vous est créé : deux rendez-vous bout à bout ne se chevauchent pas (TRD §6.2, K15)

### 8. Heure hors des horaires d'ouverture

- **Étant donné** la boîte de saisie ouverte
- **Quand** l'heure choisie tombe hors des horaires d'ouverture du jour
- **Alors** le sélecteur d'heure ne la propose pas (`TimePicker` limité aux horaires d'ouverture, DESIGN_SYSTEM)
- **Quand** une commande `create_appointment` arrive quand même avec cette heure
- **Alors** elle est refusée avec `queue.outside_opening_hours`
- **Et** aucun rendez-vous n'est créé

### 9. Heure déjà passée

- **Étant donné** qu'il est 15h20
- **Quand** Nadia saisit un rendez-vous à 15h00, passé de plus de 15 min
- **Alors** le message de l'erreur `queue.appointment_in_past` s'affiche
- **Et** aucun rendez-vous n'est créé

### 9 bis. Rendez-vous juste passé : tolérance de 15 min

- **Étant donné** qu'il est 15h10
- **Quand** Nadia saisit un rendez-vous oublié à 15h00
- **Alors** le rendez-vous est créé (15 min de tolérance, TRD §6.2, K15)
- Le cas exact de 15h15 (limite incluse ou non) est une question ouverte.

### 10. Pas de 5 min

- **Étant donné** la boîte de saisie ouverte
- **Quand** Nadia choisit l'heure
- **Alors** seules des heures par pas de 5 min lui sont proposées

### 11. Numéro qui a déjà un ticket actif

- **Étant donné** un numéro qui a déjà un ticket actif, dans ce salon ou dans un autre
- **Quand** Nadia saisit un rendez-vous avec ce numéro
- **Alors** le message de l'erreur `queue.already_has_active_ticket` s'affiche
- **Et** aucun rendez-vous n'est créé et aucun SMS n'est envoyé
- **Et** le message ne nomme pas l'autre salon

### 12. Numéro invalide ou non français

- **Étant donné** la boîte de saisie ouverte
- **Quand** Nadia saisit un numéro mal formé ou qui n'est pas un numéro +33
- **Alors** la saisie est refusée avec le message de `queue.invalid_phone` sous le champ « Téléphone »
- **Et** aucun SMS n'est envoyé

### 13. Prénom manquant ou trop long

- **Étant donné** la boîte de saisie ouverte
- **Quand** le prénom est vide ou fait plus de 30 caractères
- **Alors** la saisie est refusée avec un message sous le champ « Prénom »
- **Et** une commande envoyée quand même est refusée avec `queue.invalid_payload`

### 14. Modifier l'heure d'un rendez-vous

- **Étant donné** le rendez-vous de Léa à 14h30 chez Inès, au statut « En attente », saisi avec téléphone
- **Quand** Nadia clique sur « Modifier », choisit 15h00 et valide
- **Alors** la commande `update_appointment` est envoyée
- **Et** le rendez-vous passe à 15h00 dans la liste du jour et dans la file d'Inès, en moins de 2 s
- **Et** les heures de passage de la file sont recalculées
- **Et** Léa est prévenue, puisque son heure change de 10 min ou plus (raison `your_appointment_changed`) ; le canal et le consentement de ce message sont une question ouverte
- **Et** l'événement `appointment_updated` est inscrit au journal, sans prénom (K10)

### 14 bis. Ajouter un téléphone à un rendez-vous déjà saisi

- **Étant donné** le rendez-vous de Léa saisi sans téléphone, au statut « En attente »
- **Quand** Nadia clique sur « Modifier », saisit le téléphone de Léa et valide (`update_appointment` avec `phone`)
- **Alors** le numéro est enregistré dans `private.ticket_contacts` seulement (K28)
- **Et** le numéro n'est plus affiché, ni à Nadia ni à Inès
- **Et** un numéro qui a déjà un ticket actif est refusé avec `queue.already_has_active_ticket`, un numéro mal formé avec `queue.invalid_phone` (TRD §6.2)

### 15. Modifier le coiffeur, la prestation ou le prénom

- **Étant donné** le rendez-vous de Léa au statut « En attente »
- **Quand** Nadia change le coiffeur pour Karim, la prestation ou le prénom, et valide
- **Alors** le rendez-vous est modifié et passe dans la file de Karim s'il a changé de coiffeur
- **Et** il disparaît de la file d'Inès en moins de 2 s
- **Et** le changement est contrôlé comme une saisie (chevauchement, horaires, heure passée)
- Le changement de coiffeur par « Modifier » dépend de la question ouverte sur `update_appointment` et E27 (règle de non-recul de S-13).

### 16. Modification qui crée un chevauchement

- **Étant donné** deux rendez-vous d'Inès, à 14h30 et à 16h00
- **Quand** Nadia déplace celui de 16h00 sur le créneau de celui de 14h30
- **Alors** le message de l'erreur `queue.appointment_overlap` s'affiche
- **Et** le rendez-vous garde son heure de 16h00

### 17. Annuler un rendez-vous

- **Étant donné** le rendez-vous de Léa au statut « En attente », saisi avec téléphone
- **Quand** Nadia clique sur « Annuler le rendez-vous »
- **Alors** une boîte demande un motif dans une liste (`removal_reason`) et rappelle que le client sera prévenu s'il a laissé un numéro (F-M13, E29)
- **Quand** elle choisit « Urgence » et confirme
- **Alors** la commande `cancel_appointment` est envoyée avec `reason_code` = `emergency`
- **Et** le ticket passe au statut « Annulé » avec le motif `removed_by_salon` et `removal_reason` = `emergency`
- **Et** le rendez-vous disparaît de la file d'Inès et de la liste globale en moins de 2 s
- **Et** Léa reçoit la notification `cancelled_by_salon` avec le motif, par push et par SMS, hors plafond, même sans « Me prévenir » (PRD §5.4, E17, E28, E29)
- **Et** les clients suivants avancent
- **Et** l'événement `cancelled` est inscrit au journal, avec Nadia comme actrice et le motif (`reason_code`)

### 17 bis. Annuler sans motif

- **Étant donné** la boîte d'annulation ouverte
- **Quand** aucun motif n'est choisi
- **Alors** le bouton « Annuler le rendez-vous » est inactif
- **Quand** une commande `cancel_appointment` arrive sans `reason_code`
- **Alors** elle est refusée avec `queue.invalid_payload` (TRD §6.2)
- **Et** le rendez-vous reste actif

### 18. Modifier ou annuler sans téléphone saisi

- **Étant donné** un rendez-vous saisi sans téléphone
- **Quand** Nadia le modifie ou l'annule
- **Alors** la modification ou l'annulation est enregistrée
- **Et** aucune notification n'est envoyée

### 19. Rendez-vous déjà appelé

- **Étant donné** le rendez-vous de Léa au statut « Appelé » ou « En prestation »
- **Quand** Nadia regarde ce rendez-vous
- **Alors** « Modifier » et « Annuler » ne lui sont pas proposés
- **Quand** une commande `update_appointment` ou `cancel_appointment` est envoyée pour ce ticket
- **Alors** elle est refusée avec `queue.appointment_not_editable`
- **Et** le ticket ne change pas

### 20. Prévenir le client quand le salon prend du retard (R5)

- **Étant donné** le rendez-vous de Léa à 14h10, saisi avec téléphone, sans push actif
- **Quand** son heure de passage atteint 14h20 (10 min après l'heure du rendez-vous)
- **Alors** Léa reçoit un SMS `appointment_delay` qui lui indique de venir vers 14h20
- **Et** le rendez-vous affiche son retard dans la liste du jour et sur le dashboard (« RDV 14h10 · +10 min »)
- **Et** l'événement `appointment_delay_warned` est inscrit au journal
- **Quand** son heure de passage atteint 14h30 (10 min de plus)
- **Alors** Léa reçoit une nouvelle alerte `appointment_delay`
- **Et** ces alertes partent même sans « Me prévenir » : ce sont des messages indispensables (PRD §5.1, E17)

### 20 bis. Saut de plusieurs paliers : une seule alerte

- **Étant donné** le rendez-vous de Léa à 14h10, dont l'heure de passage est 14h15
- **Quand** une prestation se prolonge et son heure de passage passe d'un coup à 14h35 (25 min de retard)
- **Alors** Léa reçoit une seule alerte, avec le retard du moment : « venez vers 14h35 » (PRD §5.2, E23)

### 20 ter. Pas d'alerte quand le salon rattrape son retard

- **Étant donné** Léa, déjà prévenue de venir vers 14h30
- **Quand** son heure de passage revient à 14h20
- **Alors** aucune alerte `appointment_delay` n'est envoyée (E23)

### 20 quater. Plus d'alerte une fois arrivée ou appelée

- **Étant donné** Léa, dont l'arrivée a été validée par son code, ou qui a été appelée
- **Quand** son heure de passage recule encore de 10 min
- **Alors** aucune alerte `appointment_delay` n'est envoyée (E23)

### 21. Alerte de retard par push quand il est actif

- **Étant donné** le rendez-vous de Léa, qui a activé le push depuis la page du lien de suivi
- **Quand** son heure de passage dépasse de 10 min l'heure du rendez-vous
- **Alors** l'alerte part par push
- **Et** aucun SMS n'est envoyé pour cette alerte

### 22. Les alertes de retard respectent le plafond de 3 SMS

- **Étant donné** le rendez-vous de Léa dont le ticket a déjà reçu 3 SMS (inscription et alertes de retard)
- **Quand** son heure de passage recule encore de 10 min
- **Alors** aucun SMS n'est envoyé (ligne `skipped`, `sms_cap_reached`)
- **Et** le SMS « votre tour » partira quand même à l'appel (PRD §5.4, E1)

### 23. Pas d'alerte de retard sans téléphone

- **Étant donné** un rendez-vous saisi sans téléphone, client sans lien de suivi
- **Quand** son heure de passage dépasse de 10 min l'heure du rendez-vous
- **Alors** aucune notification n'est envoyée
- **Et** le retard reste visible sur le dashboard et dans la file du coiffeur

### 24. Double validation

- **Étant donné** la boîte de saisie remplie
- **Quand** Nadia valide deux fois très vite
- **Alors** un seul rendez-vous est créé
- **Et** un seul SMS est envoyé

### 25. Trop de saisies en peu de temps

- **Étant donné** que le salon a déjà créé 60 rendez-vous dans l'heure écoulée
- **Quand** Nadia saisit un 61e rendez-vous
- **Alors** le message de l'erreur `queue.rate_limited` s'affiche (60 créations par heure et par salon, TRD §6.2, K15)
- **Et** aucun rendez-vous n'est créé

### 26. Isolation par salon

- **Étant donné** Nadia, gérante du salon A
- **Quand** une commande `update_appointment` ou `cancel_appointment` est envoyée depuis son compte pour un rendez-vous du salon B
- **Alors** elle est refusée avec `queue.ticket_other_salon` (TRD v0.5 §6.2)
- **Et** le rendez-vous du salon B ne change pas

### 27. Connexion perdue

- **Étant donné** le dashboard qui affiche « Connexion perdue »
- **Quand** Nadia regarde la page des rendez-vous
- **Alors** « + Rendez-vous », « Modifier » et « Annuler » sont désactivés
- **Et** aucune commande n'est envoyée

## Textes à prévoir

| Clé (anglais)                                                     | Texte (français)                                                                                                                                                                                                           | Contrainte                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pro-manager.appointments.title`                                  | « Rendez-vous du jour »                                                                                                                                                                                                    | Libellé indicatif (APP_FLOW §2.2, F-M13)                                                                                                                                                                                                    |
| `pro-manager.appointments.new`                                    | « + Rendez-vous »                                                                                                                                                                                                          | Libellé indicatif (APP_FLOW F-M13) ; raccourci `R` indiqué                                                                                                                                                                                  |
| `pro-manager.appointments.form.first_name`                        | « Prénom »                                                                                                                                                                                                                 | 30 caractères maximum                                                                                                                                                                                                                       |
| `pro-manager.appointments.form.time`                              | « Heure »                                                                                                                                                                                                                  | Pas de 5 min, horaires d'ouverture ; aide `pro-manager.appointments.form.time_hint` « Par pas de 5 min, pendant les horaires d'ouverture. »                                                                                                 |
| `pro-manager.appointments.form.stylist`                           | « Coiffeur »                                                                                                                                                                                                               | —                                                                                                                                                                                                                                           |
| `pro-manager.appointments.form.service`                           | « Prestation (facultative) »                                                                                                                                                                                               | Facultative                                                                                                                                                                                                                                 |
| `pro-manager.appointments.form.phone`                             | « Téléphone (facultatif) »                                                                                                                                                                                                 | Facultatif, +33 ; jamais prérempli en modification ; aide `pro-manager.appointments.form.phone_hint` « Avec un numéro, le client reçoit son lien de suivi par SMS. Le numéro est masqué dès l'enregistrement. »                             |
| `pro-manager.appointments.form.submit`                            | « Ajouter le rendez-vous »                                                                                                                                                                                                 | —                                                                                                                                                                                                                                           |
| `pro-manager.appointments.form.submit_edit`                       | « Enregistrer les modifications »                                                                                                                                                                                          | Modification                                                                                                                                                                                                                                |
| Avertissement « coiffeur absent »                                 | _À rédiger_ (aucune clé dans le dictionnaire)                                                                                                                                                                              | E26 ; forme 🟡 au TRD §6.2                                                                                                                                                                                                                  |
| `pro-manager.appointments.edit`                                   | « Modifier »                                                                                                                                                                                                               | Libellé indicatif (APP_FLOW F-M13)                                                                                                                                                                                                          |
| `pro-manager.appointments.cancel`                                 | « Annuler le rendez-vous »                                                                                                                                                                                                 | Libellé indicatif (APP_FLOW F-M13)                                                                                                                                                                                                          |
| `pro-manager.appointments.cancel_dialog.<element>`                | Voir `pro-manager.appointments.cancel_dialog.*` dans le dictionnaire (6 textes)                                                                                                                                            | Titre, résumé, « Motif », avertissement au client, « Garder le rendez-vous », « Annuler le rendez-vous » (E29)                                                                                                                              |
| `pro-manager.remove.reason.<removal_reason>`                      | Voir `pro-manager.remove.reason.*` dans le dictionnaire (5 textes)                                                                                                                                                         | Liste des motifs, en attendant une liste dédiée aux rendez-vous 🟡 (TRD §6.2, E29)                                                                                                                                                          |
| `pro-manager.appointments.status.upcoming`                        | « À venir »                                                                                                                                                                                                                | APP_FLOW F-M13                                                                                                                                                                                                                              |
| `pro-manager.appointments.status.late`                            | « En retard de {minutes} min »                                                                                                                                                                                             | APP_FLOW F-M13 ; ICU                                                                                                                                                                                                                        |
| `pro-manager.appointments.status.arrived`                         | « Arrivé »                                                                                                                                                                                                                 | APP_FLOW F-M13                                                                                                                                                                                                                              |
| `pro-manager.appointments.status.pending_confirmation`            | « À confirmer »                                                                                                                                                                                                            | APP_FLOW F-M13, DESIGN_SYSTEM §2.4                                                                                                                                                                                                          |
| `common.appointment.badge`                                        | « RDV {time} »                                                                                                                                                                                                             | DESIGN_SYSTEM §2.4 (`AppointmentBadge`)                                                                                                                                                                                                     |
| `common.appointment.badge_late`                                   | « RDV {time} · +{minutes} min »                                                                                                                                                                                            | DESIGN_SYSTEM §2.4                                                                                                                                                                                                                          |
| `pro-manager.appointments.empty`                                  | Aucun rendez-vous aujourd'hui. Ajoutez-en un avec « + Rendez-vous ».                                                                                                                                                       | État vide (APP_FLOW §8)                                                                                                                                                                                                                     |
| `notifications.ticket_created.appointment.sms`                    | « {salon_name} : rendez-vous de {appointment_time} enregistré, passage prévu vers {time}. Code {code}. Suivi : {link} »                                                                                                    | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues : nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (TRD §9, K5) ; SMS 1 sur 3                                                   |
| `notifications.ticket_created.appointment.push`                   | Voir `notifications.ticket_created.appointment.push.*` dans le dictionnaire (2 textes)                                                                                                                                     | Si le client a activé le push                                                                                                                                                                                                               |
| `notifications.ticket_created.sms` (ticket de file, pour mémoire) | {salon_name} : inscription confirmée. {count, plural, =0 {Personne avant vous} one {# client avant vous} other {# clients avant vous}}, passage vers {time}. Code {code}. Suivi : {link}                                   | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues (TRD §9) ; variante rendez-vous : heure du rendez-vous, heure de passage, code, lien `zelate.fr/t/xxxxxxxx` (APP_FLOW §7) ; partagée avec S-10                     |
| `notifications.appointment_delay.push.title` / `.body`            | Titre : Le salon a du retard<br>Corps : {salon_name} a du retard sur votre rendez-vous de {appointment_time}. Venez vers {time}.                                                                                           | Exemple indicatif APP_FLOW F-C13 : « Le salon a du retard, venez vers 14h20 »                                                                                                                                                               |
| `notifications.appointment_delay.sms`                             | {salon_name} a du retard sur votre rendez-vous de {appointment_time} : venez vers {time}. Suivi : {link}                                                                                                                   | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues, accents translittérés (TRD §9)                                                                                                                                    |
| `notifications.estimate_changed.push.title` / `.body`             | Titre : Votre heure de passage change<br>Corps : Passage prévu vers {time} chez {salon_name}. {reason}                                                                                                                     | Partagée ; message d'anticipation (E17) ; raisons `common.change_reason.your_appointment_changed` « Le salon a modifié votre rendez-vous. » et `common.change_reason.appointment_changed` « Le salon a modifié un rendez-vous avant vous. » |
| `notifications.cancelled_by_salon.push` / `.sms`                  | Push : voir `notifications.cancelled_by_salon.push.*` (2 textes) et `notifications.cancelled_by_salon.reason.*` (motif)<br>SMS : {salon_name} a annulé votre place : {reason}. Toutes nos excuses. Salons proches : {link} | Partagée avec S-12 ; SMS ≤ 160 caractères GSM-7                                                                                                                                                                                             |
| `errors.queue.appointment_overlap`                                | Ce créneau chevauche un autre rendez-vous de ce coiffeur. Choisissez une autre heure ou un autre coiffeur.                                                                                                                 | —                                                                                                                                                                                                                                           |
| `errors.queue.outside_opening_hours`                              | Cette heure est en dehors des horaires d'ouverture du salon. Choisissez une heure pendant l'ouverture.                                                                                                                     | Partagée avec U-14                                                                                                                                                                                                                          |
| `errors.queue.appointment_not_today`                              | « Un rendez-vous ne peut être saisi que pour aujourd'hui. »                                                                                                                                                                | E26                                                                                                                                                                                                                                         |
| `errors.queue.ticket_other_salon`                                 | « Aucun ticket de votre salon ne correspond. Vérifiez le code ou le client concerné. »                                                                                                                                     | TRD v0.5 §6.2                                                                                                                                                                                                                               |
| `errors.queue.invalid_payload`                                    | « Certaines informations sont incomplètes ou incorrectes. Vérifiez-les, puis réessayez. »                                                                                                                                  | Annulation sans motif (E29)                                                                                                                                                                                                                 |
| `errors.queue.appointment_in_past`                                | Cette heure est déjà passée. Choisissez une heure à venir.                                                                                                                                                                 | —                                                                                                                                                                                                                                           |
| `errors.queue.appointment_not_editable`                           | Ce rendez-vous ne peut plus être modifié ni annulé, car il n'est plus en attente.                                                                                                                                          | —                                                                                                                                                                                                                                           |
| `errors.queue.already_has_active_ticket`                          | Ce numéro a déjà une place en cours. Une seule place à la fois est possible.                                                                                                                                               | Partagée ; ne nomme pas l'autre salon                                                                                                                                                                                                       |
| `errors.queue.invalid_phone`                                      | Ce numéro n'est pas valide. Saisissez un numéro de téléphone français.                                                                                                                                                     | Partagée avec S-10                                                                                                                                                                                                                          |
| `errors.queue.rate_limited`                                       | Trop de demandes en peu de temps. Patientez quelques minutes, puis réessayez.                                                                                                                                              | Partagée                                                                                                                                                                                                                                    |
| `errors.queue.forbidden`                                          | Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez.                                                                                                              | Partagée                                                                                                                                                                                                                                    |
| `errors.validation.first_name`                                    | Indiquez un prénom de 30 caractères au plus.                                                                                                                                                                               | Partagée avec S-10 ; 1 à 30 caractères                                                                                                                                                                                                      |

## Questions ouvertes

- **Résolu le 19/10** (E17, K18, K34 ; PRD §5.1) : l'alerte de retard `appointment_delay` est un message indispensable ; elle part sans « Me prévenir ». Le consentement est porté par le ticket (`notifications_consent_at`) et activable depuis le lien de suivi. Avis RGPD encore à obtenir (PRD §9 n° 9).
- **Résolu le 19/10** (E17) : `cancelled_by_salon` est un message indispensable ; `estimate_changed` est un message d'anticipation, soumis à « Me prévenir ».
- **Résolu le 19/10** (E28, E29 ; TRD §6.2) : l'annulation d'un rendez-vous utilise le modèle `cancelled_by_salon`, qui part par push et SMS, hors plafond.
- **TRD §6.2 / APP_FLOW F-M13** : quelle notification part quand un rendez-vous est modifié (« client prévenu s'il est joignable ») ? `estimate_changed` est push seulement (PRD §5.4) et, depuis E17, soumis à « Me prévenir » : un client de rendez-vous saisi, qui n'a que le SMS et pas la case, n'apprendrait jamais que son rendez-vous a été déplacé. Est-ce voulu ? Et seulement si l'heure change de 10 min ou plus (TRD), ou pour toute modification (APP_FLOW) ?
- **Résolu le 19/10** (E29, PRD §5.1 ; TRD §6.2) : `cancel_appointment` exige un `reason_code` choisi dans une liste (pour l'instant `removal_reason`, liste dédiée 🟡), envoyé au client.
- **Résolu le 19/10** (TRD v0.5 §6.2) : `update_appointment` a `phone?`. **Reste ouvert (TRD, nouveau)** : ajouter un téléphone à un rendez-vous saisi envoie-t-il le SMS avec le lien de suivi, comme à la création ?
- **APP_FLOW F-M13 / PRD §5.3** : sans jamais réafficher le numéro, le formulaire peut-il indiquer qu'un téléphone a été saisi (le gérant sait alors si le client sera prévenu) ?
- **Résolu le 19/10** (E26, TRD §6.2) : un rendez-vous d'un autre jour est refusé avec `appointment_not_today`.
- **Résolu le 19/10** (K15, TRD §6.2) : le chevauchement se mesure sur la durée de la prestation (30 min sans prestation) ; deux rendez-vous bout à bout sont acceptés.
- **Résolu en partie le 19/10** (E26) : saisie acceptée pour un coiffeur en pause, et pour un coiffeur absent avec un avertissement. **Reste ouvert (PRD / TRD)** : coiffeur en fin de journée ou désactivé, ou heure après sa fin de journée (`shift_end_at`) ? Et forme de l'avertissement (🟡 TRD §6.2) et son texte (absent du dictionnaire).
- **Résolu le 19/10** (K15, TRD §6.2) : 15 min de tolérance pour un rendez-vous juste passé. **Reste ouvert (TRD)** : la limite de 15 min est-elle incluse ?
- **Résolu le 19/10** (TRD v0.5 §6.2) : `update_appointment` et `cancel_appointment` renvoient `ticket_other_salon` pour un rendez-vous d'un autre salon.
- **Résolu le 19/10** (E30, PRD §5.2) : « en retard de X min » est le retard du salon sur l'heure du rendez-vous, affiché dès 10 min.
- **Résolu le 19/10** (E23, PRD §5.2) : un saut de plusieurs paliers donne une seule alerte avec le retard du moment ; pas d'alerte de rattrapage ; plus d'alerte une fois le client arrivé ou appelé.
- **APP_FLOW F-C13 / BACKEND_SCHEMA §4.13** : les alertes de retard visent l'heure « 10 min ou plus après l'heure du rendez-vous ». Un client avec rendez-vous qui reçoit une alerte de retard reçoit-il aussi `estimate_changed` pour le même écart (doublon) ?
- **Résolu le 19/10** (K15, TRD §6.2) : `create_appointment` est limité à 60 créations par heure et par salon.
- **Résolu le 19/10** (dictionnaire REQ-3) : les messages d'erreur, les SMS, les push et les libellés existent, sauf l'avertissement « coiffeur absent » (E26).
- **TRD / APP_FLOW (nouveau)** : `update_appointment` garde `member_id?` (« Modifier », scénario 15), qui change le coiffeur d'un rendez-vous sans la règle de non-recul ni l'accord du client, alors que E27 veut qu'un rendez-vous se réaffecte « de la même façon » que les autres tickets (`reassign_ticket`, S-13). Faut-il retirer `member_id?` de `update_appointment`, ou lui appliquer la même règle ?
