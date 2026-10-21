# C-07 · Ajuster la durée de la prestation en cours

**En tant que** coiffeur, **je veux** rallonger la prestation en cours d'un geste (+5, +15, +30, +45 min), **afin que** les clients suivants aient une heure de passage juste sans que j'arrête de coiffer.

- Priorité : I (PRD §5.3)
- Règles appliquées : H2, H9, H10 ; PRD §5.2 « Calcul de l'heure de passage » (minimum m = 5 min en cas de débordement), « Fin de journée » (à partir de 2 h avant la dernière fermeture de la journée) et « Prévenir avant de partir » ; PRD §5.1 règle des 10 min, mesurée par rapport à la dernière heure annoncée au client, petits écarts additionnés (E11) ; PRD §5.2 « Prévenir avant de partir » (une alerte avec le retard du moment, pas d'alerte de rattrapage, arrêt à l'arrivée ou à l'appel, E23) ; PRD §5.4 « Changement d'heure », « Risque de fin de journée » (messages d'anticipation, seulement avec « Me prévenir »), « Retard sur un rendez-vous » (message indispensable, E17)
- Parcours : F-S7 (APP_FLOW §4) ; F-C13 côté client ; APP_FLOW §8 (mise à jour de l'app)
- Commandes et données : `adjust_duration` (codes propres `queue.not_assigned_to_you`, `queue.duration_limit_reached` ; codes communs `queue.invalid_transition`, `queue.invalid_payload`, TRD §6.2) · tables `tickets` (`planned_duration_minutes`, `estimated_start_at`, `last_notified_start_at`, `end_of_day_warned_at`, `appointment_delay_warned_steps`), `ticket_events`, `notifications`

## Scénarios

### 1. Rallonger de 15 min

- **Étant donné** Inès en prestation avec Léa depuis 14h00, durée prévue 30 min
- **Quand** à 14h20, Inès touche « +15 »
- **Alors** la durée prévue devient 45 min
- **Et** la fin estimée affichée passe à 14h45
- **Et** le journal du ticket enregistre un événement `duration_adjusted`
- **Et** chaque client suivant qui a coché « Me prévenir » et dont l'heure de passage recule de 15 min par rapport à la dernière heure qui lui a été annoncée reçoit une notification push de changement d'heure, avec la nouvelle heure et la raison `service_longer` (« Une prestation dure plus longtemps que prévu. »)
- **Et** pour ces clients, la dernière heure annoncée devient la nouvelle heure (`last_notified_start_at`)
- **Et** aucun SMS n'est envoyé pour ce changement d'heure
- **Et** le dashboard affiche la nouvelle fin estimée en moins de 2 s

### 2. Petit ajustement sans notification

- **Étant donné** Inès en prestation, avec des clients suivants dont l'heure n'a pas encore bougé depuis la dernière heure annoncée
- **Quand** elle touche « +5 »
- **Alors** la durée prévue augmente de 5 min
- **Et** aucune notification de changement d'heure n'est envoyée
- **Et** la dernière heure annoncée aux clients ne change pas

### 2 bis. Petits écarts additionnés (E11)

- **Étant donné** Karim, client suivant d'Inès, qui a coché « Me prévenir », à qui la dernière heure annoncée est 15h00, et dont l'heure de passage dépend directement de la prestation en cours
- **Quand** Inès touche « +5 » (heure de passage de Karim : 15h05)
- **Alors** Karim ne reçoit aucune notification de changement d'heure
- **Quand** Inès touche à nouveau « +5 » (heure de passage de Karim : 15h10)
- **Alors** Karim reçoit une notification push de changement d'heure annonçant 15h10, avec la raison (écart de 10 min par rapport à 15h00)
- **Et** la dernière heure annoncée à Karim devient 15h10

### 2 ter. Client sans « Me prévenir »

- **Étant donné** Karim, client suivant d'Inès, qui n'a pas coché « Me prévenir »
- **Quand** Inès touche « +15 » et l'heure de Karim recule de 15 min
- **Alors** aucune notification de changement d'heure ne part vers Karim (ligne `skipped`, `no_consent`, E17)
- **Et** la dernière heure annoncée à Karim ne change pas (`last_notified_start_at` n'est mis à jour que quand une notification part, K19)
- **Et** la nouvelle heure s'affiche sur son ticket, avec le bandeau de raison (APP_FLOW F-C5)

### 3. Ajustements cumulés

- **Étant donné** Inès en prestation, durée prévue 30 min
- **Quand** elle touche « +15 » puis « +30 »
- **Alors** la durée prévue devient 75 min

### 4. Seulement quatre valeurs, jamais de réduction

- **Étant donné** la carte « En cours »
- **Quand** Inès regarde les boutons d'ajustement
- **Alors** elle trouve exactement « +5 », « +15 », « +30 », « +45 »
- **Et** aucun bouton ne réduit la durée (une prestation plus courte se termine par « Terminer », C-08)

### 5. Valeur hors liste refusée

- **Étant donné** Inès en prestation
- **Quand** une commande `adjust_duration` est envoyée avec `delta_minutes` = 10
- **Alors** la commande est refusée avec `queue.invalid_payload` (validation du contrat, TRD §6.2)
- **Et** la durée prévue ne change pas

### 5 bis. Durée cumulée au-delà de 240 min

- **Étant donné** Inès en prestation, durée prévue 210 min
- **Quand** elle touche « +45 »
- **Alors** la commande est refusée avec `queue.duration_limit_reached`
- **Et** le message « La prestation ne peut pas dépasser 4 h. » s'affiche
- **Et** la durée prévue reste 210 min

### 6. Prestation qui déborde sans ajustement

- **Étant donné** Inès en prestation depuis 14h00, durée prévue 30 min, sans ajustement
- **Quand** il est 14h35
- **Alors** le temps restant pris en compte pour les clients suivants est de 5 min (minimum m = 5 min, PRD §5.2)
- **Et** la fin estimée affichée est 14h40

### 7. Ajustement qui fait passer un client après la fermeture

- **Étant donné** il est moins de 2 h avant la dernière fermeture de la journée (valeur par défaut de `salons.end_of_day_warning_minutes` = 120 ; pour un salon ouvert 9h-12h et 14h-19h, la référence est 19h00, E5)
- **Et** Karim, client suivant d'Inès, qui a coché « Me prévenir », n'a encore reçu aucune alerte de fin de journée
- **Quand** Inès touche « +45 » et la fin estimée de Karim dépasse l'heure de fermeture
- **Alors** Karim reçoit une seule alerte « {salon_name} : vous risquez de ne pas être pris avant la fermeture. Vous restez ? », avec « Je reste » ou « J'annule »
- **Et** l'alerte part par push, ou par SMS s'il n'a pas de push actif, dans la limite de 3 SMS par ticket
- **Et** l'envoi est horodaté (`end_of_day_warned_at`)

### 8. Alerte de fin de journée déjà envoyée

- **Étant donné** Karim, qui a déjà reçu l'alerte de fin de journée aujourd'hui
- **Quand** un nouvel ajustement d'Inès repousse encore sa fin estimée après la fermeture
- **Alors** aucune seconde alerte de fin de journée n'est envoyée à Karim

### 8 bis. Client sans « Me prévenir » à risque de fin de journée (E17)

- **Étant donné** Paul, client suivant d'Inès, qui n'a pas coché « Me prévenir », dans la fenêtre des 2 h avant la dernière fermeture
- **Quand** Inès touche « +45 » et la fin estimée de Paul dépasse l'heure de fermeture
- **Alors** aucune alerte de fin de journée ne part vers Paul, ni push ni SMS (ligne `skipped`, `no_consent` ; ce que montre son ticket : voir questions)

### 9. Pas de mise à jour de l'app pendant la prestation

- **Étant donné** Inès en prestation et une nouvelle version de Zelaté Pro disponible
- **Quand** l'app détecte la nouvelle version
- **Alors** le toast « Nouvelle version disponible » ne s'affiche pas tant que la prestation est en cours

### 10. Ticket d'un autre coiffeur ou pas en prestation

- **Étant donné** Léa en prestation chez Karim
- **Quand** une commande `adjust_duration` est envoyée avec le compte d'Inès pour ce ticket
- **Alors** la commande est refusée avec `queue.not_assigned_to_you`
- **Et** la durée prévue ne change pas

### 10 bis. Ticket qui n'est pas en prestation

- **Étant donné** Léa appelée par Inès, prestation pas encore commencée
- **Quand** une commande `adjust_duration` est envoyée avec le compte d'Inès pour ce ticket
- **Alors** la commande est refusée avec `queue.invalid_transition` (code commun, TRD §6.2)
- **Et** la durée prévue ne change pas

### 10 ter. Ajustement qui retarde un rendez-vous (« Prévenir avant de partir »)

- **Étant donné** Marc, rendez-vous à 15h00 avec Inès, saisi par le salon avec son téléphone, sans push actif et sans case « Me prévenir » cochée, à qui aucune alerte de retard n'a encore été envoyée (`appointment_delay_warned_steps` = 0)
- **Quand** Inès touche « +15 » et l'heure de passage de Marc devient 15h10
- **Alors** Marc reçoit le SMS « {salon_name} a du retard sur votre rendez-vous de 15h00 : venez vers 15h10. Suivi : {link} » (message indispensable, E17)
- **Et** ce SMS compte dans le plafond de 3 SMS du ticket
- **Et** `appointment_delay_warned_steps` vaut 1
- **Et** le journal du ticket enregistre un événement `appointment_delay_warned`

### 10 quater. Nouvel écart de 10 min sur le même rendez-vous

- **Étant donné** Marc, rendez-vous à 15h00, déjà prévenu d'une heure de passage à 15h10 (`appointment_delay_warned_steps` = 1)
- **Quand** un nouvel ajustement d'Inès porte son heure de passage à 15h15
- **Alors** Marc ne reçoit pas de nouvelle alerte de retard
- **Quand** un autre ajustement la porte à 15h20
- **Alors** Marc reçoit une nouvelle alerte de retard, dans la limite du plafond de 3 SMS
- **Et** `appointment_delay_warned_steps` vaut 2

### 10 quinquies. Saut de plusieurs paliers : une seule alerte (E23)

- **Étant donné** Marc, rendez-vous à 15h00 avec Inès, saisi avec son téléphone, jamais prévenu d'un retard, heure de passage 15h00
- **Quand** Inès touche « +45 » et l'heure de passage de Marc devient 15h25
- **Alors** Marc reçoit une seule alerte de retard, qui l'invite à venir vers 15h25

### 10 sexies. Pas d'alerte quand le salon rattrape son retard (E23)

- **Étant donné** Marc, rendez-vous à 15h00, déjà prévenu de venir vers 15h20
- **Quand** la prestation en cours d'Inès se termine plus tôt et l'heure de passage de Marc redevient 15h05
- **Alors** Marc ne reçoit aucune alerte de retard

### 11. Connexion perdue

- **Étant donné** Inès en prestation, dont l'écran affiche « Connexion perdue »
- **Quand** elle veut toucher « +15 »
- **Alors** les boutons d'ajustement sont désactivés
- **Et** la durée prévue ne change pas

## Textes à prévoir

| Clé (anglais)                                            | Texte (français)                                                                                                                 | Contrainte                                                                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pro-stylist.service.in_progress`                        | En cours                                                                                                                         | APP_FLOW F-S7                                                                                                                                                                                    |
| `pro-stylist.service.elapsed_planned`                    | {elapsed_minutes} min sur {planned_minutes} min                                                                                  | Temps écoulé / prévu, annoncé au lecteur d'écran une fois par minute au plus                                                                                                                     |
| `pro-stylist.service.estimated_end`                      | Fin vers {time}                                                                                                                  | Fin estimée                                                                                                                                                                                      |
| `pro-stylist.service.adjust_5`                           | +5                                                                                                                               | Libellé visible ; nom accessible : `adjust_label`                                                                                                                                                |
| `pro-stylist.service.adjust_15`                          | +15                                                                                                                              | Idem                                                                                                                                                                                             |
| `pro-stylist.service.adjust_30`                          | +30                                                                                                                              | Idem                                                                                                                                                                                             |
| `pro-stylist.service.adjust_45`                          | +45                                                                                                                              | Idem                                                                                                                                                                                             |
| `pro-stylist.service.adjust_label`                       | Ajouter {minutes} min à la prestation                                                                                            | Nom accessible des quatre boutons                                                                                                                                                                |
| `common.app_update.toast`                                | Nouvelle version disponible                                                                                                      | APP_FLOW §8 ; jamais pendant une prestation                                                                                                                                                      |
| `common.app_update.reload`                               | Recharger                                                                                                                        | APP_FLOW §8                                                                                                                                                                                      |
| `common.change_reason.service_longer`                    | Une prestation dure plus longtemps que prévu.                                                                                    | Raison `{reason}` (K26)                                                                                                                                                                          |
| `notifications.estimate_changed.push.title` / `.body`    | Titre : Votre heure de passage change<br>Corps : Passage prévu vers {time} chez {salon_name}. {reason}                           | Push seulement ; message d'anticipation, seulement avec « Me prévenir » (E17)                                                                                                                    |
| `notifications.end_of_day_risk.push.title` / `.body`     | Titre : Le salon ferme bientôt<br>Corps : {salon_name} : vous risquez de ne pas être pris avant la fermeture. Vous restez ?      | PRD §5.2 ; message d'anticipation (E17) ; partagé avec U-11                                                                                                                                      |
| `notifications.end_of_day_risk.actions.stay` / `.cancel` | Je reste / J'annule                                                                                                              | Boutons du push                                                                                                                                                                                  |
| `notifications.end_of_day_risk.sms`                      | {salon_name} : vous risquez de ne pas être pris avant la fermeture. Vous restez ? Répondez : {link}                              | SMS ≤ 160 caractères GSM-7, testé avec les valeurs de longueur maximale (TRD §9, K5) ; seulement sans push actif, dans le plafond de 3 SMS, avec « Me prévenir » ; partagé avec U-11             |
| `errors.queue.duration_limit_reached`                    | La prestation ne peut pas dépasser 4 h.                                                                                          | Au-delà de 240 min (TRD §6.2)                                                                                                                                                                    |
| `errors.queue.not_assigned_to_you`                       | Ce client est pris en charge par un autre coiffeur. Seul ce coiffeur peut agir sur son ticket.                                   | Voir C-06                                                                                                                                                                                        |
| `errors.queue.invalid_transition`                        | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran.                                                   | Code commun ; voir C-04                                                                                                                                                                          |
| `errors.queue.invalid_payload`                           | Certaines informations sont incomplètes ou incorrectes. Vérifiez-les, puis réessayez.                                            | Code commun : validation du contrat (TRD §6.2)                                                                                                                                                   |
| `notifications.appointment_delay.push.title` / `.body`   | Titre : Le salon a du retard<br>Corps : {salon_name} a du retard sur votre rendez-vous de {appointment_time}. Venez vers {time}. | « venez vers » (E23) ; message indispensable (E17) ; partagé avec U-15                                                                                                                           |
| `notifications.appointment_delay.sms`                    | {salon_name} a du retard sur votre rendez-vous de {appointment_time} : venez vers {time}. Suivi : {link}                         | SMS ≤ 160 caractères GSM-7, testé avec les valeurs de longueur maximale (TRD §9, K5) ; seulement sans push actif, dans le plafond de 3 SMS ; part sans « Me prévenir » (E17) ; partagé avec U-15 |

## Questions ouvertes

- **Résolu le 19/10 (APP_FLOW v0.6 F-S7, TRD v0.5 §6.2)** : « à partir de 10 min d'écart » et « 10 min ou plus » partout (≥ 10 min). Question d'origine : un client dont l'heure bouge d'exactement 10 min est-il notifié ?
- **Résolu le 18/10 (E11)** : l'écart se mesure par rapport à la dernière heure annoncée au client (`last_notified_start_at`) et les petits écarts s'additionnent (PRD §5.1, BACKEND_SCHEMA §4.13). Question d'origine : par rapport à quoi se mesure la variation de 10 min ?
- **Résolu le 19/10 (TRD §6.2 v0.5, constat 21)** : au-delà de 240 min, `adjust_duration` est refusé avec `queue.duration_limit_reached` (scénario 5 bis). Question d'origine : refus ou plafonnement quand un « +45 » dépasserait 240 min ?
- [PRD] Annuler un ajustement fait par erreur (« +45 » au lieu de « +5 ») : aucun moyen prévu. Est-ce voulu ?
- **Résolu le 18/10 (K1)** : `adjust_duration` sur un ticket qui n'est pas en prestation relève du code commun `queue.invalid_transition`, une erreur de validation de contrat de `queue.invalid_payload` (TRD §6.2). Question d'origine : codes de ces deux cas.
- **Résolu le 19/10 (K19, BACKEND_SCHEMA §4.13)** : `last_notified_start_at` n'est mis à jour que quand une notification part réellement ; sans « Me prévenir », il ne bouge pas (scénario 2 ter). Question d'origine : est-il mis à jour sans notification ?
- **Résolu le 19/10 (E17)** : le retard sur un rendez-vous est un message indispensable, envoyé sans case cochée (scénario 10 ter) ; l'avis RGPD reste à obtenir (PRD §9 n° 9). Question d'origine : message indispensable ou accord à recueillir ?
- **Résolu le 19/10 (E23)** : un saut de plusieurs paliers donne une seule alerte avec le retard du moment ; pas d'alerte quand le salon rattrape son retard ; plus d'alerte une fois le client arrivé ou appelé ; « venez vers ». Voir scénarios 10 quinquies et 10 sexies.
- [APP_FLOW / BACKEND_SCHEMA] Client sans « Me prévenir » à risque de fin de journée (scénario 8 bis) : la ligne `end_of_day_risk` est ignorée ; le bandeau « Risque de fin de journée » de F-C5 s'affiche-t-il quand même sur son ticket, et `end_of_day_warned_at` est-il renseigné (une seule alerte par ticket, invariant 6) ?
- [BACKEND_SCHEMA] Après un saut de plusieurs paliers (scénario 10 quinquies), que vaut `appointment_delay_warned_steps` : le nombre d'alertes envoyées (1) ou le palier atteint (2, clé `appointment_delay:2`) ?
- [PRD §5.4] Un rendez-vous dont l'heure de passage recule de 10 min reçoit-il à la fois « Changement d'heure » (push) et « Retard sur un rendez-vous » (push ou SMS), ou seulement la seconde ?
