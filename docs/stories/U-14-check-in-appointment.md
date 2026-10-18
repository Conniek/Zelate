# U-14 · Se signaler à son arrivée pour un rendez-vous

**En tant que** client qui a pris rendez-vous ailleurs (Planity, carnet) et qui arrive au salon, **je veux** me signaler en scannant le QR de l'affiche avec l'heure de mon rendez-vous et mon coiffeur, **afin de** suivre mon attente réelle dès que le salon a confirmé mon rendez-vous.

- Priorité : I (PRD §5.3)
- Règles appliquées : H6 (numéro jamais affiché au salon), H10 (rendez-vous du salon) (PRD §5.1) ; un rendez-vous signalé par le client est confirmé d'un geste par le gérant ou le coiffeur concerné (PRD §5.1 « Décisions d'Ely ») ; un seul ticket actif tous salons confondus, case « Me prévenir » décochée par défaut (PRD §5.1 « Autres règles ») ; transitions 1b et 6 (rendez-vous refusé), distribution règles 6 à 8 (PRD §5.2) ; notification « Rendez-vous refusé » (PRD §5.4) ; décisions R2, R4, K11 (PRD §11)
- Parcours : F-C4 (« J'ai rendez-vous ») → F-C12 (étapes 1 à 4) → F-C5 (« Le salon confirme votre rendez-vous… », puis carte ticket d'un rendez-vous) ; confirmation par F-S4 (bandeau « Rendez-vous à confirmer »), F-S10 ou F-M13 (section « À confirmer ») ; garde « ticket actif » (APP_FLOW §2.3) ; événements « Rendez-vous signalé », « Rendez-vous confirmé ou refusé » (APP_FLOW §7)
- Commandes et données : `check_in_appointment` (`salon_id`, `scheduled_time`, `member_id?`, `service_id?`, `notifications_consent`) · `confirm_appointment` (`ticket_id`, `decision` = `confirm` | `reject`, `merge_into_ticket_id?`) · tables `tickets` (`kind` = `appointment`, `appointment_source` = `client_check_in`, `status` = `pending_confirmation`, `scheduled_at`, `assigned_member_id`, `confirmed_at`, `confirmed_by_member_id`, `estimated_start_at`, `cancel_reason` = `appointment_rejected`), `ticket_events` (`appointment_checked_in`, `appointment_confirmed`, `appointment_rejected`), `notifications` (`appointment_confirmed`, `appointment_rejected`), `profiles` (`tracking_consent_at`) · canal `salon:{salon_id}` (`appointment_pending`) · composant `PendingConfirmationCard`

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
- **Alors** un ticket de type rendez-vous est créé au statut « À confirmer » (`pending_confirmation`), d'origine `client_check_in`
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

### 4. « Je ne sais plus » quel coiffeur
- **Étant donné** que je suis à l'étape 2 « Coiffeur »
- **Quand** je choisis « Je ne sais plus » et que je me signale
- **Alors** le ticket est créé au statut « À confirmer » sans coiffeur
- **Et** le dashboard du gérant affiche le bandeau « Rendez-vous à confirmer »

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
- **Alors** la date et l'heure de mon consentement aux notifications de suivi sont enregistrées (`profiles.tracking_consent_at`)

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
- **Et** je reçois la notification push `appointment_confirmed` avec mon heure de passage
- **Et** mon écran affiche l'heure du rendez-vous et l'heure de passage réelle (exemple « Rendez-vous à 14h00 · passage prévu vers 14h20 »), sans position
- **Et** le rendez-vous entre dans la file de Léa

### 11. Confirmation par le gérant
- **Étant donné** que mon ticket est « À confirmer »
- **Quand** le gérant touche « Confirmer » dans la section « À confirmer » de `/dashboard/appointments`
- **Alors** mon ticket passe au statut « En attente »
- **Et** le gérant est enregistré comme auteur de la confirmation (`confirmed_by_member_id`)

### 12. Confirmation avec fusion d'un rendez-vous déjà saisi
- **Étant donné** que le salon avait déjà saisi mon rendez-vous de 14h00 avec Léa, et que je me signale pour 14h00 avec Léa
- **Quand** le gérant accepte le rapprochement proposé et confirme (`merge_into_ticket_id`)
- **Alors** un seul rendez-vous actif reste dans la file pour moi
- **Et** je vois mon heure de passage sur mon écran

### 13. Refus par le salon
- **Étant donné** que mon ticket est « À confirmer » et que le salon ne trouve pas mon rendez-vous
- **Quand** le gérant ou Léa touche « Refuser »
- **Alors** mon ticket passe au statut « Annulé », motif `appointment_rejected`
- **Et** un événement `appointment_rejected` est ajouté au journal
- **Et** je reçois une notification push `appointment_rejected` avec le bouton « Rejoindre la file »
- **Et** aucun SMS n'est envoyé pour ce refus
- **Et** mon écran affiche l'écran de fin
- **Quand** je touche « Rejoindre la file »
- **Alors** l'étape 1 de F-C3 s'ouvre

### 14. Rendez-vous signalé plus de 10 min après son heure
- **Étant donné** que mon rendez-vous était à 14h00 et que je me signale, puis suis confirmé, à 14h15
- **Quand** le moteur place mon ticket
- **Alors** je ne garde pas la priorité de mon rendez-vous
- **Et** je suis pris dès que possible sans retarder les rendez-vous suivants

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

### 18. Erreur `queue.outside_opening_hours`
- **Étant donné** qu'une heure hors des horaires d'ouverture du jour est envoyée dans `scheduled_time`
- **Quand** la commande `check_in_appointment` est traitée
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur `queue.outside_opening_hours` s'affiche

### 19. Erreur `queue.already_has_active_ticket`
- **Étant donné** que j'ai déjà un ticket actif, dans ce salon ou dans un autre
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
- **Étant donné** que le plafond de création de tickets est atteint, ou que la commande est mal formée (par exemple `scheduled_time` absent)
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
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.qr_entry.join_queue` | « Rejoindre la file » | APP_FLOW F-C4 ; partagé avec U-05 |
| `client.qr_entry.have_appointment` | « J'ai rendez-vous » | APP_FLOW F-C4 |
| `client.check_in.progress` | _À rédiger (absent des docs)_ | Indicateur d'étape |
| `client.check_in.time.label` | « Mon rendez-vous est à… » | Pas de 5 min, journée d'ouverture |
| `client.check_in.stylist.dont_know` | « Je ne sais plus » | — |
| `client.check_in.summary.title` | _À rédiger (absent des docs)_ | Salon, heure, coiffeur |
| `legal.consent.tracking_notifications.label` | « Me prévenir quand mon tour approche » (libellé de F-C3 ; F-C12 dit seulement « Me prévenir ») | Case décochée par défaut ; partagé avec U-04 |
| `client.check_in.confirm` | « Me signaler » | — |
| `client.ticket.appointment.pending` | « Le salon confirme votre rendez-vous… » | Pas d'heure de passage |
| `client.ticket.appointment.summary` | « Rendez-vous à {scheduledTime} · passage prévu vers {startTime} » | Exemple APP_FLOW F-C5 ; pas de position |
| `client.join.guard.already_has_ticket` | « Vous avez déjà une place » | Partagé avec U-04 |
| `pro-stylist.queue.pending_appointment.banner` | « Rendez-vous à confirmer » | Prénom et heure annoncée |
| `pro-manager.board.pending_appointments.banner` | « Rendez-vous à confirmer » | — |
| `pro-manager.appointments.pending.title` | « À confirmer » | APP_FLOW F-M13 |
| `common.ticket_status.pending_confirmation` | « À confirmer » | DESIGN_SYSTEM §2.4 |
| `common.actions.confirm` | « Confirmer » | — |
| `common.actions.reject` | « Refuser » | — |
| `notifications.appointment_confirmed.push` | _À rédiger (absent des docs)_ | Avec l'heure de passage |
| `notifications.appointment_rejected.push` | _À rédiger (absent des docs)_ | Push seulement ; bouton « Rejoindre la file » |
| `client.ticket.end.reason.appointment_rejected` | _À rédiger (absent des docs)_ | Écran de fin |
| `errors.queue.queue_closed` | _À rédiger (absent des docs)_ | Partagé avec U-04 |
| `errors.queue.outside_opening_hours` | _À rédiger (absent des docs)_ | — |
| `errors.queue.already_has_active_ticket` | _À rédiger (absent des docs)_ | Partagé avec U-04 |
| `errors.queue.already_resolved` | _À rédiger (absent des docs)_ | Côté salon |
| `errors.queue.ticket_other_salon` | _À rédiger (absent des docs)_ | Côté salon |
| `errors.queue.forbidden` | _À rédiger (absent des docs)_ | Code commun |
| `errors.queue.invalid_transition` | _À rédiger (absent des docs)_ | Code commun |
| `errors.queue.rate_limited` | _À rédiger (absent des docs)_ | Code commun ; partagé avec U-04 |
| `errors.queue.invalid_payload` | _À rédiger (absent des docs)_ | Code commun |

## Questions ouvertes
- **PRD §5.2 transition 1b / TRD §6.2** : la transition 1b n'a aucune condition (« — »), alors que TRD fait refuser `check_in_appointment` avec `queue_closed`. Et une **file en pause** : le signalement est-il accepté (aucun code `queue_paused` pour cette commande) ? Le test du scénario 17 suit le TRD ; il faut aligner le PRD.
- **APP_FLOW F-C12 / TRD §6.2** : la charge utile de `check_in_appointment` contient `service_id?`, mais F-C12 n'a aucune étape « Prestation ». Le client choisit-il sa prestation ? Sinon, quelle durée compte le moteur à la confirmation (30 min comme « je ne sais pas encore » ?) et qui la fixe ?
- **TRD §6.2 / BACKEND_SCHEMA §4.13** : `confirm_appointment` n'a pas de `member_id`. Pour un client qui a choisi « Je ne sais plus », comment le gérant fixe-t-il le coiffeur à la confirmation, alors qu'un rendez-vous confirmé doit toujours avoir `assigned_member_id` ? Un coiffeur peut-il confirmer un tel ticket ?
- **APP_FLOW F-C12 / TRD §6.2** : « Accessible seulement depuis le QR de l'affiche » ; mais `check_in_appointment` ne reçoit aucun jeton de QR et la route `/salons/:slug/check-in` est publique. Comment le serveur vérifie-t-il l'origine ? Quel canal (`channel`) reçoit le ticket : `qr` (F-C4) ?
- **PRD §5.2 transition 1 / BACKEND_SCHEMA §5** : si le salon a saisi mon rendez-vous **avec mon numéro**, ce ticket est actif pour mon numéro (`private.ticket_contacts`). Mon signalement est alors refusé (`already_has_active_ticket`) et la fusion du scénario 12 ne peut pas avoir lieu. Faut-il, dans ce cas, rattacher le ticket existant à mon compte plutôt que refuser ?
- **TRD §6.2 / APP_FLOW F-M13** : lors d'une fusion, quel ticket survit (le mien ou celui saisi par le salon) ? Mon code de ticket, mon consentement et mon lien de suivi changent-ils ?
- **PRD §5.4 / APP_FLOW §7** : une notification `ticket_created` part-elle au signalement ? L'événement « Ticket créé » ne cite pas `check_in_appointment`. Et `appointment_confirmed` (push seulement d'après APP_FLOW §7) est-il indispensable au sens de K11, ou est-il bloqué (`no_consent`) quand la case « Me prévenir » est décochée ? Il est absent de la colonne « Rendez-vous confirmé » du PRD §5.4.
- **PRD §5.2 règles 7 / R2** : pour un rendez-vous signalé en retard, les 10 min de priorité se comptent-elles jusqu'au signalement ou jusqu'à la confirmation par le salon ? Si le salon met 15 min à confirmer un client arrivé à l'heure, celui-ci perd-il sa priorité ?
- **APP_FLOW F-C12** : le sélecteur propose toute « la journée d'ouverture ». Peut-on annoncer une heure déjà passée ? Le code `appointment_in_past` n'existe que pour la saisie par le salon.
- **APP_FLOW F-M13 / H7** : le client signalé est sur place. Son arrivée est-elle horodatée à la confirmation (`arrived_at`, statut « arrivé » de F-M13), ou doit-il encore donner son code de ticket au coiffeur ? Son code de ticket est-il affiché pendant l'attente de confirmation ?
- **PRD §5.2 / H9** : que devient un ticket resté « À confirmer » sans réponse du salon (délai, fin de journée, fermeture) ? Aucune échéance n'est prévue, et il bloque le client (un seul ticket actif).
- **APP_FLOW F-C5 / F-C8** : le client peut-il annuler (`cancel_ticket`) un ticket « À confirmer » ? Le bouton « Annuler ma place » est-il affiché dans cet état ?
- **TRD §6.2** : pour `confirm_appointment`, la frontière entre `already_resolved` (propre à la commande) et `invalid_transition` (code commun) n'est pas écrite. Les scénarios 24 et 27 supposent : `already_resolved` pour un signalement déjà confirmé ou refusé, `invalid_transition` pour un ticket qui n'a jamais été à confirmer. À confirmer.
- **APP_FLOW F-S4 / F-S10** : quand le client a choisi « Je ne sais plus », un coiffeur voit-il le bandeau, ou seulement le gérant ?
- **Textes** : l'indicateur d'étape, le titre du récapitulatif, les notifications de confirmation et de refus, l'écran de fin après refus et les messages d'erreur ne figurent dans aucun document.
