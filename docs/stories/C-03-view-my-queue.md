# C-03 · Voir ma file

**En tant que** coiffeur, **je veux** voir sur mon téléphone mes prochains clients, avec le prochain en haut, **afin de** savoir qui je prends ensuite sans interrompre ma prestation.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1, H5 (aucune réorganisation libre), H6, H8, H10 ; PRD §5.2 transition 1b, « Distribution » règles 3, 4 et 6 à 8, « Calcul de l'heure de passage » (un rendez-vous ne commence jamais avant son heure, sauf coiffeur libre sans retarder personne) ; PRD §5.1 « La spécialité d'une prestation est facultative ; « je ne sais pas encore » est accepté par tous les coiffeurs » (E12), « Un rendez-vous est confirmé par le salon », « Aucune donnée client n'est stockée sur le téléphone du coiffeur » et isolation par salon ; PRD §5.1 « Me prévenir » (rendez-vous confirmé ou refusé = messages indispensables, E17), priorité d'un rendez-vous (E20, E21), annuler ou refuser un rendez-vous avec un motif (E29) ; PRD §5.2 « Prévenir avant de partir » (« en retard de X min » = retard du salon, dès 10 min, E30) ; PRD §6 (perte de connexion, repli 10 s)
- Parcours : F-S4 (APP_FLOW §4) ; F-C12 côté client ; événements « Ticket créé », « Votre tour approche », « Rendez-vous signalé », « Rendez-vous confirmé ou refusé » (APP_FLOW §7)
- Commandes et données : RPC `get_stylist_queue` (ticket en cours, ticket appelé, rendez-vous à confirmer qui le visent, « Ensuite » = tickets dont il est le coiffeur pressenti `estimated_member_id` ou qui le demandent, ses rendez-vous du jour ; TRD §6.3) ; `confirm_appointment` (`decision`, `reason_code` obligatoire si `reject`, E29 ; codes `queue.already_resolved`, `queue.ticket_other_salon`, `queue.member_required`, `queue.invalid_merge_target`, `queue.appointment_overlap` ; `reject` sans motif : `queue.invalid_payload`) · tables `tickets` (`kind`, `scheduled_at`, `appointment_source`, `confirmed_at`, `confirmed_by_member_id`, `removal_reason`), `services`, `member_specialties`, `stylist_presence`, `notifications` (`appointment_checked_in`, `appointment_confirmed`, `appointment_rejected`) · canal `salon:{salon_id}` (`queue_updated`, `appointment_pending`) · composants `AppointmentBadge`, `PendingConfirmationCard` (DESIGN_SYSTEM)

## Scénarios

### 1. Prochain client qui me demande

- **Étant donné** Inès, coiffeuse « Disponible »
- **Et** le premier ticket éligible pour elle est celui de Léa, qui a demandé Inès, pour une prestation de 30 min, et qui a répondu « Je serai à l'heure » à T-30
- **Quand** Inès ouvre « Ma file » (`/stylist/queue`)
- **Alors** la carte « Prochain client » en haut de l'écran affiche le prénom Léa, la prestation et la durée de 30 min
- **Et** la carte affiche le statut d'approche et la réponse T-30 de Léa
- **Et** la carte porte la mention « Vous demande »
- **Et** le bouton « Appeler » de la barre du bas est actif

### 2. Tickets non éligibles sautés sans perdre leur rang

- **Étant donné** Inès « Disponible », qui maîtrise la spécialité `men_cut` et pas `color`
- **Et** la file du salon contient, dans l'ordre d'inscription : le ticket 1 qui demande un autre coiffeur, le ticket 2 sans préférence pour une prestation qui requiert `color`, le ticket 3 sans préférence pour une prestation qui requiert `men_cut`
- **Quand** Inès ouvre « Ma file »
- **Alors** la carte « Prochain client » affiche le ticket 3
- **Et** le ticket 1 n'apparaît nulle part dans l'espace d'Inès
- **Et** le ticket 2 n'apparaît nulle part dans l'espace d'Inès
- **Et** sur le dashboard, les tickets 1 et 2 gardent leur rang dans la file du salon

### 2 bis. « Je ne sais pas encore » éligible pour tous les coiffeurs (E12)

- **Étant donné** Inès « Disponible », qui maîtrise `men_cut` seulement
- **Et** le premier ticket de la file est sans préférence, inscrit avec « Je ne sais pas encore » (`service_id` vide)
- **Quand** Inès ouvre « Ma file »
- **Alors** la carte « Prochain client » affiche ce ticket
- **Et** la durée affichée est de 30 min

### 2 ter. Prestation sans spécialité requise (E12)

- **Étant donné** Inès « Disponible », qui maîtrise `men_cut` seulement
- **Et** le premier ticket de la file est sans préférence, pour une prestation sans spécialité requise (`services.required_specialty_code` vide)
- **Quand** Inès ouvre « Ma file »
- **Alors** la carte « Prochain client » affiche ce ticket

### 3. Client qui a déclaré une heure d'arrivée plus tardive (H8)

- **Étant donné** il est 14h40
- **Et** le ticket 1, sans préférence et éligible pour Inès, a déclaré « J'arrive vers 15h00 » et n'est pas arrivé
- **Et** le ticket 2, inscrit après, est éligible pour Inès
- **Quand** Inès ouvre « Ma file »
- **Alors** la carte « Prochain client » affiche le ticket 2

### 4. Réponse T-30 affichée en temps réel

- **Étant donné** Inès qui regarde « Ma file », où figure Léa
- **Quand** Léa répond « En retard de 15 min » à « votre tour approche »
- **Alors** en moins de 2 s, la carte ou la ligne de Léa indique « En retard de 15 min »

### 5. Nouveau ticket

- **Étant donné** Inès qui regarde « Ma file »
- **Quand** un client rejoint la file en demandant Inès
- **Alors** en moins de 2 s, ce client apparaît dans la liste « Ensuite » d'Inès

### 6. Liste « Ensuite » en lecture seule

- **Étant donné** Inès avec plusieurs clients dans sa liste « Ensuite »
- **Quand** elle tente de déplacer un client dans la liste (glisser-déposer) ou de toucher une ligne pour l'appeler
- **Alors** l'ordre de la liste ne change pas
- **Et** aucun client n'est appelé depuis la liste

### 7. Aucun client

- **Étant donné** Inès « Disponible » et aucun ticket éligible pour elle
- **Quand** elle ouvre « Ma file »
- **Alors** l'écran affiche « Aucun client pour l'instant. Les prochains s'afficheront ici. »
- **Et** le bouton « Appeler » est désactivé

### 8. Appeler désactivé hors disponibilité

- **Étant donné** Inès « En pause », « Fin de journée » ou « Hors ligne », avec des tickets éligibles
- **Quand** elle ouvre « Ma file »
- **Alors** le bouton « Appeler » est désactivé

### 9. Connexion perdue

- **Étant donné** Inès qui regarde « Ma file »
- **Quand** son téléphone perd la connexion au serveur
- **Alors** un bandeau rouge « Connexion perdue. Reconnexion en cours… » s'affiche
- **Et** toutes les actions de l'espace coiffeur sont désactivées
- **Et** la reconnexion est tentée automatiquement

### 10. Retour de la connexion

- **Étant donné** Inès dont l'écran affiche « Connexion perdue »
- **Quand** la connexion revient
- **Alors** le bandeau rouge disparaît
- **Et** le message « Connexion rétablie » s'affiche
- **Et** la file affichée est relue et à jour
- **Et** les actions redeviennent disponibles

### 11. Repli sans temps réel

- **Étant donné** Inès connectée, mais sans canal temps réel actif
- **Quand** la file change côté serveur
- **Alors** « Ma file » est mise à jour dans les 10 s

### 12. Jamais de numéro de téléphone

- **Étant donné** Inès qui regarde « Ma file » avec des clients inscrits par l'app, par le QR de l'affiche et à l'accueil
- **Quand** l'écran s'affiche
- **Alors** aucun numéro de téléphone n'apparaît à l'écran
- **Et** la réponse de `get_stylist_queue` ne contient ni numéro de téléphone, ni `tracking_token`, ni `tracking_short_code` (lien `/t/:shortCode`)
- **Et** chaque client est désigné par son seul prénom

### 13. Rien du client conservé sur le téléphone

- **Étant donné** Inès qui a consulté « Ma file »
- **Quand** elle ferme Zelaté Pro, coupe le réseau et la rouvre
- **Alors** aucun prénom ni aucune donnée de ticket ne s'affiche
- **Et** le stockage local du navigateur (`localStorage`, IndexedDB, cache du service worker) ne contient aucune donnée client

### 14. Isolation entre salons

- **Étant donné** Inès, coiffeuse du salon A, et des tickets actifs au salon B
- **Quand** elle ouvre « Ma file »
- **Alors** aucun ticket du salon B n'apparaît
- **Et** elle ne peut pas s'abonner au canal `salon:{salon_id}` du salon B

### 15. Accès retiré pendant la consultation

- **Étant donné** Inès qui regarde « Ma file »
- **Quand** le gérant la désactive ou coupe ses sessions
- **Alors** la file n'est plus affichée sur son téléphone
- **Et** `get_stylist_queue` ne lui renvoie plus aucun ticket

### 16. Pas d'accès à la vue du salon (K9)

- **Étant donné** Inès, coiffeuse active du salon A
- **Quand** une lecture `get_salon_board` du salon A est envoyée avec son compte
- **Alors** la lecture est refusée
- **Et** aucun ticket n'est renvoyé

### 17. Rendez-vous à son heure

- **Étant donné** Marc, qui a un rendez-vous à 14h30 avec Inès (`kind` = `appointment`, `scheduled_at` = 14h30), pas encore appelé
- **Et** des tickets sans préférence éligibles pour Inès, inscrits avant la saisie du rendez-vous
- **Quand** il est 14h30 et Inès est « Disponible »
- **Alors** la carte « Prochain client » affiche Marc
- **Et** la carte porte le badge « RDV 14h30 »

### 18. Un client sans rendez-vous ne passe avant que s'il finit avant (règle 6)

- **Étant donné** il est 14h00, Inès « Disponible », et Marc a rendez-vous avec elle à 14h30
- **Et** la file contient, dans l'ordre d'inscription : Karim, sans préférence, prestation de 45 min ; Léa, sans préférence, prestation de 20 min ; tous deux éligibles pour Inès
- **Quand** Inès ouvre « Ma file »
- **Alors** la carte « Prochain client » affiche Léa (fin prévue 14h20, avant 14h30)
- **Et** Karim n'est pas proposé à Inès avant le rendez-vous de Marc (fin prévue 14h45, après 14h30)
- **Et** sur le dashboard, Karim garde son rang dans la file du salon

### 19. Rendez-vous en retard de 10 min au plus (règle 7)

- **Étant donné** Marc, rendez-vous à 14h30 avec Inès, pas encore pris
- **Et** Léa, sans préférence, éligible pour Inès, inscrite avant la saisie du rendez-vous
- **Quand** Inès se libère à 14h38
- **Alors** la carte « Prochain client » affiche Marc avec le badge « RDV 14h30 »

### 20. Rendez-vous en retard de plus de 10 min (règle 7)

- **Étant donné** Marc, rendez-vous à 14h30 avec Inès, prestation de 30 min, pas encore pris
- **Et** Paul, rendez-vous à 15h10 avec Inès
- **Et** Léa, sans préférence, prestation de 15 min, éligible pour Inès
- **Quand** Inès se libère à 14h45
- **Alors** la carte « Prochain client » n'affiche pas Marc (il finirait à 15h15, après le rendez-vous de Paul)
- **Et** elle affiche Léa (fin prévue 15h00, avant 15h10)

### 21. Rendez-vous pris en avance (règle 8)

- **Étant donné** il est 14h10, Inès « Disponible », sans aucun autre ticket éligible pour elle
- **Et** Marc, rendez-vous à 14h30 avec Inès (présence de Marc au salon : voir questions)
- **Quand** Inès ouvre « Ma file »
- **Alors** la carte « Prochain client » affiche Marc avec le badge « RDV 14h30 »

### 21 bis. Retard du salon sur un rendez-vous affiché dès 10 min (E30)

- **Étant donné** Marc, rendez-vous à 14h30 avec Inès, dont l'heure de passage est 14h35
- **Quand** Inès regarde « Ma file »
- **Alors** la ligne de Marc porte le badge « RDV 14h30 », sans retard affiché
- **Quand** l'heure de passage de Marc devient 14h40
- **Alors** la ligne de Marc porte le badge « RDV 14h30 · +10 min » (retard du salon sur l'heure du rendez-vous)

### 21 ter. Priorité d'un rendez-vous confirmé tard (E20)

- **Étant donné** Paul, qui s'est signalé pour un rendez-vous à 14h30 avec Inès, confirmé par Inès à 14h35, et Léa, sans préférence, éligible pour Inès, inscrite avant
- **Quand** Inès se libère à 14h38
- **Alors** la carte « Prochain client » affiche Paul avec le badge « RDV 14h30 » (10 min de priorité comptées depuis 14h30, pas depuis la confirmation)

### 22. Bandeau « Rendez-vous à confirmer »

- **Étant donné** Inès qui regarde « Ma file »
- **Quand** Paul se signale au salon pour un rendez-vous à 15h00 avec Inès (F-C12, `check_in_appointment`)
- **Alors** en moins de 2 s, le bandeau « Rendez-vous à confirmer » affiche « Paul dit avoir rendez-vous à 15h00 »
- **Et** le bandeau propose « Confirmer » et « Refuser »
- **Et** une notification push `appointment_checked_in` « Rendez-vous à confirmer » est créée pour Inès, coiffeuse choisie (clé `appointment_checked_in:<member_id>`, K21)
- **Et** le ticket de Paul (`pending_confirmation`) n'apparaît ni dans « Prochain client » ni dans « Ensuite »
- **Et** l'heure de passage des autres clients d'Inès ne change pas (ticket hors calcul, transition 1b)

### 23. Confirmer un rendez-vous signalé

- **Étant donné** le bandeau « Rendez-vous à confirmer » de Paul (15h00) chez Inès
- **Quand** Inès touche « Confirmer »
- **Alors** le ticket de Paul passe de « À confirmer » à « En attente » (`confirmed_at` renseigné, `confirmed_by_member_id` = Inès)
- **Et** le bandeau disparaît
- **Et** le rendez-vous entre dans la file d'Inès avec le badge « RDV 15h00 »
- **Et** l'heure de passage des clients d'Inès est recalculée
- **Et** Paul voit son heure de passage sur son ticket (F-C5)
- **Et** Paul reçoit la notification push `appointment_confirmed`, qu'il ait coché « Me prévenir » ou non (message indispensable, E17)
- **Et** le journal du ticket enregistre un événement `appointment_confirmed` avec Inès comme actrice

### 24. Refuser un rendez-vous signalé

- **Étant donné** le bandeau « Rendez-vous à confirmer » de Paul chez Inès, qui ne trouve pas ce rendez-vous
- **Quand** Inès touche « Refuser », choisit un motif dans la liste (par exemple `other`) et valide
- **Alors** le ticket de Paul passe à « Annulé » (`cancel_reason` = `appointment_rejected`)
- **Et** le motif choisi est enregistré (`removal_reason`)
- **Et** le bandeau disparaît
- **Et** Paul reçoit la notification push `appointment_rejected` avec le motif et « Rejoindre la file », sans SMS, même sans « Me prévenir » (E17, E29)
- **Et** le journal du ticket enregistre un événement `appointment_rejected` avec le motif (`reason_code`)

### 24 bis. Refus sans motif (E29)

- **Étant donné** le bandeau « Rendez-vous à confirmer » de Paul chez Inès
- **Quand** une commande `confirm_appointment` est envoyée avec `decision` = `reject` sans `reason_code`
- **Alors** la commande est refusée avec `queue.invalid_payload`
- **Et** le ticket de Paul reste « À confirmer »
- **Et** aucune notification n'est créée pour Paul

### 25. Rendez-vous déjà traité par le gérant

- **Étant donné** le rendez-vous signalé de Paul, déjà confirmé par le gérant depuis le dashboard, et le bandeau encore affiché chez Inès
- **Quand** Inès touche « Refuser » et valide un motif
- **Alors** la commande est refusée avec `queue.already_resolved`
- **Et** un message du dictionnaire `errors` s'affiche
- **Et** le ticket de Paul reste « En attente »

### 26. Rendez-vous d'un autre salon

- **Étant donné** Inès, coiffeuse du salon A, et un rendez-vous à confirmer au salon B
- **Quand** une commande `confirm_appointment` est envoyée avec son compte pour ce ticket
- **Alors** la commande est refusée avec `queue.ticket_other_salon`
- **Et** le ticket du salon B ne change pas

### 27. Téléphone d'un rendez-vous jamais réaffiché

- **Étant donné** le rendez-vous de Marc saisi par le gérant avec le téléphone de Marc
- **Quand** Inès regarde « Ma file »
- **Alors** aucun numéro de téléphone n'apparaît sur la carte ni dans la liste
- **Et** la réponse de `get_stylist_queue` ne contient aucun numéro de téléphone

## Textes à prévoir

| Clé (anglais)                                               | Texte (français)                                                                                              | Contrainte                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pro-stylist.queue.title`                                   | Ma file                                                                                                       | Titre de page (APP_FLOW §2.2)                                                                                                |
| `pro-stylist.queue.next_client`                             | Prochain client                                                                                               | APP_FLOW F-S4                                                                                                                |
| `pro-stylist.queue.requested_you`                           | Vous demande                                                                                                  | APP_FLOW F-S4 (« vous a demandé »)                                                                                           |
| `pro-stylist.queue.up_next`                                 | Ensuite                                                                                                       | APP_FLOW F-S4                                                                                                                |
| `pro-stylist.queue.empty`                                   | Aucun client pour l'instant. Les prochains s'afficheront ici.                                                 | État vide (APP_FLOW F-S4)                                                                                                    |
| `pro-stylist.queue.call`                                    | Appeler                                                                                                       | Bouton `xl` de la barre du bas (voir C-04)                                                                                   |
| `pro-stylist.connection.lost`                               | Connexion perdue. Reconnexion en cours…                                                                       | Bandeau rouge, bloque les actions                                                                                            |
| `pro-stylist.connection.restored`                           | Connexion rétablie                                                                                            | Retour de la connexion                                                                                                       |
| `common.approach_status.arrived`                            | Arrivé                                                                                                        | APP_FLOW F-S4, BACKEND_SCHEMA §4.13                                                                                          |
| `common.approach_status.late`                               | En retard de {minutes} min                                                                                    | APP_FLOW F-S4, BACKEND_SCHEMA §4.13                                                                                          |
| `common.approach_status.confirmed`                          | Confirmé                                                                                                      | APP_FLOW F-S4 (« confirmé à T-30 »), BACKEND_SCHEMA §4.13                                                                    |
| `common.approach_status.no_response`                        | Sans réponse                                                                                                  | APP_FLOW F-S4, BACKEND_SCHEMA §4.13                                                                                          |
| `common.appointment.badge`                                  | RDV {time}                                                                                                    | `AppointmentBadge` (DESIGN_SYSTEM) ; exemple « RDV 14h30 » ; heure au format Europe/Paris                                    |
| `common.appointment.badge_late`                             | RDV {time} · +{minutes} min                                                                                   | Retard du salon sur l'heure du rendez-vous, affiché dès 10 min (E30)                                                         |
| `common.ticket_status.pending_confirmation`                 | À confirmer                                                                                                   | DESIGN_SYSTEM §2.4                                                                                                           |
| `pro-stylist.queue.pending_appointment.title`               | Rendez-vous à confirmer                                                                                       | Bandeau APP_FLOW F-S4 ; `PendingConfirmationCard`, annoncé par `aria-live="polite"`                                          |
| `pro-stylist.queue.pending_appointment.banner`              | {first_name} dit avoir rendez-vous à {time}                                                                   | Prénom et heure annoncée                                                                                                     |
| `pro-stylist.queue.pending_appointment.confirm`             | Confirmer                                                                                                     | APP_FLOW F-S4                                                                                                                |
| `pro-stylist.queue.pending_appointment.reject`              | Refuser                                                                                                       | APP_FLOW F-S4                                                                                                                |
| Liste des motifs de refus dans l'espace coiffeur            | _À rédiger (clé absente)_                                                                                     | E29 ; valeurs de `removal_reason` en attendant une liste dédiée 🟡 (TRD §6.2) ; le dashboard a `pro-manager.remove.reason.*` |
| `notifications.appointment_checked_in.push.title` / `.body` | Titre : Rendez-vous à confirmer<br>Corps : {first_name} dit avoir rendez-vous à {time}. Confirmez ou refusez. | Push au gérant et au coiffeur choisi (K21) ; hors consentement et hors plafond (personnel)                                   |
| `notifications.appointment_confirmed.push.title` / `.body`  | Titre : Rendez-vous confirmé<br>Corps : {salon_name} confirme votre rendez-vous. Passage prévu vers {time}.   | Heure de passage ; push seulement ; message indispensable, part sans « Me prévenir » (E17)                                   |
| `notifications.appointment_rejected.push.title` / `.body`   | Titre : Rendez-vous non confirmé<br>Corps : {salon_name} : {reason}. Vous pouvez rejoindre la file.           | Refus avec le motif (E29) ; push seulement, pas de SMS (client sur place) ; message indispensable (E17)                      |
| `notifications.appointment_rejected.actions.join_queue`     | Rejoindre la file                                                                                             | Bouton du push                                                                                                               |
| `notifications.appointment_rejected.reason.<code>`          | _À rédiger (clés absentes)_                                                                                   | Texte `{reason}` de chaque motif de refus (TRD §9, E29)                                                                      |
| `errors.queue.already_resolved`                             | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran.                            | Rendez-vous déjà confirmé ou refusé                                                                                          |
| `errors.queue.ticket_other_salon`                           | Aucun ticket de votre salon ne correspond. Vérifiez le code ou le client concerné.                            | Voir C-05                                                                                                                    |
| `errors.queue.invalid_payload`                              | Certaines informations sont incomplètes ou incorrectes. Vérifiez-les, puis réessayez.                         | Refus sans motif (E29)                                                                                                       |

## Questions ouvertes

- **Résolu le 18/10** : APP_FLOW F-S4 reprend la liste de BACKEND_SCHEMA (confirmé à T-30, en retard de X min, sans réponse, arrivé). Question d'origine : les valeurs du statut d'approche différaient : APP_FLOW F-S4 « pas parti, en route, arrivé, en retard de X min » ; BACKEND_SCHEMA §4.13 « arrivé, en retard de X min, confirmé, sans réponse », calculées depuis `arrived_at`, `eta_response`, `declared_delay_minutes`. « Pas parti » et « en route » ne se calculent pas sans GPS (H7). Quelle liste retenir ?
- **Résolu le 19/10 (TRD §6.3 et BACKEND_SCHEMA §8.1 v0.5, constat 19)** : « Ensuite » = tickets dont le coiffeur est le coiffeur pressenti (`estimated_member_id`) ou qui le demandent ; `get_stylist_queue` renvoie aussi ses rendez-vous du jour et les rendez-vous à confirmer qui le visent. Question d'origine : « Ensuite » contient-il tous les tickets sans préférence éligibles, ou seulement ceux du coiffeur pressenti ?
- [APP_FLOW] Nombre de clients affichés dans « Ensuite », et affiche-t-on l'heure estimée de chacun ?
- [PRD] **E34 (en attente d'Ely)** : H8, le client « reprend la tête de file dès son arrivée ». L'arrivée est-elle l'heure déclarée atteinte, ou l'arrivée validée par le code du ticket (C-05) ? Le scénario 3 en dépend.
- **Résolu le 18/10 (E12)** : prestation et spécialité facultatives ; « je ne sais pas encore » est accepté par tous les coiffeurs (PRD §5.1). Question d'origine : un ticket « je ne sais pas encore » est-il éligible pour tous les coiffeurs ?
- [APP_FLOW] Un coiffeur « Hors ligne » ou « Fin de journée » voit-il encore sa liste « Ensuite » ?
- [APP_FLOW / PRD] Règle 6 : PRD §5.2 applique la condition « finit avant l'heure du rendez-vous » à tout client sans rendez-vous ; APP_FLOW F-S4 ne l'écrit que pour un client sans préférence (« un client qui me demande » est listé sans condition). Un client qui demande Inès passe-t-il avant le rendez-vous d'Inès s'il finirait après ?
- [PRD] Règle 6 avec une marge de 0 min : un client dont la prestation finirait exactement à l'heure du rendez-vous (14h00 + 30 min pour un rendez-vous à 14h30) passe-t-il avant ?
- **Résolu le 19/10 (E20, E21)** en partie : les 10 min de priorité se comptent depuis l'heure du rendez-vous, même confirmé tard (scénario 21 ter) ; le client avec rendez-vous donne son code à l'appel ; une fois appelé, H4 s'applique. Reste [PRD] : un rendez-vous pris en avance (règle 8, scénario 21) est-il appelé même si le client n'est pas encore au salon ? Et si un rendez-vous appelé à son heure est libéré à 10 min (H4), dans quel cas la règle 7 « au-delà de 10 min, pris dès que possible » s'applique-t-elle ?
- [PRD] Règle 7 : « pris dès que possible sans retarder les rendez-vous suivants » une fois les 10 min passées : il reprend son rang d'inscription, passe derrière tous les clients présents, ou reste en tête dès qu'un trou assez long se présente ?
- **Résolu le 19/10 (E30)** : « en retard de X min » sur un rendez-vous est le retard du salon sur l'heure du rendez-vous, affiché dès 10 min (PRD §5.2). Voir scénario 21 bis. Question d'origine : retard du salon ou du client ?
- [APP_FLOW / TRD] Un client qui se signale avec « Je ne sais plus » (F-C12 étape 2) : le bandeau « Rendez-vous à confirmer » s'affiche-t-il chez tous les coiffeurs, chez aucun (dashboard seulement), ou chez le coiffeur rapproché ? TRD §6.2 exige alors `member_id` (sinon `member_required`) : un coiffeur qui confirme devient-il d'office le coiffeur du rendez-vous ?
- [APP_FLOW] Fusion avec un rendez-vous déjà saisi (`merge_into_ticket_id`) : F-S10 la propose (« Confirmer (avec fusion si je l'avais déjà saisi) »), le bandeau de F-S4 ne propose que « Confirmer » ou « Refuser ». Le bandeau de « Ma file » propose-t-il aussi la fusion ?
- **Résolu le 19/10 (E17)** : rendez-vous confirmé ou refusé sont des messages indispensables, envoyés sans « Me prévenir » (scénarios 23 et 24). Question d'origine : sans consentement, le client n'était pas notifié de la confirmation ni du refus.
- **Résolu le 19/10 (E29)** : refuser un rendez-vous signalé demande un motif choisi dans une liste, envoyé au client ; sans motif, `invalid_payload` (TRD §6.2). Voir scénarios 24 et 24 bis. Reste [dictionnaire] : la liste des motifs côté espace coiffeur et les textes `notifications.appointment_rejected.reason.<code>` n'existent pas encore.
