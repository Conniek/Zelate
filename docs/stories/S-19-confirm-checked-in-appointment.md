# S-19 · Confirmer ou refuser un rendez-vous signalé par un client

**En tant que** gérant, **je veux** confirmer ou refuser d'un geste le rendez-vous qu'un client signale en arrivant au salon, **afin que** seul un vrai rendez-vous entre dans la file, rapproché de celui que j'avais déjà saisi s'il existe.

- Priorité : I (PRD §5.3)
- Règles appliquées : un rendez-vous est confirmé par le salon, d'un geste, par le gérant ou le coiffeur concerné (PRD §5.1, décisions d'Ely ; R4) ; PRD §5.2 transitions 1b et 6 (« rendez-vous refusé ») ; H10 et PRD §5.2 « Distribution » règles 6 à 8 ; PRD §5.4 « Rendez-vous confirmé » et « Rendez-vous refusé » (push, pas de SMS : le client est sur place ; messages indispensables, envoyés sans « Me prévenir », E17) ; refus avec un motif obligatoire choisi dans une liste, envoyé au client (E29) ; rappel au gérant et au coiffeur après 10 min sans confirmation, annulation avec excuses à la fermeture, annulation possible par le client (E19) ; priorité de 10 min comptée depuis l'heure du rendez-vous, même confirmé tard (E20) ; fusion avec un rendez-vous déjà saisi (K14, K28) ; H6 (numéro jamais affiché) ; un seul ticket actif par client (PRD §5.1) ; isolation par salon (PRD §5.1) ; PRD §7.1 principe 2 (refus du double déclenchement)
- Parcours : F-M13 (section « À confirmer », `/dashboard/appointments`) ; F-M6 (bandeau « Rendez-vous à confirmer ») ; côté client F-C12 (fin du parcours) et F-C5 ; événements « Rendez-vous signalé » et « Rendez-vous confirmé ou refusé » (APP_FLOW §7)
- Commandes et données : `confirm_appointment` (`ticket_id`, `decision` = `confirm` | `reject`, `member_id?`, `merge_into_ticket_id?`, `reason_code?` obligatoire si `reject`) ; `queue-tick` (rappel après 10 min, annulation à la fermeture) ; `notifications` (`appointment_checked_in`, variante `reminder`, au gérant et au coiffeur, clé `appointment_checked_in:<member_id>`) ; `tickets` (`confirmation_reminder_sent_at`, `removal_reason`, `cancel_reason` = `merged`), `ticket_events` (`appointment_merged`), `private.ticket_contacts` (contact du ticket fusionné clos) ; ticket créé avant par `check_in_appointment` (U-14) · lecture `get_salon_board` (rendez-vous à confirmer inclus) · tables `tickets` (`status` `pending_confirmation` → `waiting` ou `cancelled`, `appointment_source` = `client_check_in`, `confirmed_at`, `confirmed_by_member_id`, `cancel_reason` = `appointment_rejected`), `notifications` (`appointment_confirmed`, `appointment_rejected`), `ticket_events` (`appointment_checked_in`, `appointment_confirmed`, `appointment_rejected`), `private.processed_commands` · canaux `salon:{salon_id}` (`appointment_pending`, `queue_updated`), `ticket:{ticket_id}`

## Scénarios

### 1. Un client se signale : le gérant est prévenu

- **Étant donné** Nadia, gérante, sur `/dashboard`
- **Quand** Léa se signale par le QR de l'affiche pour un rendez-vous à 14h30 avec Inès (`check_in_appointment`)
- **Alors** le bandeau « Rendez-vous à confirmer » apparaît sur le dashboard en moins de 2 s
- **Et** la section « À confirmer » de `/dashboard/appointments` affiche le prénom Léa, l'heure annoncée 14h30 et la coiffeuse Inès
- **Et** l'arrivée de la carte est annoncée aux lecteurs d'écran (`aria-live="polite"`, DESIGN_SYSTEM `PendingConfirmationCard`)
- **Et** Nadia et Inès reçoivent chacune une notification push `appointment_checked_in` « Rendez-vous à confirmer », même app fermée (K21, PRD §5.4)

### 1 bis. Rappel après 10 min sans confirmation

- **Étant donné** le rendez-vous signalé par Léa à 14h20, toujours « À confirmer »
- **Quand** il est 14h30 (tolérance des tests ±60 s, K7)
- **Alors** Nadia et Inès reçoivent un rappel push (`appointment_checked_in`, variante `reminder`) (PRD §5.1, E19)
- **Et** la carte affiche « Signalé il y a plus de 10 min : confirmez ou refusez. »
- **Quand** il est 14h45, toujours sans décision
- **Alors** aucun second rappel ne part (`confirmation_reminder_sent_at`, une seule fois)
- **Et** ces push au personnel ne sont soumis ni au consentement ni au plafond de SMS (BACKEND_SCHEMA §4.16)

### 2. Tant qu'il n'est pas confirmé, le rendez-vous ne compte pas

- **Étant donné** le rendez-vous signalé de Léa, au statut « À confirmer »
- **Quand** le moteur recalcule la file
- **Alors** les heures de passage des autres clients ne changent pas à cause de lui
- **Et** il n'est jamais choisi par « Appeler »
- **Et** il reste visible du gérant et d'Inès

### 3. Confirmer un rendez-vous qui n'avait pas été saisi

- **Étant donné** le rendez-vous signalé de Léa, sans rendez-vous saisi correspondant
- **Quand** Nadia touche « Confirmer »
- **Alors** la commande `confirm_appointment` part avec `decision` = `confirm`
- **Et** le ticket passe de « À confirmer » à « En attente » chez Inès, avec l'heure 14h30
- **Et** Nadia est enregistrée comme membre qui confirme (`confirmed_by_member_id`, `confirmed_at`)
- **Et** le rendez-vous entre dans la file d'Inès avec le badge « RDV 14h30 », en moins de 2 s
- **Et** le bandeau et la carte « À confirmer » disparaissent, chez Nadia comme chez Inès
- **Et** Léa voit son heure de passage sur son ticket (F-C5)
- **Et** Léa reçoit la notification `appointment_confirmed` par push, même sans « Me prévenir » (E17), sans SMS (PRD §5.4)
- **Et** l'événement `appointment_confirmed` est inscrit au journal, avec Nadia comme actrice
- **Et** à l'appel, Léa donnera le code de son ticket comme les autres clients (PRD §5.1, E21)

### 4. Confirmer en rapprochant d'un rendez-vous déjà saisi

- **Étant donné** un rendez-vous saisi par le salon pour « Léa » à 14h30 chez Inès (S-18)
- **Et** Léa qui se signale pour 14h30 avec Inès
- **Quand** Nadia ouvre la section « À confirmer »
- **Alors** le rapprochement avec le rendez-vous déjà saisi lui est proposé
- **Quand** elle touche « Confirmer » en acceptant le rapprochement
- **Alors** la commande `confirm_appointment` part avec `decision` = `confirm` et `merge_into_ticket_id` = le rendez-vous saisi
- **Et** le rendez-vous saisi par le salon survit : il reprend le compte de Léa, son choix « Me prévenir » et son numéro (TRD §6.2, K14, K28)
- **Et** le ticket signalé par Léa est annulé avec le motif `merged`, son contact privé est clos, et l'événement `appointment_merged` est inscrit au journal
- **Et** un seul rendez-vous de Léa reste actif dans la file d'Inès
- **Et** Léa voit son heure de passage sur son ticket
- **Et** aucun SMS d'inscription n'est envoyé de nouveau

### 4 bis. Rapprochement impossible

- **Étant donné** un rendez-vous saisi pour Léa qui a déjà été appelé, annulé, ou qui est chez un autre coiffeur que celui du signalement
- **Quand** une commande `confirm_appointment` arrive avec ce `merge_into_ticket_id`
- **Alors** elle est refusée avec `queue.invalid_merge_target` (TRD §6.2)
- **Et** le signalement reste « À confirmer »

### 4 ter. Confirmation qui chevauche un rendez-vous saisi

- **Étant donné** un rendez-vous saisi pour Karim à 14h30 chez Inès, et Léa qui se signale pour 14h30 avec Inès
- **Quand** Nadia confirme le signalement de Léa sans rapprochement
- **Alors** la commande est refusée avec `queue.appointment_overlap` (TRD v0.5 §6.2)
- **Et** le signalement reste « À confirmer »

### 5. Refuser un rendez-vous introuvable

- **Étant donné** Léa qui se signale pour 14h30 avec Inès, alors que le salon n'a aucun rendez-vous à ce nom
- **Quand** Nadia touche « Refuser »
- **Alors** un motif lui est demandé dans une liste (PRD §5.1, E29 ; APP_FLOW F-M13)
- **Quand** elle choisit un motif et confirme
- **Alors** la commande `confirm_appointment` part avec `decision` = `reject` et `reason_code`
- **Et** le ticket passe au statut « Annulé » avec le motif `appointment_rejected`, et le motif choisi dans `removal_reason`
- **Et** la carte « À confirmer » disparaît, chez Nadia comme chez Inès, en moins de 2 s
- **Et** Léa reçoit la notification `appointment_rejected` par push, avec le motif et « Rejoindre la file », même sans « Me prévenir » (E17, E29)
- **Et** aucun SMS n'est envoyé (le client est sur place, PRD §5.4)
- **Et** l'événement `appointment_rejected` est inscrit au journal, avec Nadia comme actrice

### 5 bis. Refuser sans motif

- **Étant donné** la boîte de refus ouverte
- **Quand** aucun motif n'est choisi
- **Alors** le refus ne peut pas être confirmé
- **Quand** une commande `confirm_appointment` (`reject`) arrive sans `reason_code`
- **Alors** elle est refusée avec `queue.invalid_payload` (TRD §6.2)
- **Et** le rendez-vous reste « À confirmer »

### 6. Après un refus, le client peut rejoindre la file

- **Étant donné** le rendez-vous de Léa refusé
- **Quand** Léa touche « Rejoindre la file »
- **Alors** elle arrive sur le parcours « Rejoindre la file » du salon (F-C3)
- **Et** elle n'est pas bloquée par la règle d'un seul ticket actif

### 7. Client en avance (règle 8, R3)

- **Étant donné** Léa qui se signale à 14h00 pour un rendez-vous à 14h30 avec Inès
- **Quand** Nadia confirme
- **Alors** Léa est prise avant 14h30 si Inès est libre et que cela ne retarde personne
- **Et** sinon son heure de passage n'est pas avant 14h30

### 8. Client en retard de plus de 10 min (règle 7, R2)

- **Étant donné** Léa qui se signale à 14h45 pour un rendez-vous à 14h30 avec Inès
- **Quand** Nadia confirme
- **Alors** Léa n'a plus la priorité de son rendez-vous (plus de 10 min après l'heure)
- **Et** elle est prise dès que possible, sans retarder les rendez-vous suivants d'Inès

### 8 bis. Confirmation tardive du salon (E20)

- **Étant donné** Léa qui se signale à 14h25 pour un rendez-vous à 14h30, et Nadia qui ne confirme qu'à 14h38
- **Quand** le moteur place Léa après la confirmation
- **Alors** Léa garde la priorité de son rendez-vous jusqu'à 14h40, 10 min après l'heure du rendez-vous (PRD §5.1, §5.2 règle 7, E20)
- **Et** la confirmation tardive ne la pénalise pas ; elle ne prolonge pas non plus sa priorité au-delà de 14h40
- **Et** une fois appelée, la règle H4 s'applique (compteur de 10 min, E20)

### 9. Déjà traité par le coiffeur

- **Étant donné** le rendez-vous signalé de Léa, qu'Inès vient de confirmer depuis son téléphone
- **Quand** Nadia touche « Confirmer » ou « Refuser » sur une carte pas encore rafraîchie
- **Alors** la commande est refusée avec `queue.already_resolved`
- **Et** le message correspondant s'affiche
- **Et** le rendez-vous garde la décision d'Inès
- **Et** une seule notification part vers Léa

### 10. Le client a annulé entre-temps

- **Étant donné** Léa qui a annulé son signalement avant la décision du salon (`cancel_ticket`, motif `client_cancelled`, PRD §5.1, E19)
- **Quand** l'annulation est enregistrée
- **Alors** la carte « À confirmer » disparaît chez Nadia et chez Inès en moins de 2 s
- **Quand** Nadia touche « Confirmer » sur une carte pas encore rafraîchie
- **Alors** la commande est refusée avec `queue.invalid_transition` : le statut du ticket ne permet plus l'action (TRD §6.2, K16)
- **Et** aucun rendez-vous n'entre dans la file

### 10 bis. Signalement jamais confirmé à la fermeture (E19)

- **Étant donné** le signalement de Léa toujours « À confirmer » à 19:00, dernière fermeture de la journée
- **Quand** l'heure de fermeture est atteinte
- **Alors** `queue-tick` annule le ticket avec excuses, motif `end_of_day` (PRD §5.1, E19 ; TRD §6.1)
- **Et** Léa reçoit un message d'excuse (même modèle que S-15, question ouverte sur le texte)
- **Et** la carte disparaît chez Nadia et chez Inès

### 11. Ticket d'un autre salon

- **Étant donné** Nadia, gérante du salon A
- **Quand** une commande `confirm_appointment` est envoyée depuis son compte pour un ticket du salon B
- **Alors** elle est refusée avec `queue.ticket_other_salon`
- **Et** le ticket du salon B ne change pas

### 12. Double appui

- **Étant donné** la carte « À confirmer » de Léa
- **Quand** Nadia touche deux fois très vite « Confirmer »
- **Alors** le bouton est désactivé pendant l'envoi
- **Et** le rendez-vous n'est confirmé qu'une fois
- **Et** une seule notification `appointment_confirmed` est créée

### 13. Aucun numéro affiché (H6)

- **Étant donné** Léa, cliente connectée par son numéro, qui se signale
- **Quand** Nadia ou Inès consultent la carte « À confirmer », le rendez-vous confirmé ou son panneau
- **Alors** le numéro de Léa n'est affiché nulle part

### 14. Coiffeur qui n'est pas concerné

- **Étant donné** le rendez-vous signalé de Léa pour Inès
- **Quand** une commande `confirm_appointment` est envoyée depuis le compte de Karim, autre coiffeur du salon
- **Alors** elle est refusée avec `queue.forbidden`
- **Et** le rendez-vous reste « À confirmer »

### 15. Client qui ne se souvient plus de son coiffeur

- **Étant donné** Léa qui se signale pour 14h30 en choisissant « Je ne sais plus »
- **Quand** Nadia ouvre la section « À confirmer »
- **Alors** la carte affiche Léa et 14h30, avec « Coiffeur non précisé par le client »
- **Et** Nadia reçoit le push `appointment_checked_in` ; aucun coiffeur n'est visé (K21)
- **Quand** Nadia choisit Inès puis touche « Confirmer »
- **Alors** la commande `confirm_appointment` part avec `member_id` = Inès (TRD §6.2)
- **Et** le rendez-vous entre dans la file d'Inès, attribué à elle (`assigned_member_id`, K39)
- **Quand** une commande `confirm_appointment` (`confirm`) arrive sans `member_id` pour ce signalement
- **Alors** elle est refusée avec `queue.member_required`
- **Et** le signalement reste « À confirmer »

### 16. Connexion perdue

- **Étant donné** le dashboard qui affiche « Connexion perdue »
- **Quand** Nadia regarde la section « À confirmer »
- **Alors** « Confirmer » et « Refuser » sont désactivés
- **Et** aucune commande n'est envoyée

## Textes à prévoir

| Clé (anglais)                                              | Texte (français)                                                                                                                                                          | Contrainte                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pro-manager.board.pending_appointments.banner`            | « {count, plural, one {# rendez-vous à confirmer} other {# rendez-vous à confirmer}} »                                                                                    | Pluriel ICU (APP_FLOW F-M6)                                                       |
| `pro-manager.appointments.pending.reminder`                | « Signalé il y a plus de 10 min : confirmez ou refusez. »                                                                                                                 | E19                                                                               |
| `notifications.appointment_checked_in.push`                | Voir `notifications.appointment_checked_in.push.*` dans le dictionnaire (2 textes)                                                                                        | Push au gérant et au coiffeur choisi (K21)                                        |
| `notifications.appointment_checked_in.reminder.push`       | Voir `notifications.appointment_checked_in.reminder.push.*` dans le dictionnaire (2 textes)                                                                               | Rappel après 10 min (E19)                                                         |
| Motif du refus côté gérant (boîte « Refuser »)             | _À rédiger_ (pas de clé de boîte de refus dans `pro-manager.appointments.pending.*`) ; liste : `pro-manager.remove.reason.*` (5 textes), en attendant une liste dédiée 🟡 | E29                                                                               |
| `notifications.appointment_rejected.reason.<code>`         | _À rédiger_ (clé prévue par TRD §9, absente du dictionnaire)                                                                                                              | Motif lu par le client (E29)                                                      |
| `pro-manager.appointments.pending.title`                   | « À confirmer »                                                                                                                                                           | Libellé indicatif (APP_FLOW F-M13)                                                |
| `pro-manager.appointments.pending.announced_time`          | Rendez-vous annoncé à {time}                                                                                                                                              | Heure annoncée par le client                                                      |
| `pro-manager.appointments.pending.merge_suggestion`        | Rapprocher du rendez-vous déjà saisi : {first_name}, {time}, avec {stylist_name}                                                                                          | Rapprochement avec un rendez-vous saisi (DESIGN_SYSTEM `PendingConfirmationCard`) |
| `pro-manager.appointments.pending.unknown_stylist`         | Coiffeur non précisé par le client                                                                                                                                        | Client qui a choisi « Je ne sais plus »                                           |
| `common.actions.confirm`                                   | « Confirmer »                                                                                                                                                             | APP_FLOW F-M13, F-S4 ; partagée avec C-11                                         |
| `common.actions.reject`                                    | « Refuser »                                                                                                                                                               | APP_FLOW F-M13, F-S4 ; partagée avec C-11                                         |
| `common.ticket_status.pending_confirmation`                | « À confirmer »                                                                                                                                                           | DESIGN_SYSTEM §2.4                                                                |
| `notifications.appointment_confirmed.push.title` / `.body` | Titre : Rendez-vous confirmé<br>Corps : {salon_name} confirme votre rendez-vous. Passage prévu vers {time}.                                                               | Push ; heure de passage (APP_FLOW §7)                                             |
| `notifications.appointment_rejected.push.title` / `.body`  | Titre : Rendez-vous non confirmé<br>Corps : {salon_name} : {reason}. Vous pouvez rejoindre la file.                                                                       | Push seulement, pas de SMS (PRD §5.4) ; avec l'action « Rejoindre la file »       |
| `client.ticket.appointment_rejected.join_queue`            | « Rejoindre la file »                                                                                                                                                     | APP_FLOW F-C12, §7                                                                |
| `errors.queue.member_required`                             | « Choisissez le coiffeur de ce rendez-vous pour le confirmer. »                                                                                                           | « Je ne sais plus » (scénario 15)                                                 |
| `errors.queue.invalid_merge_target`                        | « Ce rendez-vous ne peut plus être regroupé. Confirmez le signalement seul ou choisissez un autre rendez-vous. »                                                          | Scénario 4 bis                                                                    |
| `errors.queue.appointment_overlap`                         | « Ce créneau chevauche un autre rendez-vous de ce coiffeur. Choisissez une autre heure ou un autre coiffeur. »                                                            | Scénario 4 ter                                                                    |
| `errors.queue.invalid_transition`                          | « Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. »                                                                                        | Signalement annulé par le client (K16)                                            |
| `errors.queue.invalid_payload`                             | « Certaines informations sont incomplètes ou incorrectes. Vérifiez-les, puis réessayez. »                                                                                 | Refus sans motif (E29)                                                            |
| `errors.queue.already_resolved`                            | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran.                                                                                        | Partagée                                                                          |
| `errors.queue.ticket_other_salon`                          | Aucun ticket de votre salon ne correspond. Vérifiez le code ou le client concerné.                                                                                        | Partagée avec C-05, S-12                                                          |
| `errors.queue.forbidden`                                   | Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez.                                                             | Partagée                                                                          |

## Questions ouvertes

- **Résolu le 19/10** (TRD v0.5 §6.2, K21) : `confirm_appointment` a `member_id?`, obligatoire quand le client a choisi « Je ne sais plus » (sinon `member_required`) ; le push de signalement ne vise alors que le gérant, aucun coiffeur n'est « concerné » avant la confirmation.
- **Résolu le 19/10** (K14, K28 ; TRD §6.2, BACKEND_SCHEMA §3, §5) : le rendez-vous saisi par le salon survit et reprend le client, le consentement et le numéro du ticket signalé ; celui-ci est annulé (`merged`, événement `appointment_merged`) et son contact privé est clos. **Reste ouvert (TRD)** : quel lien de suivi le client garde-t-il ensuite (celui du ticket saisi, qu'il n'a jamais reçu s'il n'y avait pas de téléphone, ou sa session sur `/ticket`) ?
- **APP_FLOW F-M13 / DESIGN_SYSTEM** : sur quels critères le rapprochement est-il proposé (même coiffeur, même heure, prénom proche) ? Que faire si plusieurs rendez-vous saisis correspondent ?
- **Résolu le 19/10** (TRD v0.5 §6.2) : `invalid_merge_target` couvre un rendez-vous appelé, annulé ou d'un autre coiffeur. **Reste ouvert (TRD)** : et une cible qui est elle-même un rendez-vous signalé par un client ?
- **Résolu le 19/10** (TRD v0.5 §6.2) : `confirm_appointment` renvoie `appointment_overlap` quand la confirmation sans fusion chevauche un rendez-vous du même coiffeur.
- **Résolu le 19/10** (E17, PRD §5.1) : `appointment_confirmed` et `appointment_rejected` sont des messages indispensables, envoyés sans « Me prévenir ».
- **Résolu le 19/10** (PRD v1.2 §5.4) : « Rendez-vous confirmé » : push, pas de SMS (le client est sur place).
- **Résolu le 19/10** (K21, E19 ; TRD §6.2) : push `appointment_checked_in` au gérant et au coiffeur choisi, un par destinataire, et rappel aux mêmes après 10 min sans confirmation.
- **Résolu le 19/10** (BACKEND_SCHEMA v0.5 §9) : `appointment_pending` est listé sur `salon:{salon_id}` dans les deux documents.
- **Résolu le 19/10** (E19, PRD §5.1) : un signalement non confirmé donne un rappel au salon après 10 min et est annulé avec excuses à la fermeture ; le client peut l'annuler lui-même.
- **Résolu le 19/10** (E20, PRD §5.1, §5.2 règle 7) : les 10 min de priorité se comptent depuis l'heure du rendez-vous, même si le salon confirme tard ; une fois appelé, H4 s'applique.
- **Résolu le 19/10** (E29, PRD §5.1 ; APP_FLOW v0.6 F-M13) : « Refuser » exige un motif choisi dans une liste, envoyé au client.
- **Résolu en partie le 19/10** (dictionnaire REQ-3) : les push, les erreurs et les libellés de la carte existent. **Reste ouvert (dictionnaire, nouveau)** : il manque `notifications.appointment_rejected.reason.<code>` (prévu par TRD §9) et les textes de la boîte de refus côté gérant ; le texte de `client.ticket.end.reason.appointment_rejected` (« Le salon n'a pas retrouvé votre rendez-vous ») ne tient pas compte du motif choisi (E29).
- **En attente de E35 (Ely)** : un client peut-il se signaler pendant une pause de la file (`check_in_appointment` ne renvoie que `queue_closed`) ?
