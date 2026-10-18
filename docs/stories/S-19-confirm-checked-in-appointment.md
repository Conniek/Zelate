# S-19 · Confirmer ou refuser un rendez-vous signalé par un client

**En tant que** gérant, **je veux** confirmer ou refuser d'un geste le rendez-vous qu'un client signale en arrivant au salon, **afin que** seul un vrai rendez-vous entre dans la file, rapproché de celui que j'avais déjà saisi s'il existe.

- Priorité : I (PRD §5.3)
- Règles appliquées : un rendez-vous est confirmé par le salon, d'un geste, par le gérant ou le coiffeur concerné (PRD §5.1, décisions d'Ely ; R4) ; PRD §5.2 transitions 1b et 6 (« rendez-vous refusé ») ; H10 et PRD §5.2 « Distribution » règles 6 à 8 ; PRD §5.4 « Rendez-vous refusé » (push, pas de SMS : le client est sur place) ; H6 (numéro jamais affiché) ; un seul ticket actif par client (PRD §5.1) ; isolation par salon (PRD §5.1) ; PRD §7.1 principe 2 (refus du double déclenchement)
- Parcours : F-M13 (section « À confirmer », `/dashboard/appointments`) ; F-M6 (bandeau « Rendez-vous à confirmer ») ; côté client F-C12 (fin du parcours) et F-C5 ; événements « Rendez-vous signalé » et « Rendez-vous confirmé ou refusé » (APP_FLOW §7)
- Commandes et données : `confirm_appointment` (`ticket_id`, `decision` = `confirm` | `reject`, `merge_into_ticket_id?`) ; ticket créé avant par `check_in_appointment` (U-14) · lecture `get_salon_board` (rendez-vous à confirmer inclus) · tables `tickets` (`status` `pending_confirmation` → `waiting` ou `cancelled`, `appointment_source` = `client_check_in`, `confirmed_at`, `confirmed_by_member_id`, `cancel_reason` = `appointment_rejected`), `notifications` (`appointment_confirmed`, `appointment_rejected`), `ticket_events` (`appointment_checked_in`, `appointment_confirmed`, `appointment_rejected`), `private.processed_commands` · canaux `salon:{salon_id}` (`appointment_pending`, `queue_updated`), `ticket:{ticket_id}`

## Scénarios

### 1. Un client se signale : le gérant est prévenu
- **Étant donné** Nadia, gérante, sur `/dashboard`
- **Quand** Léa se signale par le QR de l'affiche pour un rendez-vous à 14h30 avec Inès (`check_in_appointment`)
- **Alors** le bandeau « Rendez-vous à confirmer » apparaît sur le dashboard en moins de 2 s
- **Et** la section « À confirmer » de `/dashboard/appointments` affiche le prénom Léa, l'heure annoncée 14h30 et la coiffeuse Inès
- **Et** l'arrivée de la carte est annoncée aux lecteurs d'écran (`aria-live="polite"`, DESIGN_SYSTEM `PendingConfirmationCard`)

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
- **Et** Léa reçoit la notification `appointment_confirmed` par push
- **Et** l'événement `appointment_confirmed` est inscrit au journal, avec Nadia comme actrice

### 4. Confirmer en rapprochant d'un rendez-vous déjà saisi
- **Étant donné** un rendez-vous saisi par le salon pour « Léa » à 14h30 chez Inès (S-18)
- **Et** Léa qui se signale pour 14h30 avec Inès
- **Quand** Nadia ouvre la section « À confirmer »
- **Alors** le rapprochement avec le rendez-vous déjà saisi lui est proposé
- **Quand** elle touche « Confirmer » en acceptant le rapprochement
- **Alors** la commande `confirm_appointment` part avec `decision` = `confirm` et `merge_into_ticket_id` = le rendez-vous saisi
- **Et** un seul rendez-vous de Léa reste actif dans la file d'Inès
- **Et** Léa voit son heure de passage sur son ticket
- **Et** aucun SMS d'inscription n'est envoyé de nouveau

### 5. Refuser un rendez-vous introuvable
- **Étant donné** Léa qui se signale pour 14h30 avec Inès, alors que le salon n'a aucun rendez-vous à ce nom
- **Quand** Nadia touche « Refuser »
- **Alors** la commande `confirm_appointment` part avec `decision` = `reject`
- **Et** le ticket passe au statut « Annulé » avec le motif `appointment_rejected`
- **Et** la carte « À confirmer » disparaît, chez Nadia comme chez Inès, en moins de 2 s
- **Et** Léa reçoit la notification `appointment_rejected` par push, avec « Rejoindre la file »
- **Et** aucun SMS n'est envoyé (le client est sur place, PRD §5.4)
- **Et** l'événement `appointment_rejected` est inscrit au journal, avec Nadia comme actrice

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

### 9. Déjà traité par le coiffeur
- **Étant donné** le rendez-vous signalé de Léa, qu'Inès vient de confirmer depuis son téléphone
- **Quand** Nadia touche « Confirmer » ou « Refuser » sur une carte pas encore rafraîchie
- **Alors** la commande est refusée avec `queue.already_resolved`
- **Et** le message correspondant s'affiche
- **Et** le rendez-vous garde la décision d'Inès
- **Et** une seule notification part vers Léa

### 10. Le client a annulé entre-temps
- **Étant donné** Léa qui a annulé son signalement avant la décision du salon
- **Quand** Nadia touche « Confirmer »
- **Alors** la commande est refusée avec `queue.already_resolved`
- **Et** aucun rendez-vous n'entre dans la file

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
- **Alors** la carte affiche Léa et 14h30, sans coiffeur
- **Et** le comportement de « Confirmer » pour cette carte est à écrire après réponse à la première question ouverte (choix du coiffeur)

### 16. Connexion perdue
- **Étant donné** le dashboard qui affiche « Connexion perdue »
- **Quand** Nadia regarde la section « À confirmer »
- **Alors** « Confirmer » et « Refuser » sont désactivés
- **Et** aucune commande n'est envoyée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.board.pending_appointments.banner` | « Rendez-vous à confirmer » | Libellé indicatif (APP_FLOW F-M6) |
| `pro-manager.appointments.pending.title` | « À confirmer » | Libellé indicatif (APP_FLOW F-M13) |
| `pro-manager.appointments.pending.announced_time` | Rendez-vous annoncé à {time} | Heure annoncée par le client |
| `pro-manager.appointments.pending.merge_suggestion` | Rapprocher du rendez-vous déjà saisi : {first_name}, {time}, avec {stylist_name} | Rapprochement avec un rendez-vous saisi (DESIGN_SYSTEM `PendingConfirmationCard`) |
| `pro-manager.appointments.pending.unknown_stylist` | Coiffeur non précisé par le client | Client qui a choisi « Je ne sais plus » |
| `common.actions.confirm` | « Confirmer » | APP_FLOW F-M13, F-S4 ; partagée avec C-11 |
| `common.actions.reject` | « Refuser » | APP_FLOW F-M13, F-S4 ; partagée avec C-11 |
| `common.ticket_status.pending_confirmation` | « À confirmer » | DESIGN_SYSTEM §2.4 |
| `notifications.appointment_confirmed.push.title` / `.body` |Titre : Rendez-vous confirmé<br>Corps : {salon_name} confirme votre rendez-vous. Passage prévu vers {time}.| Push ; heure de passage (APP_FLOW §7) |
| `notifications.appointment_rejected.push.title` / `.body` |Titre : Rendez-vous non confirmé<br>Corps : {salon_name} n'a pas pu confirmer votre rendez-vous. Vous pouvez rejoindre la file.| Push seulement, pas de SMS (PRD §5.4) ; avec l'action « Rejoindre la file » |
| `client.ticket.appointment_rejected.join_queue` | « Rejoindre la file » | APP_FLOW F-C12, §7 |
| `errors.queue.already_resolved` | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran. | Partagée |
| `errors.queue.ticket_other_salon` | Aucun ticket de votre salon ne correspond. Vérifiez le code ou le client concerné. | Partagée avec C-05, S-12 |
| `errors.queue.forbidden` | Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. | Partagée |

## Questions ouvertes
- **TRD §6.2 / BACKEND_SCHEMA §4.13** : quand le client a choisi « Je ne sais plus », `confirm_appointment` n'a pas de `member_id`, alors qu'un rendez-vous hors `pending_confirmation` doit toujours avoir `assigned_member_id`. Comment le gérant choisit-il le coiffeur à la confirmation ? Et qui est « le coiffeur concerné » (TRD) : aucun coiffeur ne voit-il ce signalement ?
- **TRD §6.2 / BACKEND_SCHEMA** : fusion (`merge_into_ticket_id`) : quel ticket survit (celui du client, rattaché à son compte, ou celui saisi par le salon, qui porte peut-être un téléphone dans `private.ticket_contacts`) ? Que devient l'autre (statut, `cancel_reason` : aucune valeur ne convient) ? Quel événement de journal trace la fusion ? Quel lien de suivi et quel numéro reçoivent ensuite les notifications ?
- **APP_FLOW F-M13 / DESIGN_SYSTEM** : sur quels critères le rapprochement est-il proposé (même coiffeur, même heure, prénom proche) ? Que faire si plusieurs rendez-vous saisis correspondent ?
- **TRD §6.2** : codes d'erreur quand `merge_into_ticket_id` désigne un rendez-vous déjà appelé, annulé, signalé par un client (et non saisi par le salon) ou d'un autre coiffeur. Seul `ticket_other_salon` couvre l'autre salon.
- **TRD §6.2** : confirmer sans fusion un rendez-vous qui chevauche un rendez-vous déjà saisi chez le même coiffeur : accepté, ou refusé ? `appointment_overlap` n'est pas listé pour `confirm_appointment`.
- **PRD §5.4 / BACKEND_SCHEMA §3 et §4.16** : `appointment_confirmed` et `appointment_rejected` ne sont pas des modèles indispensables. Un client qui n'a pas coché « Me prévenir » (décochée par défaut, F-C12) ne les recevrait donc pas (`skipped`, `no_consent`). Voulu, ou sont-ils indispensables ?
- **PRD §5.4** : le tableau n'a pas de ligne « Rendez-vous confirmé ». Canal : push seulement, ou SMS si pas de push (et dans le plafond) ?
- **TRD §6.2 / APP_FLOW §7** : `check_in_appointment` « prévient le gérant et le coiffeur choisi ». Par quel moyen, quand le dashboard ou l'app Pro n'est pas ouvert ? Aucun modèle de notification ne vise un membre pour cet événement.
- **TRD §6.4 / BACKEND_SCHEMA §9** : TRD liste l'événement `appointment_pending` sur `salon:{salon_id}`, BACKEND_SCHEMA §9 ne le liste pas.
- **PRD §5.2 / TRD** : un rendez-vous signalé que personne ne confirme reste-t-il indéfiniment « À confirmer » ? Que devient-il à la fermeture (fin de journée H9) ? Bloque-t-il le client, puisqu'il compte comme ticket actif ?
- **PRD §5.2 règle 7** : pour un client qui se signale en retard, le retard se compte-t-il à partir de l'heure annoncée par le client, et la confirmation tardive du salon le pénalise-t-elle (signalé à 14h35, confirmé à 14h45 pour 14h30) ?
- **APP_FLOW F-M13** : « Refuser » n'a pas de motif. Le client reçoit-il seulement « rendez-vous introuvable » (F-C12) ? Faut-il un motif structuré, comme pour un retrait ?
- **Textes** : modèles push, messages d'erreur et libellés de la carte absents des documents.
