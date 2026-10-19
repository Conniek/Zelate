# C-11 · Saisir ses rendez-vous et confirmer ceux qui se signalent pour lui

**En tant que** coiffeur, **je veux** saisir depuis mon téléphone les rendez-vous de mes propres clients et confirmer d'un geste ceux qui se signalent pour moi en arrivant, **afin que** ma file tienne compte de mes rendez-vous sans passer par le gérant.

- Priorité : I (PRD §5.3)
- Règles appliquées : R6 (le gérant et chaque coiffeur pour ses clients) et R4 (PRD §11) ; confirmation d'un geste par le gérant ou le coiffeur concerné (PRD §5.1, décisions d'Ely) ; H10 et PRD §5.2 « Distribution » règles 6 à 8 ; PRD §5.2 transitions 1, 1b et 6 ; H6 (numéro jamais affiché) ; aucune donnée client stockée sur le téléphone du coiffeur (PRD §5.1, §6) ; H3 (3 SMS maximum par ticket) ; PRD §5.1 « Saisir un rendez-vous » (jour même, dans les horaires du salon ; accepté pour un coiffeur en pause, avertissement s'il est absent, E26 ; annuler ou refuser demande un motif choisi dans une liste, envoyé au client, E29), « Un rendez-vous à confirmer peut être annulé par le client ; le gérant et le coiffeur reçoivent un rappel après 10 min ; il est annulé avec excuses à la fermeture » (E19), « Me prévenir » (inscription, annulation, rendez-vous confirmé ou refusé = messages indispensables ; lien pour activer « Me prévenir », E17) ; PRD §7.1 principes 2 et 4 (double déclenchement refusé, actions bloquées hors connexion)
- Parcours : F-S10 (`/stylist/appointments`) ; bandeau « Rendez-vous à confirmer » et bouton « Mes rendez-vous » de F-S4 (`/stylist/queue`) ; événements « Ticket créé », « Rendez-vous signalé », « Rendez-vous confirmé ou refusé » (APP_FLOW §7)
- Commandes et données : `create_appointment` (un coiffeur ne vise que lui-même, sinon `forbidden` ; codes `queue.appointment_overlap`, `queue.outside_opening_hours`, `queue.appointment_in_past`, `queue.appointment_not_today`, `queue.already_has_active_ticket`, `queue.invalid_phone` ; 15 min de tolérance pour un rendez-vous juste passé ; 60 créations par heure et par salon, `queue.rate_limited`), `update_appointment` (mêmes codes, plus `queue.appointment_not_editable`, `queue.ticket_other_salon`), `cancel_appointment` (`reason_code` obligatoire, E29 ; codes `queue.appointment_not_editable`, `queue.ticket_other_salon`, motif absent `queue.invalid_payload`), `confirm_appointment` (`reason_code` obligatoire si `reject` ; codes `queue.already_resolved`, `queue.ticket_other_salon`, `queue.member_required`, `queue.invalid_merge_target`, `queue.appointment_overlap`) · lecture `get_stylist_queue` (rendez-vous à confirmer et rendez-vous du jour inclus) · tables `tickets` (`kind` = `appointment`, `scheduled_at`, `assigned_member_id` fixé dès la saisie, K39, `created_by_member_id`, `confirmed_by_member_id`, `confirmation_reminder_sent_at`, `removal_reason`, `status`), `private.ticket_contacts` (K28), `notifications` (`ticket_created` variante `appointment`, `cancelled_by_salon`, `appointment_confirmed`, `appointment_rejected`, `appointment_checked_in` et sa variante `reminder`), `ticket_events` (`created`, `appointment_updated`, `cancelled`, `appointment_confirmed`, `appointment_rejected`, `appointment_merged`), `private.processed_commands` · canal `salon:{salon_id}`

## Scénarios

### 1. Voir mes rendez-vous du jour
- **Étant donné** Inès, coiffeuse connectée sur son téléphone, sur `/stylist/queue`
- **Quand** elle touche « Mes rendez-vous »
- **Alors** elle arrive sur `/stylist/appointments`
- **Et** elle voit ses rendez-vous du jour par heure : prénom, prestation, statut (à venir, en retard de X min, à confirmer)
- **Et** les rendez-vous saisis pour elle par le gérant y figurent aussi
- **Et** aucun rendez-vous d'un autre coiffeur n'y figure

### 2. Saisir un rendez-vous pour moi
- **Étant donné** Inès sur `/stylist/appointments`
- **Quand** elle touche « + Rendez-vous », saisit « Léa », choisit 15h00 et la prestation « Coupe femme », puis valide
- **Alors** le formulaire ne lui demande pas de coiffeur
- **Et** la commande `create_appointment` part avec son propre `member_id`
- **Et** un rendez-vous à 15h00 est ajouté à sa file, avec le badge « RDV 15h00 »
- **Et** le rendez-vous apparaît sur le dashboard du gérant en moins de 2 s
- **Et** Inès est enregistrée comme membre qui a saisi (`created_by_member_id`)
- **Et** l'événement `created` est inscrit au journal, avec Inès comme actrice

### 3. Saisie avec téléphone
- **Étant donné** le formulaire « + Rendez-vous » ouvert
- **Quand** Inès saisit aussi le téléphone de Léa et valide
- **Alors** Léa reçoit le SMS « {salon_name} : rendez-vous de 15h00 enregistré, passage prévu vers {time}. Code {code}. Suivi : {link} » (message indispensable, sans case cochée, E17)
- **Et** ce SMS compte comme le SMS 1 sur 3 du ticket
- **Et** la page de suivi ouverte par ce lien lui permet d'activer « Me prévenir » (`set_notifications_consent`, F-C10, E17)
- **Et** le numéro est rangé dans le contact privé du ticket (`private.ticket_contacts`, K28)

### 4. Téléphone jamais réaffiché (H6)
- **Étant donné** un rendez-vous qu'Inès a saisi avec téléphone
- **Quand** elle le rouvre, le modifie, ou consulte sa file
- **Alors** le numéro n'est affiché nulle part
- **Et** le gérant ne le voit pas non plus

### 5. Un coiffeur ne saisit que pour lui-même
- **Étant donné** Inès connectée sur son téléphone
- **Quand** une commande `create_appointment` est envoyée depuis son compte avec le `member_id` de Karim
- **Alors** la commande est refusée avec `queue.forbidden` (TRD §6.2)
- **Et** aucun rendez-vous n'est créé chez Karim

### 6. Sans prestation
- **Étant donné** le formulaire « + Rendez-vous » ouvert
- **Quand** Inès saisit un rendez-vous sans prestation
- **Alors** le rendez-vous est créé avec une durée de calcul de 30 min (BACKEND_SCHEMA §4.13)

### 7. Chevauchement
- **Étant donné** un rendez-vous d'Inès déjà saisi à 15h00
- **Quand** elle saisit un rendez-vous qui le chevauche
- **Alors** le message de l'erreur `queue.appointment_overlap` s'affiche
- **Et** aucun rendez-vous n'est créé

### 8. Heure hors horaires ou déjà passée
- **Étant donné** le formulaire « + Rendez-vous » ouvert
- **Quand** Inès choisit une heure
- **Alors** seules des heures par pas de 5 min, dans les horaires d'ouverture du jour, lui sont proposées
- **Quand** une commande arrive avec une heure hors horaires
- **Alors** elle est refusée avec `queue.outside_opening_hours`
- **Quand** une commande arrive avec une heure passée de plus de 15 min
- **Alors** elle est refusée avec `queue.appointment_in_past`
- **Quand** une commande arrive avec un autre jour qu'aujourd'hui
- **Alors** elle est refusée avec `queue.appointment_not_today` (E26)

### 8 bis. Rendez-vous juste passé (tolérance de 15 min)
- **Étant donné** il est 14h10
- **Quand** Inès saisit un rendez-vous à 14h00 pour un client arrivé en retard
- **Alors** le rendez-vous est créé à 14h00

### 8 ter. Coiffeur en pause (E26)
- **Étant donné** Inès « En pause »
- **Quand** elle saisit un rendez-vous pour elle à 16h00
- **Alors** le rendez-vous est créé, sans avertissement

### 8 quater. Coiffeur absent (E26)
- **Étant donné** Inès déclarée « Absent » par le gérant
- **Quand** une commande `create_appointment` pour elle arrive
- **Alors** le rendez-vous est créé avec un avertissement (forme 🟡, proposition `data.warnings: ['stylist_absent']`, TRD §6.2 ; texte à rédiger)

### 9. Numéro invalide ou déjà sur un ticket actif
- **Étant donné** le formulaire « + Rendez-vous » ouvert
- **Quand** Inès saisit un numéro mal formé ou non +33
- **Alors** le message de `queue.invalid_phone` s'affiche sous le champ « Téléphone »
- **Quand** elle saisit un numéro qui a déjà un ticket actif, dans ce salon ou dans un autre
- **Alors** le message de `queue.already_has_active_ticket` s'affiche, sans nommer l'autre salon
- **Et** aucun rendez-vous n'est créé et aucun SMS n'est envoyé

### 10. Modifier un de mes rendez-vous
- **Étant donné** le rendez-vous de Léa à 15h00 chez Inès, au statut « En attente »
- **Quand** Inès touche « Modifier », choisit 15h30 et valide
- **Alors** la commande `update_appointment` part
- **Et** le rendez-vous passe à 15h30 dans sa file et sur le dashboard, en moins de 2 s
- **Et** si Léa a coché « Me prévenir », elle reçoit un changement d'heure avec la raison `your_appointment_changed` (« Le salon a modifié votre rendez-vous. »), puisque son heure change de 10 min ou plus (sans case cochée : voir questions)
- **Et** l'événement `appointment_updated` est inscrit au journal, sans prénom

### 11. Annuler un de mes rendez-vous
- **Étant donné** le rendez-vous de Léa chez Inès, au statut « En attente »
- **Quand** Inès touche « Annuler », choisit un motif dans la liste (par exemple `client_request`) et confirme « Annuler le rendez-vous »
- **Alors** la commande `cancel_appointment` part avec `reason_code` = `client_request`
- **Et** le ticket passe à « Annulé » (`cancel_reason` = `removed_by_salon`, `removal_reason` = `client_request`)
- **Et** le rendez-vous disparaît de sa file et du dashboard en moins de 2 s
- **Et** Léa, si son numéro est connu, reçoit `cancelled_by_salon` par push et par SMS, hors plafond, avec le motif « à votre demande », même sans « Me prévenir » (E17, E29)
- **Et** l'événement `cancelled` est inscrit au journal, avec Inès comme actrice et le motif (`reason_code`)

### 11 bis. Annuler sans motif (E29)
- **Étant donné** le rendez-vous de Léa chez Inès, au statut « En attente »
- **Quand** une commande `cancel_appointment` arrive sans `reason_code`
- **Alors** elle est refusée avec `queue.invalid_payload`
- **Et** le rendez-vous reste « En attente »
- **Et** aucune notification n'est créée pour Léa

### 12. Rendez-vous déjà appelé
- **Étant donné** le rendez-vous de Léa au statut « Appelé » ou « En prestation »
- **Quand** Inès regarde ce rendez-vous
- **Alors** « Modifier » et « Annuler » ne lui sont pas proposés
- **Quand** une commande `update_appointment` ou `cancel_appointment` arrive quand même
- **Alors** elle est refusée avec `queue.appointment_not_editable`

### 13. Rendez-vous d'un autre coiffeur
- **Étant donné** un rendez-vous de Karim
- **Quand** une commande `update_appointment` ou `cancel_appointment` pour ce rendez-vous est envoyée depuis le compte d'Inès
- **Alors** elle est refusée avec `queue.forbidden`
- **Et** le rendez-vous de Karim ne change pas

### 14. Un client se signale pour moi : bandeau dans ma file
- **Étant donné** Inès sur `/stylist/queue`
- **Quand** Léa se signale par le QR de l'affiche pour un rendez-vous à 14h30 avec Inès
- **Alors** le bandeau « Rendez-vous à confirmer » apparaît en moins de 2 s, avec « Léa dit avoir rendez-vous à 14h30 »
- **Et** l'arrivée du bandeau est annoncée aux lecteurs d'écran (`aria-live="polite"`)
- **Et** le rendez-vous apparaît au statut « À confirmer » dans « Mes rendez-vous »
- **Et** il n'est pas proposé par « Appeler » tant qu'il n'est pas confirmé
- **Et** une notification push « Rendez-vous à confirmer » est créée pour Inès et une pour le gérant (`appointment_checked_in`, une clé par destinataire, K21), hors consentement et hors plafond

### 14 bis. Rappel après 10 min sans confirmation (E19)
- **Étant donné** Léa, signalée à 14h20 pour un rendez-vous à 14h30 avec Inès, toujours « À confirmer »
- **Quand** il est 14h30, à 60 s près
- **Alors** Inès et le gérant reçoivent le push « Toujours à confirmer » : « Léa attend votre confirmation depuis 10 min (rendez-vous à 14h30). »
- **Et** le rappel est horodaté (`confirmation_reminder_sent_at`)
- **Quand** il est 14h40, toujours sans confirmation
- **Alors** aucun second rappel n'est envoyé

### 14 ter. Le client annule son signalement (E19)
- **Étant donné** le bandeau « Rendez-vous à confirmer » de Léa chez Inès
- **Quand** Léa annule sa place depuis son ticket (`cancel_ticket`)
- **Alors** le ticket de Léa passe à « Annulé » (`client_cancelled`)
- **Et** le bandeau disparaît chez Inès en moins de 2 s

### 14 quater. Signalement encore à confirmer à la fermeture (E19)
- **Étant donné** Léa, toujours « À confirmer » chez Inès
- **Quand** arrive la dernière fermeture de la journée
- **Alors** le ticket de Léa passe à « Annulé » (`cancel_reason` = `end_of_day`)
- **Et** Léa reçoit le message d'excuse de fin de journée (`cancelled_by_salon`, variante `end_of_day`)
- **Et** le bandeau disparaît chez Inès

### 15. Confirmer depuis le bandeau
- **Étant donné** le bandeau « Rendez-vous à confirmer » de Léa
- **Quand** Inès touche « Confirmer »
- **Alors** la commande `confirm_appointment` part avec `decision` = `confirm`
- **Et** le rendez-vous entre dans sa file à 14h30
- **Et** le bandeau disparaît chez Inès et sur le dashboard du gérant
- **Et** Inès est enregistrée comme membre qui confirme (`confirmed_by_member_id`)
- **Et** Léa voit son heure de passage sur son ticket
- **Et** Léa reçoit `appointment_confirmed` par push, même sans « Me prévenir » (E17)

### 16. Confirmer en fusionnant avec un rendez-vous que j'avais saisi
- **Étant donné** un rendez-vous « Léa » à 14h30 qu'Inès avait saisi elle-même
- **Et** Léa qui se signale pour 14h30 avec Inès
- **Quand** Inès confirme depuis « Mes rendez-vous », avec « Regrouper et confirmer »
- **Alors** la commande `confirm_appointment` part avec `merge_into_ticket_id` = le rendez-vous saisi
- **Et** un seul rendez-vous de Léa reste dans sa file : celui qu'Inès avait saisi, qui reprend le client, le consentement et le numéro du signalement (K14)
- **Et** le ticket signalé passe à « Annulé » (`cancel_reason` = `merged`)
- **Et** l'événement `appointment_merged` est inscrit au journal

### 16 bis. Fusion impossible
- **Étant donné** le rendez-vous « Léa » qu'Inès avait saisi, déjà appelé ou annulé
- **Quand** une commande `confirm_appointment` arrive avec `merge_into_ticket_id` = ce rendez-vous
- **Alors** elle est refusée avec `queue.invalid_merge_target`
- **Et** le signalement de Léa reste « À confirmer »

### 17. Refuser
- **Étant donné** le bandeau « Rendez-vous à confirmer » de Léa, qui n'a pas rendez-vous avec Inès
- **Quand** Inès touche « Refuser », choisit un motif dans la liste et valide
- **Alors** la commande `confirm_appointment` part avec `decision` = `reject` et le `reason_code` choisi
- **Et** le bandeau disparaît chez Inès et sur le dashboard
- **Et** Léa reçoit `appointment_rejected` par push, avec le motif et « Rejoindre la file », sans SMS, même sans « Me prévenir » (E17, E29)
- **Quand** une commande `reject` arrive sans `reason_code`
- **Alors** elle est refusée avec `queue.invalid_payload`
- **Et** le signalement reste « À confirmer »

### 18. Déjà traité par le gérant
- **Étant donné** le bandeau de Léa, que le gérant vient de confirmer ou de refuser
- **Quand** Inès touche « Confirmer » ou « Refuser » avant le rafraîchissement
- **Alors** la commande est refusée avec `queue.already_resolved`
- **Et** le bandeau disparaît
- **Et** la décision du gérant est conservée

### 19. Signalement pour un autre coiffeur
- **Étant donné** un client qui se signale pour Karim
- **Quand** Inès regarde sa file
- **Alors** aucun bandeau ne lui est montré pour ce client
- **Quand** une commande `confirm_appointment` pour ce ticket est envoyée depuis son compte
- **Alors** elle est refusée avec `queue.forbidden`

### 20. Double appui
- **Étant donné** le bandeau de Léa, ou le formulaire « + Rendez-vous » rempli
- **Quand** Inès touche deux fois très vite « Confirmer » ou valide deux fois
- **Alors** le bouton est désactivé pendant l'envoi
- **Et** une seule confirmation ou un seul rendez-vous est enregistré
- **Et** une seule notification part

### 21. Aucune donnée client gardée sur le téléphone
- **Étant donné** qu'Inès a consulté et saisi des rendez-vous
- **Quand** elle ferme Zelaté Pro puis la rouvre sans réseau
- **Alors** aucun prénom ni rendez-vous n'est affiché
- **Et** aucune donnée de rendez-vous n'est enregistrée dans le stockage du navigateur (ADR-007)

### 22. Connexion perdue
- **Étant donné** l'espace coiffeur qui affiche le bandeau rouge « Connexion perdue »
- **Quand** Inès regarde « Mes rendez-vous » ou le bandeau « Rendez-vous à confirmer »
- **Alors** « + Rendez-vous », « Modifier », « Annuler », « Confirmer » et « Refuser » sont désactivés
- **Et** aucune commande n'est envoyée

### 23. Coiffeur désactivé ou sessions coupées
- **Étant donné** Inès désactivée par le gérant, ou dont les sessions ont été coupées
- **Quand** une commande `create_appointment` ou `confirm_appointment` est envoyée depuis son compte
- **Alors** elle est refusée avec `queue.forbidden` (ADR-019)
- **Et** aucun rendez-vous n'est créé ni confirmé

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.queue.my_appointments` | Mes rendez-vous | APP_FLOW F-S4 ; cible tactile ≥ 44 px |
| `pro-stylist.appointments.title` | Mes rendez-vous | APP_FLOW §2.2, F-S10 |
| `pro-stylist.appointments.back_to_queue` | Retour à ma file | Retour vers `/stylist/queue` |
| `pro-stylist.appointments.new` | Ajouter un rendez-vous | APP_FLOW F-S10 écrit « + Rendez-vous » (libellé indicatif) |
| `pro-stylist.appointments.form.title_new` / `.title_edit` | Nouveau rendez-vous / Modifier le rendez-vous | Titre du formulaire |
| `pro-stylist.appointments.form.first_name` | Prénom | 30 caractères maximum |
| `pro-stylist.appointments.form.time` | Heure | Pas de 5 min, horaires d'ouverture |
| `pro-stylist.appointments.form.service` | Prestation (facultatif) | Facultative |
| `pro-stylist.appointments.form.phone` | Téléphone (facultatif) | Facultatif, +33 ; jamais prérempli |
| `pro-stylist.appointments.form.phone_hint` | Pour prévenir le client par SMS. Le numéro ne sera plus affiché. | H6 |
| `pro-stylist.appointments.form.submit` / `.save` | Ajouter / Enregistrer | Création, modification |
| `pro-stylist.appointments.edit` | Modifier | APP_FLOW F-S10 |
| `pro-stylist.appointments.cancel` | Annuler | APP_FLOW F-S10 |
| `pro-stylist.appointments.cancel_confirm` | Annuler le rendez-vous de {first_name} à {time} ? Le client sera prévenu s'il a laissé son numéro. | Confirmation ; le motif s'y ajoute (E29) |
| `pro-stylist.appointments.cancel_submit` / `.cancel_keep` | Annuler le rendez-vous / Garder | Boutons de la confirmation |
| Liste des motifs d'annulation et de refus dans l'espace coiffeur | _À rédiger (clé absente)_ | E29 ; valeurs de `removal_reason` en attendant une liste dédiée 🟡 (TRD §6.2) ; le dashboard a `pro-manager.remove.reason.*` |
| Avertissement « coiffeur absent » à la saisie | _À rédiger (clé absente)_ | E26 ; forme de l'avertissement 🟡 (TRD §6.2) |
| `pro-stylist.appointments.status.upcoming` | À venir | APP_FLOW F-S10 |
| `pro-stylist.appointments.status.late` | En retard de {minutes} min | APP_FLOW F-S10 ; retard du salon, dès 10 min (E30) |
| `common.ticket_status.pending_confirmation` | À confirmer | DESIGN_SYSTEM §2.4 ; partagée avec S-19 |
| `pro-stylist.queue.pending_appointment_banner` | Rendez-vous à confirmer | APP_FLOW F-S4 ; `aria-live="polite"` |
| `pro-stylist.queue.pending_appointment.banner` | {first_name} dit avoir rendez-vous à {time} | Voir C-03 |
| `pro-stylist.appointments.merge_confirm` | Regrouper et confirmer | Fusion (K14) |
| `pro-stylist.appointments.merge_suggestion` | Vous aviez déjà saisi {first_name} à {time}. En confirmant, les deux rendez-vous n'en feront qu'un. | Fusion avec un rendez-vous déjà saisi (APP_FLOW F-S10) |
| `common.actions.confirm` | Confirmer | Partagée avec S-19 |
| `common.actions.reject` | Refuser | Partagée avec S-19 |
| `common.appointment.badge` | RDV {time} | DESIGN_SYSTEM §2.4 ; partagée avec S-18 |
| `pro-stylist.appointments.empty` | Aucun rendez-vous aujourd'hui. Ajoutez ici ceux de vos clients. | État vide (APP_FLOW §8) |
| `notifications.ticket_created.appointment.sms` | {salon_name} : rendez-vous de {appointment_time} enregistré, passage prévu vers {time}. Code {code}. Suivi : {link} | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues (TRD §9, K5) ; message indispensable (E17) ; partagée avec S-18 |
| `notifications.ticket_created.appointment.push.title` / `.body` | Titre : Rendez-vous enregistré<br>Corps : {salon_name} : rendez-vous à {appointment_time}, passage prévu vers {time}. Votre code : {code}. | Si le client a un push actif |
| `notifications.appointment_checked_in.push.title` / `.body` | Titre : Rendez-vous à confirmer<br>Corps : {first_name} dit avoir rendez-vous à {time}. Confirmez ou refusez. | Au gérant et au coiffeur choisi (K21) |
| `notifications.appointment_checked_in.reminder.push.title` / `.body` | Titre : Toujours à confirmer<br>Corps : {first_name} attend votre confirmation depuis 10 min (rendez-vous à {time}). | Rappel unique après 10 min (E19) |
| `common.change_reason.your_appointment_changed` | Le salon a modifié votre rendez-vous. | Raison d'un changement d'heure après `update_appointment` |
| `notifications.appointment_confirmed.push.title` / `.body` |Titre : Rendez-vous confirmé<br>Corps : {salon_name} confirme votre rendez-vous. Passage prévu vers {time}. | Message indispensable (E17) ; partagée avec S-19 |
| `notifications.appointment_rejected.push.title` / `.body` |Titre : Rendez-vous non confirmé<br>Corps : {salon_name} : {reason}. Vous pouvez rejoindre la file. | Push seulement ; motif (E29) ; message indispensable (E17) ; partagée avec S-19 |
| `notifications.appointment_rejected.reason.<code>` | _À rédiger (clés absentes)_ | Texte `{reason}` de chaque motif de refus (TRD §9) |
| `notifications.cancelled_by_salon.push` / `.sms` | Push : Place annulée, toutes nos excuses / {salon_name} a annulé votre place : {reason}. Voyez les salons proches.<br>SMS : {salon_name} a annulé votre place : {reason}. Toutes nos excuses. Salons proches : {link} | Push et SMS, SMS hors plafond ; message indispensable (E17) ; partagée avec S-12, S-18 ; SMS ≤ 160 caractères GSM-7 (TRD §9, K5) |
| `notifications.cancelled_by_salon.reason.<code>` | urgence au salon · à votre demande · inscription en double · décision du salon · imprévu au salon | Motif `{reason}` pour `emergency`, `client_request`, `duplicate`, `inappropriate_behaviour`, `other` (E29) |
| `notifications.cancelled_by_salon.end_of_day.push` / `.sms` | Push : Place annulée, toutes nos excuses / {salon_name} ferme et n'a pas pu vous prendre aujourd'hui. Voyez les salons proches.<br>SMS : {salon_name} ferme et n'a pas pu vous prendre aujourd'hui. Toutes nos excuses. Salons proches : {link} | Signalement encore à confirmer à la fermeture (E19) ; SMS ≤ 160 caractères GSM-7 |
| `errors.queue.appointment_overlap` | Ce créneau chevauche un autre rendez-vous de ce coiffeur. Choisissez une autre heure ou un autre coiffeur. | Partagée avec S-18 |
| `errors.queue.outside_opening_hours` | Cette heure est en dehors des horaires d'ouverture du salon. Choisissez une heure pendant l'ouverture. | Partagée |
| `errors.queue.appointment_in_past` | Cette heure est déjà passée. Choisissez une heure à venir. | Partagée avec S-18 |
| `errors.queue.appointment_not_today` | Un rendez-vous ne peut être saisi que pour aujourd'hui. | E26 |
| `errors.queue.invalid_merge_target` | Ce rendez-vous ne peut plus être regroupé. Confirmez le signalement seul ou choisissez un autre rendez-vous. | Fusion impossible |
| `errors.queue.member_required` | Choisissez le coiffeur de ce rendez-vous pour le confirmer. | Signalement « Je ne sais plus » |
| `errors.queue.invalid_payload` | Certaines informations sont incomplètes ou incorrectes. Vérifiez-les, puis réessayez. | Annulation ou refus sans motif (E29) |
| `errors.queue.rate_limited` | Trop de demandes en peu de temps. Patientez quelques minutes, puis réessayez. | Plus de 60 créations par heure et par salon (K15) |
| `errors.queue.appointment_not_editable` | Ce rendez-vous ne peut plus être modifié ni annulé, car il n'est plus en attente. | Partagée avec S-18 |
| `errors.queue.already_has_active_ticket` | Ce numéro a déjà une place en cours. Une seule place à la fois est possible. | Partagée ; ne nomme pas l'autre salon |
| `errors.queue.invalid_phone` | Ce numéro n'est pas valide. Saisissez un numéro de téléphone français. | Partagée |
| `errors.queue.already_resolved` | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran. | Partagée |
| `errors.queue.forbidden` | Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. | Partagée |

## Questions ouvertes
- **Résolu le 19/10 (TRD §6.2 v0.5)** : un coiffeur ne peut viser que lui-même, sinon `forbidden` (scénario 5). Question d'origine : refus ou remplacement du `member_id` d'un autre coiffeur ?
- **TRD §6.2** : `update_appointment` accepte `member_id?` pour le « coiffeur concerné ». Un coiffeur peut-il donner un de ses rendez-vous à un collègue ?
- **APP_FLOW F-S4 / F-S10** : le bandeau de F-S4 propose « Confirmer » ou « Refuser » sans fusion, alors que F-S10 propose la fusion. Le bandeau propose-t-il aussi le rapprochement avec un rendez-vous déjà saisi ?
- **APP_FLOW F-S10 / F-M13** : la liste du coiffeur n'a pas le statut « arrivé » que la liste du gérant affiche. Voulu ?
- **Résolu le 19/10 (E26)** en partie : jour même seulement, dans les horaires du salon ; accepté pour un coiffeur en pause, avec un avertissement s'il est absent (scénarios 8, 8 ter, 8 quater). Reste [PRD] : un coiffeur en « Fin de journée », ou un rendez-vous après son `shift_end_at`, est-il accepté ? Et [TRD] la forme de l'avertissement (🟡) et son texte.
- **TRD §6.2** : le gérant qui coiffe (« Je coiffe ») utilise l'espace coiffeur : y saisit-il ses rendez-vous pour lui seul, comme un coiffeur, ou garde-t-il le choix du coiffeur ?
- **APP_FLOW F-S10** : le coiffeur peut-il voir et confirmer un signalement fait avec « Je ne sais plus » (sans coiffeur choisi) ? Voir aussi S-19.
- **Résolu le 19/10 (K21, E19)** : push `appointment_checked_in` au gérant et au coiffeur choisi, puis un rappel unique après 10 min sans confirmation (scénarios 14 et 14 bis). Question d'origine : comment le coiffeur est-il prévenu d'un signalement quand Zelaté Pro n'est pas ouverte ? Reste [APP_FLOW] (question nouvelle) : aucun écran de l'espace coiffeur ne propose d'activer les notifications push du membre (`push-subscribe` pour un membre, K21, K33) ; où et quand le coiffeur les active-t-il ?
- **Résolu le 19/10 (E17)** : inscription, annulation, rendez-vous confirmé ou refusé et retard sur rendez-vous partent sans case cochée ; le client saisi avec téléphone reçoit un lien pour activer « Me prévenir » ; avis RGPD à obtenir (PRD §9 n° 9). Question d'origine : consentement des clients saisis avec téléphone.
- [PRD / BACKEND_SCHEMA] (question nouvelle) Changement de l'heure d'un rendez-vous par le salon (`update_appointment`, raison `your_appointment_changed`) : c'est un `estimate_changed`, donc un message d'anticipation retenu sans « Me prévenir » ; un client saisi par le salon, qui n'a jamais vu la case, n'apprend donc pas que son rendez-vous a été déplacé. Est-ce voulu, ou ce message est-il indispensable (il concerne sa place, E17) ?
- **Résolu le 19/10 (dictionnaire)** en partie : champ heure, validation, fusion, état vide, erreurs et notifications ont leur texte. Restent à rédiger : la liste des motifs côté espace coiffeur, l'avertissement « coiffeur absent » et `notifications.appointment_rejected.reason.<code>`.
