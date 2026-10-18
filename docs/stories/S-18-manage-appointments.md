# S-18 · Saisir, modifier et annuler les rendez-vous du jour

**En tant que** gérant, **je veux** saisir, modifier et annuler les rendez-vous du jour de mes coiffeurs (prénom, heure, prestation, coiffeur, téléphone facultatif), **afin que** les rendez-vous pris hors de Zelaté occupent leur créneau dans la file et que les clients de dernière minute ne les retardent pas.

- Priorité : I (PRD §5.3)
- Règles appliquées : H10 et PRD §5.2 « Distribution » règles 6 à 8 (R1, R2, R3, R7 : marge de 0 min) ; PRD §5.2 transitions 1 et 6 ; « Prévenir avant de partir » (PRD §5.2, R5) ; H3 et PRD §5.4 (3 SMS maximum par ticket) ; H6 et PRD §5.1 (numéro jamais affiché au salon ni au coiffeur) ; R4, R6 (saisie par le gérant et par chaque coiffeur pour ses clients) ; un seul ticket actif par numéro (PRD §5.1) ; changement d'heure de 10 min ou plus expliqué (PRD §5.1, E11) ; isolation par salon (PRD §5.1)
- Parcours : F-M13 (`/dashboard/appointments`) ; F-M6 (bouton « Rendez-vous », liste globale) ; côté client F-C13 et F-C10 (lien SMS) ; événements « Ticket créé » et « Retard sur un rendez-vous » (APP_FLOW §7)
- Commandes et données : `create_appointment`, `update_appointment`, `cancel_appointment` · tables `tickets` (`kind` = `appointment`, `appointment_source` = `salon_entry`, `channel` = `front_desk`, `scheduled_at`, `assigned_member_id`, `display_name`, `service_id`, `planned_duration_minutes`, `created_by_member_id`, `appointment_delay_warned_steps`, `cancel_reason`), `private.ticket_contacts` (`phone_e164`, `phone_hash`, `is_active`), `notifications` (`ticket_created`, `appointment_delay`, `estimate_changed`, `cancelled_by_salon`), `ticket_events` (`created`, `appointment_updated`, `cancelled`, `appointment_delay_warned`), `private.processed_commands` · canaux `salon:{salon_id}`, `ticket-token:{token_key}`

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
- **Et** Léa reçoit un SMS avec l'heure du rendez-vous, l'heure de passage, le code du ticket et le lien de suivi `/t/:shortCode`
- **Et** ce SMS compte comme le SMS 1 sur 3 du ticket
- **Et** Léa ouvre son rendez-vous par le lien, sans se connecter (F-C10)

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

### 7. Chevauchement avec un autre rendez-vous du coiffeur
- **Étant donné** un rendez-vous d'Inès déjà saisi à 14h30
- **Quand** Nadia saisit pour Inès un rendez-vous qui chevauche celui-ci
- **Alors** le message de l'erreur `queue.appointment_overlap` s'affiche
- **Et** aucun rendez-vous n'est créé
- **Et** aucun SMS n'est envoyé

### 8. Heure hors des horaires d'ouverture
- **Étant donné** la boîte de saisie ouverte
- **Quand** l'heure choisie tombe hors des horaires d'ouverture du jour
- **Alors** le sélecteur d'heure ne la propose pas (`TimePicker` limité aux horaires d'ouverture, DESIGN_SYSTEM)
- **Quand** une commande `create_appointment` arrive quand même avec cette heure
- **Alors** elle est refusée avec `queue.outside_opening_hours`
- **Et** aucun rendez-vous n'est créé

### 9. Heure déjà passée
- **Étant donné** qu'il est 15h10
- **Quand** Nadia saisit un rendez-vous à 15h00
- **Alors** le message de l'erreur `queue.appointment_in_past` s'affiche
- **Et** aucun rendez-vous n'est créé

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
- **Et** Léa est prévenue, puisque son heure change de 10 min ou plus
- **Et** l'événement `appointment_updated` est inscrit au journal, sans prénom (K10)

### 15. Modifier le coiffeur, la prestation ou le prénom
- **Étant donné** le rendez-vous de Léa au statut « En attente »
- **Quand** Nadia change le coiffeur pour Karim, la prestation ou le prénom, et valide
- **Alors** le rendez-vous est modifié et passe dans la file de Karim s'il a changé de coiffeur
- **Et** il disparaît de la file d'Inès en moins de 2 s
- **Et** le changement est contrôlé comme une saisie (chevauchement, horaires, heure passée)

### 16. Modification qui crée un chevauchement
- **Étant donné** deux rendez-vous d'Inès, à 14h30 et à 16h00
- **Quand** Nadia déplace celui de 16h00 sur le créneau de celui de 14h30
- **Alors** le message de l'erreur `queue.appointment_overlap` s'affiche
- **Et** le rendez-vous garde son heure de 16h00

### 17. Annuler un rendez-vous
- **Étant donné** le rendez-vous de Léa au statut « En attente », saisi avec téléphone
- **Quand** Nadia clique sur « Annuler »
- **Alors** la commande `cancel_appointment` est envoyée
- **Et** le ticket passe au statut « Annulé » avec le motif `removed_by_salon`
- **Et** le rendez-vous disparaît de la file d'Inès et de la liste globale en moins de 2 s
- **Et** Léa reçoit la notification `cancelled_by_salon`
- **Et** les clients suivants avancent
- **Et** l'événement `cancelled` est inscrit au journal, avec Nadia comme actrice

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
- **Et** ce scénario reste soumis à la question n° 9 du PRD §9 (consentement, voir questions)

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
- **Étant donné** que le plafond de création de tickets est atteint
- **Quand** Nadia saisit un rendez-vous
- **Alors** le message de l'erreur `queue.rate_limited` s'affiche
- **Et** aucun rendez-vous n'est créé

### 26. Isolation par salon
- **Étant donné** Nadia, gérante du salon A
- **Quand** une commande `update_appointment` ou `cancel_appointment` est envoyée depuis son compte pour un rendez-vous du salon B
- **Alors** elle est refusée
- **Et** le rendez-vous du salon B ne change pas

### 27. Connexion perdue
- **Étant donné** le dashboard qui affiche « Connexion perdue »
- **Quand** Nadia regarde la page des rendez-vous
- **Alors** « + Rendez-vous », « Modifier » et « Annuler » sont désactivés
- **Et** aucune commande n'est envoyée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.appointments.title` | « Rendez-vous du jour » | Libellé indicatif (APP_FLOW §2.2, F-M13) |
| `pro-manager.appointments.new` | « + Rendez-vous » | Libellé indicatif (APP_FLOW F-M13) ; raccourci `R` indiqué |
| `pro-manager.appointments.form.first_name` | « Prénom » | 30 caractères maximum |
| `pro-manager.appointments.form.time` | _À rédiger_ | Pas de 5 min, horaires d'ouverture |
| `pro-manager.appointments.form.stylist` | « Coiffeur » | — |
| `pro-manager.appointments.form.service` | « Prestation » | Facultative |
| `pro-manager.appointments.form.phone` | « Téléphone » | Facultatif, +33 ; jamais prérempli en modification |
| `pro-manager.appointments.form.submit` | _À rédiger_ | — |
| `pro-manager.appointments.edit` | « Modifier » | Libellé indicatif (APP_FLOW F-M13) |
| `pro-manager.appointments.cancel` | « Annuler » | Libellé indicatif (APP_FLOW F-M13) |
| `pro-manager.appointments.status.upcoming` | « À venir » | APP_FLOW F-M13 |
| `pro-manager.appointments.status.late` | « En retard de {minutes} min » | APP_FLOW F-M13 ; ICU |
| `pro-manager.appointments.status.arrived` | « Arrivé » | APP_FLOW F-M13 |
| `pro-manager.appointments.status.pending_confirmation` | « À confirmer » | APP_FLOW F-M13, DESIGN_SYSTEM §2.4 |
| `common.appointment.badge` | « RDV {time} » | DESIGN_SYSTEM §2.4 (`AppointmentBadge`) |
| `common.appointment.badge_late` | « RDV {time} · +{minutes} min » | DESIGN_SYSTEM §2.4 |
| `pro-manager.appointments.empty` | _À rédiger_ | État vide (APP_FLOW §8) |
| `notifications.ticket_created.sms` | _À rédiger_ | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues (TRD §9) ; variante rendez-vous : heure du rendez-vous, heure de passage, code, lien `zelate.fr/t/xxxxxxxx` (APP_FLOW §7) ; partagée avec S-10 |
| `notifications.appointment_delay.push.title` / `.body` | _À rédiger_ | Exemple indicatif APP_FLOW F-C13 : « Le salon a du retard, venez vers 14h20 » |
| `notifications.appointment_delay.sms` | _À rédiger_ | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues, accents translittérés (TRD §9) |
| `notifications.estimate_changed.push.title` / `.body` | _À rédiger_ | Partagée ; raison « rendez-vous déplacé » à prévoir |
| `notifications.cancelled_by_salon.push` / `.sms` | _À rédiger_ | Partagée avec S-12 ; SMS ≤ 160 caractères GSM-7 |
| `errors.queue.appointment_overlap` | _À rédiger_ | — |
| `errors.queue.outside_opening_hours` | _À rédiger_ | Partagée avec U-14 |
| `errors.queue.appointment_in_past` | _À rédiger_ | — |
| `errors.queue.appointment_not_editable` | _À rédiger_ | — |
| `errors.queue.already_has_active_ticket` | _À rédiger_ | Partagée ; ne nomme pas l'autre salon |
| `errors.queue.invalid_phone` | _À rédiger_ | Partagée avec S-10 |
| `errors.queue.rate_limited` | _À rédiger_ | Partagée |
| `errors.queue.forbidden` | _À rédiger_ | Partagée |
| `errors.validation.first_name` | _À rédiger_ | Partagée avec S-10 ; 1 à 30 caractères |

## Questions ouvertes
- **PRD §9 n° 9 (Ely, avec avis RGPD)** : un rendez-vous saisi avec téléphone n'a aucun consentement « Me prévenir ». Or BACKEND_SCHEMA §4.16 passe en `skipped` (`no_consent`) tout modèle autre que `ticket_created` et `your_turn` sans `tracking_consent_at`, et ce consentement est rangé dans `profiles`, que ce client n'a pas. En l'état, les alertes de retard R5 (scénarios 20 à 22) ne partiraient jamais. L'alerte de retard compte-t-elle parmi les messages indispensables, ou faut-il recueillir l'accord du client (par exemple au premier SMS) ?
- **PRD §5.1 / BACKEND_SCHEMA §4.16** : la même règle de consentement bloquerait `cancelled_by_salon` (scénario 17) et `estimate_changed` (scénario 14) pour un client sans consentement, alors que PRD §5.4 dit que l'annulation par le salon part « toujours ». `cancelled_by_salon` est-il un message indispensable ? (Touche aussi S-12.)
- **PRD §5.4** : le tableau ne cite que « retrait, fin de journée » pour « Annulation par le salon ». L'annulation d'un rendez-vous (`cancel_appointment`) part-elle aussi par push **et** SMS, hors plafond ?
- **TRD §6.2 / APP_FLOW F-M13** : quelle notification part quand un rendez-vous est modifié (« client prévenu s'il est joignable ») : `estimate_changed` (push seulement, PRD §5.4), donc rien pour un client qui n'a que le SMS ? Et seulement si l'heure change de 10 min ou plus (TRD), ou pour toute modification (APP_FLOW) ?
- **PRD §5.1 (décisions d'Ely)** : « retrait de la file toujours justifié au client », mais `cancel_appointment` n'a pas de motif (`reason_code`), contrairement à `remove_ticket`. Faut-il un motif ?
- **TRD §6.2** : `update_appointment` n'a pas de `phone?` ; le gérant ne peut donc ni ajouter ni corriger un téléphone après la saisie. Voulu ? Pourtant `invalid_phone` et `already_has_active_ticket` sont listés pour `update_appointment`.
- **APP_FLOW F-M13 / PRD §5.3** : sans jamais réafficher le numéro, le formulaire peut-il indiquer qu'un téléphone a été saisi (le gérant sait alors si le client sera prévenu) ?
- **PRD §5.3 « du jour » / TRD §6.2** : `scheduled_at` est un horodatage complet. Que renvoie `create_appointment` pour une heure d'un autre jour (demain) ? Aucun code n'est prévu.
- **BACKEND_SCHEMA §4.13** : comment le chevauchement est-il mesuré : heure du rendez-vous plus durée de la prestation (30 min sans prestation) ? Deux rendez-vous bout à bout (14h30-15h00 puis 15h00) se chevauchent-ils ?
- **TRD §6.2 / PRD §5.2** : peut-on saisir un rendez-vous pour un coiffeur absent, en fin de journée ou désactivé, ou pour une heure après sa fin de journée ? Aucun code (`stylist_unavailable`) n'est prévu pour `create_appointment`.
- **TRD §6.2** : un gérant qui saisit à 14h05 un rendez-vous de 14h00 oublié reçoit `appointment_in_past`. Le client doit alors se signaler (S-19). Voulu, ou faut-il une tolérance ?
- **TRD §6.2** : `confirm_appointment` a un code `ticket_other_salon`, mais `update_appointment` et `cancel_appointment` non. Un rendez-vous d'un autre salon renvoie-t-il `forbidden` (scénario 26) ?
- **APP_FLOW F-M13 / DESIGN_SYSTEM §2.4** : « en retard de X min » désigne-t-il le retard du salon (heure de passage après l'heure du rendez-vous, `AppointmentBadge` « +20 min » au-delà de 10 min) ou le retard du client qui n'est pas arrivé à l'heure ? À partir de combien de minutes s'affiche-t-il ?
- **APP_FLOW F-C13 / BACKEND_SCHEMA §4.13** : les alertes de retard visent l'heure « 10 min ou plus après l'heure du rendez-vous ». Un client avec rendez-vous qui reçoit une alerte de retard reçoit-il aussi `estimate_changed` pour le même écart (doublon) ?
- **TRD §6.2** : le plafond de création de tickets (`rate_limits`) n'a pas de valeur chiffrée et ne dit pas s'il s'applique à `create_appointment`.
- **Textes** : tous les messages d'erreur, les SMS et push, le libellé du champ heure, du bouton de validation et de l'état vide sont absents des documents.
