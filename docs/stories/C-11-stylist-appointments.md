# C-11 · Saisir ses rendez-vous et confirmer ceux qui se signalent pour lui

**En tant que** coiffeur, **je veux** saisir depuis mon téléphone les rendez-vous de mes propres clients et confirmer d'un geste ceux qui se signalent pour moi en arrivant, **afin que** ma file tienne compte de mes rendez-vous sans passer par le gérant.

- Priorité : I (PRD §5.3)
- Règles appliquées : R6 (le gérant et chaque coiffeur pour ses clients) et R4 (PRD §11) ; confirmation d'un geste par le gérant ou le coiffeur concerné (PRD §5.1, décisions d'Ely) ; H10 et PRD §5.2 « Distribution » règles 6 à 8 ; PRD §5.2 transitions 1, 1b et 6 ; H6 (numéro jamais affiché) ; aucune donnée client stockée sur le téléphone du coiffeur (PRD §5.1, §6) ; H3 (3 SMS maximum par ticket) ; PRD §7.1 principes 2 et 4 (double déclenchement refusé, actions bloquées hors connexion)
- Parcours : F-S10 (`/stylist/appointments`) ; bandeau « Rendez-vous à confirmer » et bouton « Mes rendez-vous » de F-S4 (`/stylist/queue`) ; événements « Ticket créé », « Rendez-vous signalé », « Rendez-vous confirmé ou refusé » (APP_FLOW §7)
- Commandes et données : `create_appointment` (`member_id` imposé pour un coiffeur), `update_appointment`, `cancel_appointment`, `confirm_appointment` · lecture `get_stylist_queue` (rendez-vous à confirmer inclus) · tables `tickets` (`kind` = `appointment`, `scheduled_at`, `assigned_member_id`, `created_by_member_id`, `confirmed_by_member_id`, `status`), `private.ticket_contacts`, `notifications` (`ticket_created`, `cancelled_by_salon`, `appointment_confirmed`, `appointment_rejected`), `ticket_events` (`created`, `appointment_updated`, `cancelled`, `appointment_confirmed`, `appointment_rejected`), `private.processed_commands` · canal `salon:{salon_id}`

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
- **Alors** Léa reçoit un SMS avec l'heure du rendez-vous, l'heure de passage, le code du ticket et le lien de suivi `/t/:shortCode`
- **Et** ce SMS compte comme le SMS 1 sur 3 du ticket

### 4. Téléphone jamais réaffiché (H6)
- **Étant donné** un rendez-vous qu'Inès a saisi avec téléphone
- **Quand** elle le rouvre, le modifie, ou consulte sa file
- **Alors** le numéro n'est affiché nulle part
- **Et** le gérant ne le voit pas non plus

### 5. Un coiffeur ne saisit que pour lui-même
- **Étant donné** Inès connectée sur son téléphone
- **Quand** une commande `create_appointment` est envoyée depuis son compte avec le `member_id` de Karim
- **Alors** aucun rendez-vous n'est créé chez Karim

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
- **Quand** une commande arrive avec une heure déjà passée
- **Alors** elle est refusée avec `queue.appointment_in_past`

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
- **Et** Léa est prévenue si elle est joignable, puisque son heure change de 10 min ou plus
- **Et** l'événement `appointment_updated` est inscrit au journal, sans prénom

### 11. Annuler un de mes rendez-vous
- **Étant donné** le rendez-vous de Léa chez Inès, au statut « En attente »
- **Quand** Inès touche « Annuler »
- **Alors** la commande `cancel_appointment` part
- **Et** le rendez-vous disparaît de sa file et du dashboard en moins de 2 s
- **Et** Léa reçoit la notification `cancelled_by_salon` si elle est joignable
- **Et** l'événement `cancelled` est inscrit au journal, avec Inès comme actrice

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
- **Alors** le bandeau « Rendez-vous à confirmer » apparaît en moins de 2 s, avec le prénom Léa et l'heure annoncée 14h30
- **Et** l'arrivée du bandeau est annoncée aux lecteurs d'écran (`aria-live="polite"`)
- **Et** le rendez-vous apparaît au statut « à confirmer » dans « Mes rendez-vous »
- **Et** il n'est pas proposé par « Appeler » tant qu'il n'est pas confirmé

### 15. Confirmer depuis le bandeau
- **Étant donné** le bandeau « Rendez-vous à confirmer » de Léa
- **Quand** Inès touche « Confirmer »
- **Alors** la commande `confirm_appointment` part avec `decision` = `confirm`
- **Et** le rendez-vous entre dans sa file à 14h30
- **Et** le bandeau disparaît chez Inès et sur le dashboard du gérant
- **Et** Inès est enregistrée comme membre qui confirme (`confirmed_by_member_id`)
- **Et** Léa voit son heure de passage et reçoit `appointment_confirmed` par push

### 16. Confirmer en fusionnant avec un rendez-vous que j'avais saisi
- **Étant donné** un rendez-vous « Léa » à 14h30 qu'Inès avait saisi elle-même
- **Et** Léa qui se signale pour 14h30 avec Inès
- **Quand** Inès confirme depuis « Mes rendez-vous », avec la fusion proposée
- **Alors** la commande `confirm_appointment` part avec `merge_into_ticket_id` = le rendez-vous saisi
- **Et** un seul rendez-vous de Léa reste dans sa file

### 17. Refuser
- **Étant donné** le bandeau « Rendez-vous à confirmer » de Léa, qui n'a pas rendez-vous avec Inès
- **Quand** Inès touche « Refuser »
- **Alors** la commande `confirm_appointment` part avec `decision` = `reject`
- **Et** le bandeau disparaît chez Inès et sur le dashboard
- **Et** Léa reçoit `appointment_rejected` par push, avec « Rejoindre la file », sans SMS

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
| `pro-stylist.queue.my_appointments` | « Mes rendez-vous » | Libellé indicatif (APP_FLOW F-S4) ; cible tactile ≥ 44 px |
| `pro-stylist.appointments.title` | « Mes rendez-vous » | APP_FLOW §2.2, F-S10 |
| `pro-stylist.appointments.new` | « + Rendez-vous » | Libellé indicatif (APP_FLOW F-S10) |
| `pro-stylist.appointments.form.first_name` | « Prénom » | 30 caractères maximum |
| `pro-stylist.appointments.form.time` | Heure | Pas de 5 min, horaires d'ouverture |
| `pro-stylist.appointments.form.service` | « Prestation » | Facultative |
| `pro-stylist.appointments.form.phone` | « Téléphone » | Facultatif, +33 ; jamais prérempli |
| `pro-stylist.appointments.form.submit` | Ajouter | — |
| `pro-stylist.appointments.edit` | « Modifier » | APP_FLOW F-S10 |
| `pro-stylist.appointments.cancel` | « Annuler » | APP_FLOW F-S10 |
| `pro-stylist.appointments.status.upcoming` | « À venir » | APP_FLOW F-S10 |
| `pro-stylist.appointments.status.late` | « En retard de {minutes} min » | APP_FLOW F-S10 ; ICU |
| `common.ticket_status.pending_confirmation` | « À confirmer » | DESIGN_SYSTEM §2.4 ; partagée avec S-19 |
| `pro-stylist.queue.pending_appointment_banner` | « Rendez-vous à confirmer » | Libellé indicatif (APP_FLOW F-S4) ; `aria-live="polite"` |
| `pro-stylist.appointments.merge_suggestion` | Vous aviez déjà saisi {first_name} à {time}. En confirmant, les deux rendez-vous n'en feront qu'un. | Fusion avec un rendez-vous déjà saisi (APP_FLOW F-S10) |
| `common.actions.confirm` | « Confirmer » | Partagée avec S-19 |
| `common.actions.reject` | « Refuser » | Partagée avec S-19 |
| `common.appointment.badge` | « RDV {time} » | DESIGN_SYSTEM §2.4 ; partagée avec S-18 |
| `pro-stylist.appointments.empty` | Aucun rendez-vous aujourd'hui. Ajoutez ici ceux de vos clients. | État vide (APP_FLOW §8) |
| `notifications.ticket_created.sms` | {salon_name} : inscription confirmée. {count, plural, =0 {Personne avant vous} one {# client avant vous} other {# clients avant vous}}, passage vers {time}. Code {code}. Suivi : {link} | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues ; partagée avec S-10, S-18 |
| `notifications.appointment_confirmed.push.title` / `.body` |Titre : Rendez-vous confirmé<br>Corps : {salon_name} confirme votre rendez-vous. Passage prévu vers {time}.| Partagée avec S-19 |
| `notifications.appointment_rejected.push.title` / `.body` |Titre : Rendez-vous non confirmé<br>Corps : {salon_name} n'a pas pu confirmer votre rendez-vous. Vous pouvez rejoindre la file.| Push seulement ; partagée avec S-19 |
| `notifications.cancelled_by_salon.push` / `.sms` |Push : _À rédiger (clé absente)_<br>SMS : {salon_name} a annulé votre place : {reason}. Toutes nos excuses. Salons proches : {link}| Partagée avec S-12, S-18 ; SMS ≤ 160 caractères GSM-7 |
| `errors.queue.appointment_overlap` | Ce créneau chevauche un autre rendez-vous de ce coiffeur. Choisissez une autre heure ou un autre coiffeur. | Partagée avec S-18 |
| `errors.queue.outside_opening_hours` | Cette heure est en dehors des horaires d'ouverture du salon. Choisissez une heure pendant l'ouverture. | Partagée |
| `errors.queue.appointment_in_past` | Cette heure est déjà passée. Choisissez une heure à venir. | Partagée avec S-18 |
| `errors.queue.appointment_not_editable` | Ce rendez-vous ne peut plus être modifié ni annulé, car il n'est plus en attente. | Partagée avec S-18 |
| `errors.queue.already_has_active_ticket` | Ce numéro a déjà une place en cours. Une seule place à la fois est possible. | Partagée ; ne nomme pas l'autre salon |
| `errors.queue.invalid_phone` | Ce numéro n'est pas valide. Saisissez un numéro de téléphone français. | Partagée |
| `errors.queue.already_resolved` | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran. | Partagée |
| `errors.queue.forbidden` | Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. | Partagée |

## Questions ouvertes
- **TRD §6.2** : « `member_id` (imposé pour un coiffeur) » : si un coiffeur envoie le `member_id` d'un autre, la commande est-elle refusée (`forbidden`) ou le serveur la crée-t-il pour lui-même en remplaçant le `member_id` ? Le scénario 5 ne tranche pas.
- **TRD §6.2** : `update_appointment` accepte `member_id?` pour le « coiffeur concerné ». Un coiffeur peut-il donner un de ses rendez-vous à un collègue ?
- **APP_FLOW F-S4 / F-S10** : le bandeau de F-S4 propose « Confirmer » ou « Refuser » sans fusion, alors que F-S10 propose la fusion. Le bandeau propose-t-il aussi le rapprochement avec un rendez-vous déjà saisi ?
- **APP_FLOW F-S10 / F-M13** : la liste du coiffeur n'a pas le statut « arrivé » que la liste du gérant affiche. Voulu ?
- **APP_FLOW F-S3 / PRD §5.2** : un coiffeur « En pause », « Fin de journée » ou absent peut-il saisir un rendez-vous, ou un rendez-vous après son heure de fin de journée ?
- **TRD §6.2** : le gérant qui coiffe (« Je coiffe ») utilise l'espace coiffeur : y saisit-il ses rendez-vous pour lui seul, comme un coiffeur, ou garde-t-il le choix du coiffeur ?
- **APP_FLOW F-S10** : le coiffeur peut-il voir et confirmer un signalement fait avec « Je ne sais plus » (sans coiffeur choisi) ? Voir aussi S-19.
- **APP_FLOW §7** : comment le coiffeur est-il prévenu d'un signalement quand Zelaté Pro n'est pas ouverte sur son téléphone ? Aucune notification vers un membre n'est prévue.
- **PRD §9 n° 9 et BACKEND_SCHEMA §4.16** : mêmes questions que S-18 sur le consentement des clients saisis avec téléphone (alertes de retard, `cancelled_by_salon`, `estimate_changed`) et que S-19 sur `appointment_confirmed` et `appointment_rejected` sans case « Me prévenir ».
- **Textes** : libellés du champ heure, du bouton de validation, de la fusion et de l'état vide, ainsi que tous les messages d'erreur et notifications, absents des documents.
