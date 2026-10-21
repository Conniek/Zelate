# U-14 · Se signaler à son arrivée pour un rendez-vous

**En tant que** client qui a pris rendez-vous ailleurs (Planity, carnet) et qui arrive au salon, **je veux** me signaler en scannant le QR de l'affiche avec l'heure de mon rendez-vous et mon coiffeur, **afin de** suivre mon attente réelle dès que le salon a confirmé mon rendez-vous.

- Priorité : I (PRD §5.3)
- Règles appliquées : H6 (numéro jamais affiché au salon), H10 (rendez-vous du salon) (PRD §5.1) ; un rendez-vous signalé par le client est confirmé d'un geste par le gérant ou le coiffeur concerné (PRD §5.1 « Décisions d'Ely ») ; un seul ticket actif tous salons confondus, case « Me prévenir » décochée par défaut (PRD §5.1 « Autres règles ») ; transitions 1b et 6 (rendez-vous refusé), distribution règles 6 à 8 (PRD §5.2) ; un rendez-vous à confirmer est annulable par le client, rappelé au salon après 10 min et annulé avec excuses à la fermeture (E19) ; priorité de 10 min comptée depuis l'heure du rendez-vous même si le salon confirme tard, puis H4 une fois appelé (E20) ; code du ticket donné à l'appel (E21) ; refus avec motif obligatoire choisi dans une liste, envoyé au client (E29) ; confirmation et refus sont des messages indispensables (E17) ; fusion avec un rendez-vous déjà saisi (K14, K28) ; notifications « Rendez-vous confirmé », « Rendez-vous refusé », « Rendez-vous signalé » (PRD §5.4) ; décisions R2, R4 (PRD §11)
- Parcours : F-C4 (« J'ai rendez-vous ») → F-C12 (étapes 1 à 4) → F-C5 (« Le salon confirme votre rendez-vous… », puis carte ticket d'un rendez-vous) ; confirmation par F-S4 (bandeau « Rendez-vous à confirmer »), F-S10 ou F-M13 (section « À confirmer ») ; garde « ticket actif » (APP_FLOW §2.3) ; événements « Rendez-vous signalé », « Rendez-vous confirmé ou refusé » (APP_FLOW §7)
- Commandes et données : `check_in_appointment` (`salon_id`, `qr_token`, `scheduled_time`, `member_id?`, `service_id?`, `notifications_consent`, `first_name?` ; codes `queue_closed`, `already_has_active_ticket`, `outside_opening_hours`, `invalid_qr_token`) · `confirm_appointment` (`ticket_id`, `decision` = `confirm` | `reject`, `member_id?` obligatoire après « Je ne sais plus », `merge_into_ticket_id?`, `reason_code?` obligatoire pour `reject` ; codes `already_resolved`, `ticket_other_salon`, `member_required`, `invalid_merge_target`, `appointment_overlap`) · `cancel_ticket` (E19) · `queue-tick` (rappel au salon après 10 min, annulation à la fermeture) · tables `tickets` (`kind` = `appointment`, `appointment_source` = `client_check_in`, `channel` = `qr`, `status` = `pending_confirmation`, `scheduled_at`, `assigned_member_id`, `confirmed_at`, `confirmed_by_member_id`, `confirmation_reminder_sent_at`, `estimated_start_at`, `cancel_reason` = `appointment_rejected` | `merged` | `client_cancelled` | `end_of_day`, `removal_reason`), `private.ticket_contacts` (`is_pending_confirmation`), `ticket_events` (`appointment_checked_in`, `appointment_confirmed`, `appointment_rejected`, `appointment_merged`), `notifications` (`appointment_confirmed`, `appointment_rejected`, `appointment_checked_in` et sa variante `reminder`, clés `appointment_checked_in:<member_id>`), `profiles` (création au premier passage, K30 ; `tracking_consent_at` pour information) · canal `salon:{salon_id}` (`appointment_pending`) · composant `PendingConfirmationCard`

## Scénarios

### 1. Choisir « J'ai rendez-vous » après le scan

- **Étant donné** que je scanne le QR de l'affiche d'un salon publié
- **Quand** la page `/q/:qrToken` s'ouvre dans mon navigateur
- **Alors** deux choix sont proposés : « Rejoindre la file » et « J'ai rendez-vous »
- **Quand** je touche « J'ai rendez-vous »
- **Alors** l'étape 1 « Heure » de `/salons/:slug/check-in` s'ouvre (F-C12)

### 2. Me signaler (cas nominal)

- **Étant donné** que je suis connecté, que je n'ai aucun ticket actif et que j'ai rendez-vous à 14h00 avec Léa
- **Quand** je choisis 14h00 à l'étape 1, Léa à l'étape 2, et que je touche « Me signaler » au récapitulatif
- **Alors** un ticket de type rendez-vous est créé au statut « À confirmer » (`pending_confirmation`), d'origine `client_check_in`, au canal `qr`
- **Et** mon numéro est rangé dans le contact privé du ticket (`private.ticket_contacts`, K28)
- **Et** l'heure du rendez-vous enregistrée est 14h00 le jour même (`scheduled_at`)
- **Et** un événement `appointment_checked_in` est ajouté au journal du ticket
- **Et** mon écran « Mon ticket » affiche « Le salon confirme votre rendez-vous… » (F-C5)
- **Et** mon écran n'affiche pas encore d'heure de passage

### 3. Le salon est prévenu

- **Étant donné** que je viens de me signaler pour un rendez-vous avec Léa
- **Quand** mon ticket est créé
- **Alors** le dashboard du gérant affiche le bandeau « Rendez-vous à confirmer » avec mon prénom, l'heure annoncée et Léa
- **Et** l'espace coiffeur de Léa affiche le bandeau « Rendez-vous à confirmer » avec mon prénom et l'heure annoncée
- **Et** ces bandeaux apparaissent en moins de 2 s
- **Et** le gérant et Léa reçoivent chacun une notification push « Rendez-vous à confirmer » (`appointment_checked_in`, une clé par destinataire, K21)
- **Et** cette notification au personnel ne dépend ni de ma case « Me prévenir » ni du plafond de SMS

### 3 bis. Rappel au salon après 10 min sans confirmation (E19)

- **Étant donné** que je me suis signalé à 13h50 et que personne n'a confirmé ni refusé
- **Quand** il est 14h00
- **Alors** le gérant et Léa reçoivent chacun le rappel push « Toujours à confirmer » (`appointment_checked_in.reminder`)
- **Et** l'envoi est enregistré sur le ticket (`confirmation_reminder_sent_at`)
- **Et** aucun second rappel n'est envoyé ensuite
- **Et** la section « À confirmer » du dashboard indique « Signalé il y a plus de 10 min : confirmez ou refusez. »

### 4. « Je ne sais plus » quel coiffeur

- **Étant donné** que je suis à l'étape 2 « Coiffeur »
- **Quand** je choisis « Je ne sais plus » et que je me signale
- **Alors** le ticket est créé au statut « À confirmer » sans coiffeur
- **Et** le dashboard du gérant affiche le bandeau « Rendez-vous à confirmer » et le gérant reçoit la notification push `appointment_checked_in`
- **Quand** le gérant confirme sans choisir de coiffeur
- **Alors** la commande `confirm_appointment` est refusée avec `queue.member_required` et mon ticket reste « À confirmer »
- **Quand** il choisit Léa puis confirme (`member_id`)
- **Alors** mon rendez-vous est confirmé chez Léa (`assigned_member_id`)

### 5. Sélecteur d'heure

- **Étant donné** que je suis à l'étape 1 « Heure »
- **Quand** j'ouvre le sélecteur « Mon rendez-vous est à… »
- **Alors** il ne propose que des heures par pas de 5 min, comprises dans la journée d'ouverture du salon

### 6. Identification si je ne suis pas connecté

- **Étant donné** que je ne suis pas connecté
- **Quand** je passe l'étape 2
- **Alors** l'étape 3 « Identification » s'affiche, comme l'étape 4 de F-C3 (téléphone +33, code à 6 chiffres, prénom au premier passage)
- **Quand** je suis déjà connecté
- **Alors** l'étape 3 n'est pas affichée et j'arrive directement au récapitulatif

### 7. Récapitulatif et consentement décoché

- **Étant donné** que j'arrive à l'étape 4 « Récapitulatif »
- **Quand** elle s'affiche
- **Alors** je vois le salon, l'heure du rendez-vous et le coiffeur (ou « Je ne sais plus »)
- **Et** la case « Me prévenir » est décochée

### 8. Consentement donné

- **Étant donné** que je coche la case « Me prévenir » au récapitulatif
- **Quand** je touche « Me signaler »
- **Alors** la date et l'heure de mon consentement aux notifications de suivi sont enregistrées (`tickets.notifications_consent_at`, K18)
- **Quand** je laisse la case décochée
- **Alors** je reçois quand même la confirmation ou le refus de mon rendez-vous et tous les messages indispensables (E17) ; seuls les messages d'anticipation sont retenus

### 9. Rendez-vous à confirmer : hors calcul

- **Étant donné** que mon ticket est « À confirmer » chez Léa
- **Quand** le moteur recalcule la file
- **Alors** l'heure de passage des autres clients ne change pas à cause de mon ticket
- **Et** mon ticket ne peut pas être appelé tant qu'il n'est pas confirmé

### 10. Confirmation par le coiffeur

- **Étant donné** que mon ticket est « À confirmer » chez Léa
- **Quand** Léa touche « Confirmer » dans son bandeau
- **Alors** mon ticket passe au statut « En attente » (`waiting`)
- **Et** la date de confirmation et Léa sont enregistrées (`confirmed_at`, `confirmed_by_member_id`)
- **Et** un événement `appointment_confirmed` est ajouté au journal
- **Et** je reçois la notification push `appointment_confirmed` avec mon heure de passage, même sans la case « Me prévenir » (E17), sans SMS
- **Et** mon écran affiche l'heure du rendez-vous et l'heure de passage réelle (exemple « Rendez-vous à 14h00 · passage prévu vers 14h20 »), sans position
- **Et** mon écran affiche le code de mon ticket, que je donnerai au coiffeur à l'appel (E21)
- **Et** le rendez-vous entre dans la file de Léa

### 11. Confirmation par le gérant

- **Étant donné** que mon ticket est « À confirmer »
- **Quand** le gérant touche « Confirmer » dans la section « À confirmer » de `/dashboard/appointments`
- **Alors** mon ticket passe au statut « En attente »
- **Et** le gérant est enregistré comme auteur de la confirmation (`confirmed_by_member_id`)

### 12. Confirmation avec fusion d'un rendez-vous déjà saisi

- **Étant donné** que le salon avait déjà saisi mon rendez-vous de 14h00 avec Léa, et que je me signale pour 14h00 avec Léa
- **Quand** le gérant accepte le rapprochement proposé et confirme (`merge_into_ticket_id`)
- **Alors** un seul rendez-vous actif reste dans la file pour moi : celui saisi par le salon (K14)
- **Et** ce rendez-vous reprend mon compte, mon consentement et mon numéro
- **Et** mon ticket signalé est annulé avec le motif `merged`, un événement `appointment_merged` est ajouté au journal et son contact privé est clos (K28)
- **Et** je vois mon heure de passage sur mon écran

### 12 bis. Signalement alors que le salon a déjà saisi mon rendez-vous avec mon numéro (K14, K28)

- **Étant donné** que le salon a saisi mon rendez-vous de 14h00 avec mon numéro, ce qui me donne déjà un ticket actif
- **Quand** je me signale pour 14h00 par le QR de l'affiche
- **Alors** mon signalement est accepté au statut « À confirmer », sans erreur `queue.already_has_active_ticket`
- **Et** le salon voit le rapprochement proposé avec le rendez-vous déjà saisi

### 12 ter. Fusion impossible : `queue.invalid_merge_target`

- **Étant donné** que le rendez-vous saisi proposé pour la fusion a déjà été appelé, annulé, ou appartient à un autre coiffeur
- **Quand** le gérant confirme avec `merge_into_ticket_id` vers ce rendez-vous
- **Alors** la commande est refusée avec `queue.invalid_merge_target`
- **Et** les deux tickets restent inchangés

### 13. Refus par le salon, avec motif (E29)

- **Étant donné** que mon ticket est « À confirmer » et que le salon ne trouve pas mon rendez-vous
- **Quand** le gérant ou Léa touche « Refuser », choisit un motif dans la liste puis valide
- **Alors** mon ticket passe au statut « Annulé », motif `appointment_rejected`
- **Et** le motif choisi est enregistré sur le ticket (`removal_reason`, valeur de la liste `removal_reason` en attendant une liste dédiée 🟡) et dans l'événement `appointment_rejected` (`reason_code`)
- **Et** je reçois une notification push `appointment_rejected` avec ce motif et le bouton « Rejoindre la file », même sans la case « Me prévenir » (E17)
- **Et** aucun SMS n'est envoyé pour ce refus
- **Et** mon écran affiche l'écran de fin avec le motif

### 13 bis. Refus sans motif : `queue.invalid_payload`

- **Étant donné** que mon ticket est « À confirmer »
- **Quand** une commande `confirm_appointment` arrive avec `decision` = `reject` sans `reason_code`
- **Alors** elle est refusée avec `queue.invalid_payload`
- **Et** mon ticket reste « À confirmer »
- **Quand** je touche « Rejoindre la file »
- **Alors** l'étape 1 de F-C3 s'ouvre

### 14. Rendez-vous signalé plus de 10 min après son heure

- **Étant donné** que mon rendez-vous était à 14h00 et que je me signale, puis suis confirmé, à 14h15
- **Quand** le moteur place mon ticket
- **Alors** je ne garde pas la priorité de mon rendez-vous
- **Et** je suis pris dès que possible sans retarder les rendez-vous suivants

### 14 bis. Confirmation tardive par le salon : priorité comptée depuis l'heure du rendez-vous (E20)

- **Étant donné** que mon rendez-vous est à 14h00, que je me suis signalé à 13h55 et que le salon confirme à 14h08
- **Quand** le moteur place mon ticket
- **Alors** je garde la priorité de mon rendez-vous jusqu'à 14h10, 10 min après l'heure du rendez-vous
- **Et** la confirmation tardive ne repousse pas cette limite

### 14 ter. Une fois appelé, la règle des 10 min (E20, E21)

- **Étant donné** que mon rendez-vous confirmé est appelé par Léa
- **Quand** l'appel est enregistré
- **Alors** je reçois « votre tour » par push et par SMS et un compteur de 10 min démarre, comme pour les autres clients (H4)
- **Et** Léa valide mon arrivée en saisissant le code de mon ticket (H7)

### 15. Rendez-vous signalé en avance

- **Étant donné** que mon rendez-vous confirmé est à 14h00, qu'il est 13h40 et que Léa est libre
- **Quand** me prendre maintenant ne retarde personne
- **Alors** Léa peut m'appeler avant 14h00

### 16. File complète : signalement accepté

- **Étant donné** que la file du salon est complète
- **Quand** je me signale pour mon rendez-vous
- **Alors** le ticket « À confirmer » est créé

### 17. Erreur `queue.queue_closed`

- **Étant donné** que la file du salon est fermée
- **Quand** je touche « Me signaler »
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur `queue.queue_closed` s'affiche
- **Et** le cas d'une file en pause attend la réponse d'Ely à E35

### 17 bis. Erreur `queue.invalid_qr_token`

- **Étant donné** que le QR de l'affiche a été régénéré, ou que le jeton appartient à un autre salon
- **Quand** la commande `check_in_appointment` arrive avec ce `qr_token`
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur `queue.invalid_qr_token` s'affiche

### 17 ter. Annuler mon signalement (E19)

- **Étant donné** que mon ticket est « À confirmer »
- **Quand** je touche « Annuler ma place » puis « Oui, annuler »
- **Alors** mon ticket passe au statut « Annulé », motif `client_cancelled`
- **Et** il disparaît des bandeaux « Rendez-vous à confirmer » du gérant et de Léa

### 17 quater. Toujours à confirmer à la fermeture (E19)

- **Étant donné** que mon ticket est toujours « À confirmer » à la dernière fermeture de la journée
- **Quand** l'heure de fermeture arrive
- **Alors** mon ticket passe au statut « Annulé », motif `end_of_day`
- **Et** je reçois un message d'excuse (canal : voir questions ouvertes)

### 18. Erreur `queue.outside_opening_hours`

- **Étant donné** qu'une heure hors des horaires d'ouverture du jour est envoyée dans `scheduled_time`
- **Quand** la commande `check_in_appointment` est traitée
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur `queue.outside_opening_hours` s'affiche

### 19. Erreur `queue.already_has_active_ticket`

- **Étant donné** que j'ai déjà un ticket actif, dans ce salon ou dans un autre (hors le rendez-vous saisi par le salon du scénario 12 bis)
- **Quand** je touche « Me signaler »
- **Alors** aucun second ticket n'est créé
- **Et** le message d'erreur `queue.already_has_active_ticket` s'affiche

### 20. Garde de navigation : ticket déjà actif

- **Étant donné** que je suis connecté avec un ticket actif
- **Quand** j'ouvre `/salons/:slug/check-in`
- **Alors** je suis redirigé vers `/ticket`
- **Et** le message « Vous avez déjà une place » s'affiche

### 21. Un ticket « À confirmer » compte comme ticket actif

- **Étant donné** que mon ticket est « À confirmer »
- **Quand** j'essaie de rejoindre la file d'un autre salon
- **Alors** la commande `join_queue` est refusée avec `queue.already_has_active_ticket`

### 22. Erreurs `queue.rate_limited` et `queue.invalid_payload`

- **Étant donné** que le plafond de création de tickets est atteint, ou que la commande est mal formée (par exemple `scheduled_time` absent, ou `first_name` absent alors que mon compte n'a pas encore de profil, K30)
- **Quand** je touche « Me signaler »
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur correspondant (`queue.rate_limited` ou `queue.invalid_payload`) s'affiche

### 23. Double appui sur « Me signaler »

- **Étant donné** que je suis au récapitulatif
- **Quand** je touche deux fois de suite « Me signaler »
- **Alors** le bouton affiche un état de chargement et se désactive dès le premier appui
- **Et** un seul ticket est créé

### 24. Erreur `queue.already_resolved`

- **Étant donné** que le gérant vient de confirmer mon rendez-vous
- **Quand** Léa touche à son tour « Confirmer » ou « Refuser » sur un bandeau pas encore mis à jour
- **Alors** sa commande `confirm_appointment` est refusée avec `queue.already_resolved`
- **Et** mon ticket garde la décision du gérant

### 25. Erreur `queue.ticket_other_salon`

- **Étant donné** le gérant du salon A
- **Quand** une commande `confirm_appointment` vise un ticket du salon B
- **Alors** elle est refusée avec `queue.ticket_other_salon`
- **Et** le ticket ne change pas

### 26. Erreur `queue.forbidden` : coiffeur non concerné

- **Étant donné** que je me suis signalé pour Léa
- **Quand** Sam, autre coiffeur du salon, envoie `confirm_appointment` pour mon ticket
- **Alors** la commande est refusée avec `queue.forbidden`
- **Et** mon ticket reste « À confirmer »

### 27. Erreur `queue.invalid_transition`

- **Étant donné** un ticket qui n'a jamais été « À confirmer » (ticket de file, ou rendez-vous saisi par le salon)
- **Quand** une commande `confirm_appointment` le vise
- **Alors** elle est refusée et le ticket ne change pas
- **Et** le message d'erreur `queue.invalid_transition` s'affiche

### 28. Mise à jour de mon écran en temps réel

- **Étant donné** que ma page affiche « Le salon confirme votre rendez-vous… »
- **Quand** le salon confirme ou refuse
- **Alors** mon écran se met à jour en moins de 2 s, page ouverte
- **Et** sinon, il se met à jour au plus tard 30 s après, ou dès que je reviens sur l'app

### 29. Confidentialité : le salon ne voit pas mon numéro

- **Étant donné** que mon ticket est « À confirmer »
- **Quand** le gérant consulte le bandeau et que Léa consulte le sien
- **Alors** ils voient mon prénom et l'heure annoncée
- **Et** ni l'un ni l'autre ne voit mon numéro de téléphone, ni sur l'écran ni dans les données reçues
- **Et** le message temps réel `appointment_pending` ne contient aucune donnée personnelle

## Textes à prévoir

| Clé (anglais)                                        | Texte (français)                                                                                              | Contrainte                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `client.qr_entry.join_queue`                         | « Rejoindre la file »                                                                                         | APP_FLOW F-C4 ; partagé avec U-05                                                                     |
| `client.qr_entry.have_appointment`                   | « J'ai rendez-vous »                                                                                          | APP_FLOW F-C4                                                                                         |
| `client.check_in.progress`                           | Étape {step} sur {total}                                                                                      | Indicateur d'étape                                                                                    |
| `client.check_in.time.label`                         | « Mon rendez-vous est à… »                                                                                    | Pas de 5 min, journée d'ouverture                                                                     |
| `client.check_in.stylist.dont_know`                  | « Je ne sais plus »                                                                                           | —                                                                                                     |
| `client.check_in.summary.title`                      | Vérifiez votre rendez-vous                                                                                    | Salon, heure, coiffeur                                                                                |
| `legal.consent.tracking_notifications.label`         | « Me prévenir quand mon tour approche »                                                                       | Case décochée par défaut ; partagé avec U-04                                                          |
| `client.check_in.confirm`                            | « Me signaler »                                                                                               | —                                                                                                     |
| `client.ticket.appointment.pending`                  | « Le salon confirme votre rendez-vous… »                                                                      | Pas d'heure de passage                                                                                |
| `client.ticket.appointment.summary`                  | Rendez-vous à {appointment_time} · passage prévu vers {start_time}                                            | Exemple APP_FLOW F-C5 ; pas de position ; doublon de `client.ticket.appointment.times` (U-06)         |
| `client.ticket.appointment.pending_hint`             | Votre heure de passage s'affichera dès que le salon aura confirmé.                                            | Rendez-vous à confirmer                                                                               |
| `client.ticket.end.removal_reason`                   | Motif : {reason}                                                                                              | Motif du refus (E29)                                                                                  |
| `client.join.guard.already_has_ticket`               | « Vous avez déjà une place »                                                                                  | Partagé avec U-04                                                                                     |
| `pro-stylist.queue.pending_appointment.title`        | Rendez-vous à confirmer                                                                                       | Doublon : `pro-stylist.queue.pending_appointment_banner`                                              |
| `pro-stylist.queue.pending_appointment.banner`       | {first_name} dit avoir rendez-vous à {time}                                                                   | Prénom et heure annoncée, jamais le numéro                                                            |
| `pro-manager.board.pending_appointments.banner`      | {count, plural, one {# rendez-vous à confirmer} other {# rendez-vous à confirmer}}                            | Pluriel ICU                                                                                           |
| `pro-manager.appointments.pending.reminder`          | Signalé il y a plus de 10 min : confirmez ou refusez.                                                         | Après 10 min sans confirmation (E19)                                                                  |
| `notifications.appointment_checked_in.push`          | Voir `notifications.appointment_checked_in.push.*` dans le dictionnaire (2 textes)                            | Au gérant et au coiffeur choisi ; hors consentement et hors plafond                                   |
| `notifications.appointment_checked_in.reminder.push` | Voir `notifications.appointment_checked_in.reminder.push.*` dans le dictionnaire (2 textes)                   | Rappel unique après 10 min (E19)                                                                      |
| `pro-manager.appointments.pending.title`             | « À confirmer »                                                                                               | APP_FLOW F-M13                                                                                        |
| `common.ticket_status.pending_confirmation`          | « À confirmer »                                                                                               | DESIGN_SYSTEM §2.4                                                                                    |
| `common.actions.confirm`                             | « Confirmer »                                                                                                 | —                                                                                                     |
| `common.actions.reject`                              | « Refuser »                                                                                                   | —                                                                                                     |
| `notifications.appointment_confirmed.push`           | Voir `notifications.appointment_confirmed.push.*` dans le dictionnaire (2 textes)                             | Avec l'heure de passage ; message indispensable (E17)                                                 |
| `notifications.appointment_rejected.push`            | Voir `notifications.appointment_rejected.push.*` dans le dictionnaire (2 textes)                              | Push seulement ; variable `reason` (E29) ; bouton « Rejoindre la file » ; message indispensable (E17) |
| `notifications.appointment_rejected.reason.<code>`   | _Absent du dictionnaire_                                                                                      | Textes du motif prévus par TRD §9 ; voir questions ouvertes                                           |
| `client.ticket.end.reason.appointment_rejected`      | Le salon n'a pas retrouvé votre rendez-vous. Vous pouvez rejoindre la file sans rendez-vous.                  | Écran de fin ; texte écrit pour le seul cas « introuvable » (voir questions ouvertes)                 |
| `errors.queue.invalid_qr_token`                      | Ce QR code n'est plus valide. Demandez à l'accueil.                                                           | `check_in_appointment`                                                                                |
| `errors.queue.member_required`                       | Choisissez le coiffeur de ce rendez-vous pour le confirmer.                                                   | Côté salon, après « Je ne sais plus »                                                                 |
| `errors.queue.invalid_merge_target`                  | Ce rendez-vous ne peut plus être regroupé. Confirmez le signalement seul ou choisissez un autre rendez-vous.  | Côté salon                                                                                            |
| `errors.queue.appointment_overlap`                   | Ce créneau chevauche un autre rendez-vous de ce coiffeur. Choisissez une autre heure ou un autre coiffeur.    | Côté salon, à la confirmation                                                                         |
| `errors.queue.queue_closed`                          | La file est fermée : aucune nouvelle inscription n'est possible pour le moment.                               | Partagé avec U-04                                                                                     |
| `errors.queue.outside_opening_hours`                 | Cette heure est en dehors des horaires d'ouverture du salon. Choisissez une heure pendant l'ouverture.        | —                                                                                                     |
| `errors.queue.already_has_active_ticket`             | Ce numéro a déjà une place en cours. Une seule place à la fois est possible.                                  | Partagé avec U-04                                                                                     |
| `errors.queue.already_resolved`                      | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran.                            | Côté salon                                                                                            |
| `errors.queue.ticket_other_salon`                    | Aucun ticket de votre salon ne correspond. Vérifiez le code ou le client concerné.                            | Côté salon                                                                                            |
| `errors.queue.forbidden`                             | Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. | Code commun                                                                                           |
| `errors.queue.invalid_transition`                    | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran.                                | Code commun                                                                                           |
| `errors.queue.rate_limited`                          | Trop de demandes en peu de temps. Patientez quelques minutes, puis réessayez.                                 | Code commun ; partagé avec U-04                                                                       |
| `errors.queue.invalid_payload`                       | Certaines informations sont incomplètes ou incorrectes. Vérifiez-les, puis réessayez.                         | Code commun                                                                                           |

## Questions ouvertes

- **Rattachée à E35** (signalement pendant une pause, en attente d'Ely) — PRD §5.2 transition 1b / TRD §6.2 : la transition 1b n'a aucune condition (« — »), alors que TRD fait refuser `check_in_appointment` avec `queue_closed`. Et une **file en pause** : le signalement est-il accepté (aucun code `queue_paused` pour cette commande) ? Le test du scénario 17 suit le TRD ; il faut aligner le PRD.
- **APP_FLOW F-C12 / TRD §6.2** : la charge utile de `check_in_appointment` contient `service_id?`, mais F-C12 n'a aucune étape « Prestation ». Le client choisit-il sa prestation ? Sinon, quelle durée compte le moteur à la confirmation (30 min comme « je ne sais pas encore » ?) et qui la fixe ?
- **Résolu en partie le 19/10** (TRD v0.5 §6.2) — `confirm_appointment` reçoit `member_id?`, obligatoire après « Je ne sais plus » (`member_required`) ; voir scénario 4. Reste ouvert (TRD §6.2 « coiffeur concerné ») : un coiffeur peut-il confirmer un signalement sans coiffeur choisi ?
- **Résolu le 19/10** (TRD v0.5 §6.2, constat 31) — `check_in_appointment` reçoit `qr_token`, vérifié contre `salons.qr_token` (`invalid_qr_token`) ; le ticket a le canal `qr` ; voir scénarios 2 et 17 bis.
- **Résolu le 19/10** (K14, K28) — Rendez-vous déjà saisi avec mon numéro : le signalement est accepté (l'unicité par numéro exclut `pending_confirmation`) et la fusion est proposée au salon ; voir scénario 12 bis.
- **Résolu le 19/10** (K14) — Fusion : le rendez-vous saisi par le salon survit et reprend mon compte, mon consentement et mon numéro ; mon signalement est annulé (`merged`) ; voir scénario 12. Reste ouvert (APP_FLOW F-C5) : comment mon écran passe-t-il du ticket signalé au ticket qui survit (nouveau code à donner à l'appel, message) ?
- **Résolu en partie le 19/10** (E17) — `appointment_confirmed` et `appointment_rejected` sont indispensables ; voir scénarios 10 et 13. Reste ouvert (PRD §5.4 / APP_FLOW §7) : une notification `ticket_created` part-elle au signalement ? Ni TRD §6.2 ni APP_FLOW §7 ne la citent pour `check_in_appointment`.
- **Résolu le 19/10** (E20) — Priorité de 10 min comptée depuis l'heure du rendez-vous, même si le salon confirme tard ; voir scénario 14 bis.
- **APP_FLOW F-C12** : le sélecteur propose toute « la journée d'ouverture ». Peut-on annoncer une heure déjà passée ? Le code `appointment_in_past` n'existe que pour la saisie par le salon.
- **Résolu en partie le 19/10** (E21) — Le client avec rendez-vous donne son code à l'appel, comme les autres ; l'arrivée n'est pas horodatée à la confirmation ; voir scénarios 10 et 14 ter. Reste ouvert (APP_FLOW F-C5) : le code est-il déjà affiché pendant l'attente de confirmation ?
- **Résolu le 19/10** (E19) — Signalement sans réponse : rappel au gérant et au coiffeur après 10 min, annulation avec excuses à la dernière fermeture ; voir scénarios 3 bis et 17 quater. Reste ouvert (PRD §5.4 / APP_FLOW §7) : modèle et canal du message d'excuse (le client est sur place ; `cancelled_by_salon.end_of_day` par push et SMS ?).
- **Résolu le 19/10** (E19) — Le client peut annuler un ticket « À confirmer » (`cancel_ticket`) ; voir scénario 17 ter.
- **Résolu le 19/10** (K16) — `already_resolved` pour un signalement déjà confirmé ou refusé, `invalid_transition` pour un ticket qui n'a jamais été à confirmer ; voir scénarios 24 et 27.
- **APP_FLOW F-S4 / F-S10** : quand le client a choisi « Je ne sais plus », un coiffeur voit-il le bandeau, ou seulement le gérant ? TRD §6.2 n'envoie le push qu'au gérant et au « coiffeur choisi ».
- **Résolu en partie le 19/10** (dictionnaire) — Indicateur d'étape, récapitulatif, notifications, écran de fin et erreurs rédigés. **Contradiction restante** : TRD §9 prévoit `notifications.appointment_rejected.reason.<code>` pour le motif du refus (E29), absent de `notifications.json` ; et `client.ticket.end.reason.appointment_rejected` dit « Le salon n'a pas retrouvé votre rendez-vous » quel que soit le motif choisi.
- **Liste des motifs (E29, 🟡 Ely pour les libellés, Koni pour l'enum)** : en attendant une liste dédiée, le refus reprend `removal_reason` (`emergency`, `client_request`, `duplicate`, `inappropriate_behaviour`, `other`), pensée pour un retrait ; voir scénario 13.
