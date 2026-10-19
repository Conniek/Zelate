# C-09 · Gérer un client appelé qui n'arrive pas

**En tant que** coiffeur, **je veux** suivre le compteur de 10 min d'un client appelé, prendre le suivant s'il a déclaré un retard, et voir sa place libérée automatiquement à 10 min, **afin de** ne pas rester à attendre sans rien pouvoir faire.

- Priorité : I (PRD §5.3)
- Règles appliquées : H4, H5, H3, H10 ; PRD §5.2 transitions 3 et 7 ; PRD §5.1 « Un retard déclaré ne le fait reculer que si le coiffeur choisit « Prendre le suivant » » (E2), « Le client annule sans pénalité, même une fois appelé » (E3), « Absences répétées : avertissement par notification à la 5e absence en 30 jours, tous salons confondus, une fois par période de 30 jours, hors plafond de SMS ; le salon ne voit aucun compteur d'absences d'un client » (E10, E28), « Un client avec rendez-vous […] une fois appelé, la règle H4 s'applique » (E20) ; PRD §5.4 « Rappel », « Place libérée », « Recul », « Avertissement d'absences » (messages indispensables, envoyés sans « Me prévenir », E17)
- Parcours : F-S5, F-S8 (APP_FLOW §4) ; F-C6, F-C7 côté client ; événements « Rappel », « Libération », « Recul » (APP_FLOW §7)
- Commandes et données : `take_next` (codes propres `queue.not_assigned_to_you`, `queue.postpone_limit_reached`, `queue.no_eligible_ticket` ; code commun `queue.invalid_transition`, TRD §6.2) ; `respond_eta` (côté client, U-07) ; libération par `queue-tick` à `release_due_at` (sans commande, module `queue-transaction`, K38 ; tolérance de test ±60 s, K7) · tables `tickets` (`call_count`, `called_at`, `release_due_at`, `reminder_sent_at` — remis à vide en quittant `called`, K31 ; `postpone_count`, `eta_response`, `declared_delay_minutes`, `declared_arrival_at`, K13 ; `no_show_at`), `private.ticket_contacts` (`phone_hash`, K28), `private.no_show_records` (K8), `private.no_show_warnings` (E28), `ticket_events`, `notifications` (`your_turn:<call_count>`, `arrival_reminder:<call_count>`, `released_no_show`, `postponed`, `no_show_warning`) ; colonnes `salons.reminder_after_minutes` (5) et `salons.auto_release_after_minutes` (10)

## Scénarios

### 1. Rappel à 5 min
- **Étant donné** Inès qui a appelé Léa à 14h00, et Léa, qui a le push actif, n'est pas arrivée
- **Quand** il est 14h05, à 60 s près (K7)
- **Alors** Léa reçoit la notification push « Le salon vous attend » : « Votre place sera libérée dans 5 min. Donnez le code AF2K9 à Inès en arrivant. »
- **Et** l'envoi du rappel est horodaté (`reminder_sent_at`)
- **Et** la carte « Appel en cours » d'Inès affiche « Rappel envoyé »

### 2. Pas de SMS de rappel
- **Étant donné** Léa appelée à 14h00, sans push actif, pas arrivée
- **Quand** il est 14h05
- **Alors** aucun SMS de rappel n'est envoyé à Léa

### 3. Attendre le client
- **Étant donné** Léa appelée, pas arrivée, sans retard déclaré
- **Quand** Inès ne fait rien
- **Alors** le compteur de 10 min continue
- **Et** le ticket de Léa reste « Appelé »

### 4. Libération automatique à 10 min
- **Étant donné** Léa appelée à 14h00, sans retard déclaré (`release_due_at` = 14h10), dont l'arrivée n'a pas été validée
- **Quand** il est 14h10, à 60 s près (K7)
- **Alors** le ticket de Léa passe au statut « Absent » (`no_show`, `no_show_at` renseigné), sans action d'Inès
- **Et** l'écran d'Inès revient sur « Ma file »
- **Et** un bandeau d'information y signale la libération de la place de Léa
- **Et** Léa reçoit la notification push « Votre place a été libérée », avec « Me réinscrire », sans SMS
- **Et** les clients suivants avancent
- **Et** une ligne d'absence est enregistrée dans `private.no_show_records` pour l'empreinte du numéro de Léa (`phone_hash`, `ticket_id`, `occurred_at`)
- **Et** le dashboard marque le ticket « Absent », sans afficher aucun compteur d'absences de Léa (E28)
- **Et** le journal du ticket enregistre un événement `no_show` avec le système comme acteur

### 4 bis. Retard déclaré : pas de recul automatique (E2)
- **Étant donné** Léa, en attente chez Inès, qui répond « En retard de 20 min » à « votre tour approche » (`respond_eta`, `late`, 20)
- **Quand** la réponse est enregistrée
- **Alors** le ticket de Léa garde sa place dans la file
- **Et** `postpone_count` ne change pas
- **Et** la carte ou la ligne de Léa dans « Ma file » indique un retard déclaré de 20 min

### 4 ter. Retard déclaré : libération repoussée à l'heure d'arrivée annoncée (E2 ; heure du rappel dans ce cas : en attente d'Ely, E33)
- **Étant donné** Léa, à qui l'heure 13h55 a été annoncée à T-30 (`t30_estimated_start_at`), qui a répondu « En retard de 25 min », donc dont l'heure d'arrivée annoncée est 14h20 (`declared_arrival_at` = 13h55 + 25 min, K13)
- **Quand** Inès appelle Léa à 14h00
- **Alors** l'heure de libération est fixée à 14h20 (`release_due_at` = l'heure d'arrivée annoncée, plus tardive que 14h00 + 10 min ; PRD §5.1, transition 7, E2)
- **Et** la carte « Appel en cours » affiche un compteur jusqu'à 14h20 et le retard déclaré
- **Quand** il est 14h10 sans arrivée validée
- **Alors** la place de Léa n'est pas libérée
- **Quand** il est 14h20, à 60 s près (K7), sans arrivée validée
- **Alors** le ticket de Léa passe au statut « Absent »

### 4 quater. Retard annoncé plus court que 10 min après l'appel
- **Étant donné** Léa, qui a déclaré un retard et dont l'heure d'arrivée annoncée est 14h05
- **Quand** Inès appelle Léa à 14h00
- **Alors** l'heure de libération est fixée à 14h10 (`release_due_at` = 14h00 + 10 min, plus tardive que 14h05 ; E2)

### 4 quinquies. Avertissement à la 5e absence en 30 jours, tous salons (E10, K8, E28)
- **Étant donné** Léa, sans push actif, qui n'a pas coché « Me prévenir », dont le ticket a déjà reçu 3 SMS, avec 4 absences enregistrées dans `private.no_show_records` au cours des 30 derniers jours, dont 2 au salon d'Inès et 2 dans un autre salon, et aucun avertissement dans les 30 derniers jours
- **Quand** sa place est libérée à 10 min par `queue-tick`
- **Alors** une 5e ligne d'absence est enregistrée pour l'empreinte de son numéro
- **Et** Léa reçoit le SMS `no_show_warning` (message indispensable, E17 ; hors plafond, E28)
- **Et** l'avertissement est noté pour son numéro (`private.no_show_warnings.warned_at`)
- **Et** Léa peut toujours rejoindre une file (avertissement seul, PRD §11 n° 17)
- **Et** ni Inès ni le gérant ne voient cet avertissement ni le nombre d'absences de Léa (E28)

### 4 quinquies bis. Une seule fois par période de 30 jours (E28)
- **Étant donné** Léa, avertie il y a 10 jours, avec 5 absences dans les 30 derniers jours
- **Quand** sa place est libérée à 10 min une 6e fois
- **Alors** une 6e ligne d'absence est enregistrée
- **Et** aucune nouvelle notification `no_show_warning` n'est créée

### 4 sexies. Pas d'avertissement avant la 5e
- **Étant donné** Léa avec 3 absences dans les 30 derniers jours
- **Quand** sa place est libérée à 10 min
- **Alors** une 4e ligne d'absence est enregistrée
- **Et** aucune notification `no_show_warning` n'est créée

### 4 septies. Absences de plus de 30 jours non comptées
- **Étant donné** Léa avec 4 absences, dont 1 vieille de plus de 30 jours
- **Quand** sa place est libérée à 10 min
- **Alors** aucune notification `no_show_warning` n'est créée (3 absences dans les 30 jours glissants avant celle-ci)
- **Et** les lignes de plus de 30 jours sont supprimées par la purge de nuit de `private.no_show_records`

### 4 octies. Client appelé qui annule : pas d'absence (E3)
- **Étant donné** Léa appelée par Inès, pas arrivée
- **Quand** Léa annule sa place (`cancel_ticket`)
- **Alors** son ticket passe à « Annulé » (`client_cancelled`), pas à « Absent »
- **Et** aucune ligne n'est ajoutée à `private.no_show_records`
- **Et** l'écran d'Inès revient sur « Ma file »

### 4 nonies. Client sans « Me prévenir » : rappel et libération partent quand même (E17)
- **Étant donné** Léa appelée à 14h00, pas arrivée, qui n'a pas coché « Me prévenir », avec le push actif
- **Quand** il est 14h05
- **Alors** Léa reçoit le rappel push « Le salon vous attend »
- **Quand** il est 14h10
- **Alors** son ticket passe au statut « Absent »
- **Et** Léa reçoit la notification push « Votre place a été libérée »

### 4 decies. Rendez-vous appelé qui n'arrive pas (E20)
- **Étant donné** Marc, rendez-vous à 14h30 avec Inès, saisi avec son téléphone, appelé par Inès à 14h30, sans retard déclaré
- **Quand** il est 14h40, à 60 s près, sans arrivée validée
- **Alors** le ticket de Marc passe au statut « Absent » (H4 s'applique une fois appelé)
- **Et** une ligne d'absence est enregistrée pour l'empreinte de son numéro

### 5. Libération même si le téléphone du coiffeur est hors ligne
- **Étant donné** Léa appelée à 14h00 et le téléphone d'Inès sans connexion
- **Quand** il est 14h10 sans arrivée validée
- **Alors** le ticket de Léa passe quand même au statut « Absent »
- **Et** au retour de la connexion, l'écran d'Inès affiche « Ma file » à jour

### 6. « Prendre le suivant » réservé au retard déclaré
- **Étant donné** Léa appelée, pas arrivée, qui n'a déclaré aucun retard
- **Quand** Inès regarde la carte « Appel en cours »
- **Alors** le bouton « Prendre le suivant » n'est pas proposé
- **Et** une commande `take_next` envoyée malgré tout pour ce ticket est refusée avec `queue.invalid_transition` (code commun, TRD §6.2 : condition de la transition 3 non remplie)
- **Et** le ticket de Léa reste « Appelé »

### 7. Prendre le suivant quand le client a déclaré un retard
- **Étant donné** Léa appelée, qui a déclaré un retard de 15 min, et dont le ticket n'a jamais reculé (`postpone_count` = 0)
- **Et** d'autres tickets éligibles pour Inès après celui de Léa
- **Quand** Inès touche « Prendre le suivant »
- **Alors** une confirmation affiche « Léa passera après 2 clients. » (*n* = 2, au plus 2)
- **Quand** Inès confirme
- **Alors** le ticket de Léa repasse « En attente », reculé de 2 places
- **Et** `postpone_count` vaut 2
- **Et** son appel est effacé : plus de rappel ni de libération pour cet appel (`called_at`, `reminder_sent_at`, `release_due_at` remis à vide, K31)
- **Et** Léa reçoit la notification push « Votre place a reculé » avec sa nouvelle position, sans SMS, même sans « Me prévenir » (E17)
- **Et** le journal du ticket enregistre un événement `postponed` avec le motif
- **Et** aucune absence n'est enregistrée pour Léa
- **Et** le prochain ticket éligible est appelé : son client reçoit « Votre tour » par push et SMS, et un nouveau compteur de 10 min démarre

### 7 bis. Léa appelée une seconde fois après le recul
- **Étant donné** Léa, reculée par « Prendre le suivant », redevenue premier ticket éligible pour Inès
- **Quand** Inès touche « Appeler »
- **Alors** Léa reçoit à nouveau « Votre tour » par push et par SMS (`call_count` = 2, clé `your_turn:2`, K31)
- **Et** ce second SMS « Votre tour » part même si le plafond de 3 SMS est atteint (E1)
- **Et** une nouvelle heure de libération est fixée selon la même règle que le premier appel (`release_due_at`)
- **Quand** 5 min ont passé sans arrivée
- **Alors** Léa reçoit un nouveau rappel (clé `arrival_reminder:2`, K31)

### 8. Recul cumulé limité à 2 places
- **Étant donné** Léa appelée, retard déclaré, dont le ticket a déjà reculé d'une place (`postpone_count` = 1)
- **Quand** Inès touche « Prendre le suivant »
- **Alors** la confirmation annonce que Léa passera après 1 client au plus

### 9. Limite de recul atteinte
- **Étant donné** Léa appelée, retard déclaré, dont le ticket a déjà reculé de 2 places (`postpone_count` = 2)
- **Quand** Inès confirme « Prendre le suivant »
- **Alors** la commande est refusée avec `queue.postpone_limit_reached`
- **Et** un message du dictionnaire `errors` s'affiche
- **Et** le ticket de Léa reste « Appelé » et le compteur continue

### 9 bis. Aucun client à appeler derrière
- **Étant donné** Léa appelée, retard déclaré, `postpone_count` = 0, et aucun autre ticket éligible pour Inès
- **Quand** Inès confirme « Prendre le suivant »
- **Alors** la commande est refusée avec `queue.no_eligible_ticket` (TRD §6.2)
- **Et** le ticket de Léa reste « Appelé » et le compteur continue

### 10. Ticket appelé par un autre coiffeur
- **Étant donné** Léa appelée par Karim, retard déclaré
- **Quand** une commande `take_next` est envoyée avec le compte d'Inès pour le ticket de Léa
- **Alors** la commande est refusée avec `queue.not_assigned_to_you`
- **Et** le ticket de Léa ne change pas

### 11. Confidentialité
- **Étant donné** Léa appelée qui n'arrive pas
- **Quand** Inès regarde la carte « Appel en cours »
- **Alors** aucun numéro de téléphone de Léa n'est affiché
- **Et** aucun bouton ne permet d'appeler Léa (appel à numéro masqué prévu en V1)

### 12. Connexion perdue
- **Étant donné** Inès dont l'écran affiche « Connexion perdue », avec Léa appelée et retard déclaré
- **Quand** elle veut toucher « Prendre le suivant »
- **Alors** le bouton est désactivé
- **Et** aucun recul n'est enregistré

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.call.reminder_sent` | Rappel envoyé | APP_FLOW F-S5 / §7 |
| `pro-stylist.call.declared_delay` | Retard annoncé : {minutes} min | Retard déclaré par le client, en minutes |
| `pro-stylist.take_next.button` | Prendre le suivant | APP_FLOW F-S8 |
| `pro-stylist.take_next.confirm` | {first_name} passera après {count, plural, one {# client} other {# clients}}. | APP_FLOW F-S8 (« 2 maximum » n'est pas repris dans le texte) ; pluriel ICU |
| `pro-stylist.call.released_banner` | Place de {first_name} libérée faute d'arrivée. Appelez le suivant. | Bandeau d'information après la libération à 10 min |
| `common.ticket_status.no_show` | Absent | PRD §5.2 |
| `notifications.arrival_reminder.push.title` / `.body` | Titre : Le salon vous attend<br>Corps : Votre place sera libérée dans 5 min. Donnez le code {code} à {stylist_first_name} en arrivant. | APP_FLOW F-C7 ; push seulement, pas de SMS ; message indispensable (E17) |
| `notifications.released_no_show.push.title` / `.body` | Titre : Votre place a été libérée<br>Corps : Le délai pour arriver chez {salon_name} est dépassé. Vous pouvez vous réinscrire. | Push seulement ; message indispensable (E17) |
| `notifications.released_no_show.actions.rejoin` | Me réinscrire | Bouton du push |
| `notifications.postponed.push.title` / `.body` |Titre : Votre place a reculé<br>Corps : Vous aviez annoncé un retard, le coiffeur a pris le client suivant. Il reste {count, plural, one {# client} other {# clients}} avant vous.| Push seulement ; nouvelle position et raison ; message indispensable (E17) |
| `errors.queue.no_eligible_ticket` | Aucun client à appeler pour l'instant. Il a peut-être été pris par un collègue : vérifiez votre file. | `take_next` sans suivant à appeler (TRD §6.2) |
| `errors.queue.postpone_limit_reached` | Ce client a déjà reculé de 2 places, le maximum. Attendez son arrivée : sa place sera libérée à la fin du délai. | Code propre de `take_next` |
| `errors.queue.not_assigned_to_you` | Ce client est pris en charge par un autre coiffeur. Seul ce coiffeur peut agir sur son ticket. | Voir C-06 |
| `errors.queue.invalid_transition` | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. | Code commun ; voir C-04 |
| `notifications.no_show_warning.push.title` / `.body` |Titre : Pensez à annuler si vous ne venez pas<br>Corps : Vous comptez {count, plural, one {# absence} other {# absences}} en 30 jours. Si vous ne pouvez pas venir, annulez : la place revient à un autre client.| Avertissement à la 5e absence en 30 jours, tous salons, une fois par période de 30 jours (E28) ; message indispensable (E17) ; ne doit nommer aucun autre salon ; partagé avec P-03 |
| `notifications.no_show_warning.sms` | Zelaté : vous comptez {count, plural, one {# absence} other {# absences}} en 30 jours. Si vous ne pouvez pas venir, annulez votre place : elle profitera à un autre client. | SMS ≤ 160 caractères GSM-7, testé avec les valeurs de longueur maximale (TRD §9, K5) ; seulement sans push actif ; hors plafond de 3 SMS (E28) ; partagé avec P-03 |

## Questions ouvertes
- **Résolu le 18/10 (E2)** : un retard déclaré ne fait reculer le client que si le coiffeur choisit « Prendre le suivant » ; la libération est repoussée à l'heure d'arrivée annoncée (PRD §5.1, TRD §6.2 `respond_eta` et `call_ticket`, BACKEND_SCHEMA `release_due_at`, APP_FLOW F-C6, F-C7, F-S5). Question d'origine : un client appelé qui a déclaré 20 min de retard voit-il sa place libérée à 10 min ?
- **Résolu le 19/10 (PRD v1.2 §5.1, transition 7, §11 E2 ; constat 18)** : libéré à l'heure d'arrivée annoncée si elle est plus tardive que les 10 min, partout (scénario 4 ter). Question d'origine : contradiction sur l'heure de libération après un retard déclaré : PRD §5.1 (« son compteur de 10 min part de l'heure d'arrivée qu'il a annoncée ») et la transition 7 (« 10 min sans arrivée (à partir de l'heure d'arrivée annoncée) ») donnent heure annoncée + 10 min (14h30 dans le scénario 4 ter) ; TRD §6.2, BACKEND_SCHEMA `release_due_at` et APP_FLOW F-C7, F-S5, §7 donnent l'heure annoncée elle-même (14h20). Laquelle retenir ? Le scénario 4 ter suit TRD et le schéma en attendant.
- **Résolu le 19/10 (K13, TRD §6.2 `call_ticket`, BACKEND_SCHEMA `declared_arrival_at`)** : un retard déclaré à T-30 fixe `declared_arrival_at` = `t30_estimated_start_at` + `declared_delay_minutes` (scénario 4 ter). Question d'origine : « Heure d'arrivée annoncée » : aucune colonne ne la porte. Se calcule-t-elle à partir de `declared_delay_minutes` (ajouté à quoi : l'heure de passage annoncée à T-30, `t30_estimated_start_at`, ou l'heure de la réponse ?), ou est-ce `declared_arrival_at` (H8) ?
- [APP_FLOW / PRD / BACKEND_SCHEMA] **E33 (en attente d'Ely)** : rappel avec un retard déclaré (BACKEND_SCHEMA §10 garde « `called_at` + 5 min », la revue propose 5 min avant `release_due_at`) : F-C7 envoie le rappel « Le salon vous attend, place libérée dans 5 min » 5 min après l'appel, alors que la place n'est libérée qu'à l'heure annoncée (14h20 dans le scénario 4 ter). Le rappel part-il 5 min avant `release_due_at`, ou son texte change-t-il ?
- [PRD / APP_FLOW] « Prendre le suivant » dépend d'un retard déclaré : F-C5 propose désormais « Je serai en retard » sur la carte ticket, mais l'écran plein « C'est votre tour ! » (statut « Appelé ») ne le liste pas. Le client peut-il déclarer un retard après avoir été appelé ?
- **Résolu le 19/10 (TRD §6.2 v0.5, constat 28)** en partie : sans ticket derrière, `take_next` est refusé avec `no_eligible_ticket` (scénario 9 bis). Reste [PRD / APP_FLOW] : comment se calcule *n* dans « *Prénom* passera après *n* clients » : 2 moins `postpone_count`, borné au nombre de tickets éligibles derrière ?
- **Résolu le 18/10** : la clé `dedupe_key` de « Votre tour » est numérotée (`your_turn:1`, `your_turn:2`) pour qu'un second appel après « Prendre le suivant » reparte (BACKEND_SCHEMA §4.16), et ce SMS est hors plafond (E1). Question d'origine : la seconde notification « Votre tour » serait-elle bloquée comme doublon, et compte-t-elle dans le plafond ?
- **Résolu le 19/10 (K31)** : `call_count` numérote aussi le rappel (`arrival_reminder:<call_count>`), qui repart au second appel ; les colonnes d'appel sont remises à vide en quittant `called` (scénarios 7 et 7 bis). Question d'origine : le rappel repart-il au second appel ?
- **Résolu le 18/10 (K7)** : tolérance de ±60 s sur les délais de `queue-tick` dans les tests (TRD §10.1). Question d'origine : quelle tolérance retenir pour les tests ?
- [APP_FLOW] Reste ouvert après K7 : le compteur affiché sur la carte « Appel en cours » à zéro doit-il attendre le passage de `queue-tick` (jusqu'à 60 s) avant que la place soit libérée à l'écran ?
- **Résolu le 18/10 (E10, K8)** : avertissement à la 5e absence en 30 jours, tous salons, par notification ; une ligne par absence dans `private.no_show_records` par empreinte du numéro, purgée après 30 jours (PRD §5.1, TRD §6.2 et §8, BACKEND_SCHEMA §5). Question d'origine : à la 5e ou à la 6e ? où stocker le compteur ?
- **Résolu le 19/10 (E28)** : une fois par période de 30 jours et par numéro, hors plafond SMS (`private.no_show_warnings`) ; aucun compteur visible par le salon (scénarios 4, 4 quinquies, 4 quinquies bis). Question d'origine : l'avertissement repart-il après la 5e absence ?
- **Résolu le 19/10 (E17)** : rappel, place libérée, recul et avertissement d'absences sont des messages indispensables, envoyés sans « Me prévenir » (scénarios 4 quinquies, 4 nonies, 7). Question d'origine : sans consentement, le client n'était jamais averti.
- **Résolu le 18/10 (K1)** : `take_next` sur un ticket appelé sans retard déclaré relève du code commun `queue.invalid_transition` (TRD §6.2). Question d'origine : code d'erreur de ce cas.
- **Résolu le 19/10 (E20)** : une fois appelé, un client avec rendez-vous suit H4 et passe « Absent » à 10 min, absence comptée (scénario 4 decies). Question d'origine : rendez-vous appelé qui n'arrive pas : la règle 7 (« il garde sa priorité jusqu'à 10 min après l'heure du rendez-vous ; au-delà, il est pris dès que possible ») dit que le client en retard reste dans la file, alors que H4 libère sa place 10 min après l'appel. Un rendez-vous appelé à son heure et absent 10 min plus tard passe-t-il « Absent » (avec une absence comptée), ou reste-t-il en attente ?
- [PRD / TRD] Rendez-vous saisi sans téléphone : son ticket n'a ni compte ni contact (K28 : contact seulement si le numéro est connu). Une absence se compte-t-elle sans `phone_hash` (aucune ligne possible dans `private.no_show_records`) ? Vers qui partent rappel et « place libérée » ?
