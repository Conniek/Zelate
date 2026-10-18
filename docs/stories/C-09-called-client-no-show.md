# C-09 · Gérer un client appelé qui n'arrive pas

**En tant que** coiffeur, **je veux** suivre le compteur de 10 min d'un client appelé, prendre le suivant s'il a déclaré un retard, et voir sa place libérée automatiquement à 10 min, **afin de** ne pas rester à attendre sans rien pouvoir faire.

- Priorité : I (PRD §5.3)
- Règles appliquées : H4, H5, H3 ; PRD §5.2 transitions 3 et 7 ; PRD §5.1 « Absences répétées » ; PRD §5.4 « Rappel », « Place libérée », « Recul »
- Parcours : F-S8 (APP_FLOW §4) ; F-C7 côté client ; événements « Rappel », « Libération », « Recul » (APP_FLOW §7)
- Commandes et données : `take_next` ; libération par `queue-tick` (sans commande) · tables `tickets` (`called_at`, `reminder_sent_at`, `postpone_count`, `eta_response`, `declared_delay_minutes`, `no_show_at`), `ticket_events`, `notifications` ; colonnes `salons.reminder_after_minutes` (5) et `salons.auto_release_after_minutes` (10)

## Scénarios

### 1. Rappel à 5 min
- **Étant donné** Inès qui a appelé Léa à 14h00, et Léa, qui a le push actif, n'est pas arrivée
- **Quand** il est 14h05
- **Alors** Léa reçoit la notification push « Le salon vous attend, place libérée dans 5 min »
- **Et** l'envoi du rappel est horodaté (`reminder_sent_at`)
- **Et** la carte « Appel en cours » d'Inès affiche « rappel envoyé »

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
- **Étant donné** Léa appelée à 14h00, dont l'arrivée n'a pas été validée
- **Quand** il est 14h10
- **Alors** le ticket de Léa passe au statut « Absent » (`no_show`, `no_show_at` renseigné), sans action d'Inès
- **Et** l'écran d'Inès revient sur « Ma file »
- **Et** un bandeau d'information y signale la libération de la place de Léa
- **Et** Léa reçoit une notification push lui proposant de se réinscrire, sans SMS
- **Et** les clients suivants avancent
- **Et** ce ticket compte comme une absence du client (base de l'avertissement après 5 absences en 30 jours, P-03)
- **Et** le dashboard met à jour son compteur d'absences
- **Et** le journal du ticket enregistre un événement `no_show` avec le système comme acteur

### 5. Libération même si le téléphone du coiffeur est hors ligne
- **Étant donné** Léa appelée à 14h00 et le téléphone d'Inès sans connexion
- **Quand** il est 14h10 sans arrivée validée
- **Alors** le ticket de Léa passe quand même au statut « Absent »
- **Et** au retour de la connexion, l'écran d'Inès affiche « Ma file » à jour

### 6. « Prendre le suivant » réservé au retard déclaré
- **Étant donné** Léa appelée, pas arrivée, qui n'a déclaré aucun retard
- **Quand** Inès regarde la carte « Appel en cours »
- **Alors** le bouton « Prendre le suivant » n'est pas proposé

### 7. Prendre le suivant quand le client a déclaré un retard
- **Étant donné** Léa appelée, qui a déclaré un retard de 15 min, et dont le ticket n'a jamais reculé (`postpone_count` = 0)
- **Et** d'autres tickets éligibles pour Inès après celui de Léa
- **Quand** Inès touche « Prendre le suivant »
- **Alors** une confirmation affiche « Léa passera après *n* clients (2 maximum) », *n* étant au plus 2
- **Quand** Inès confirme
- **Alors** le ticket de Léa repasse « En attente », reculé de *n* places
- **Et** `postpone_count` vaut *n*
- **Et** Léa reçoit une notification push de recul avec sa nouvelle position et la raison, sans SMS
- **Et** le journal du ticket enregistre un événement `postponed` avec le motif
- **Et** le prochain ticket éligible est appelé : son client reçoit « Votre tour » par push et SMS, et un nouveau compteur de 10 min démarre

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
| `pro-stylist.call.reminder_sent` | « rappel envoyé » | APP_FLOW F-S5 / §7 |
| `pro-stylist.call.declared_delay` | À rédiger (REQ-3) | Retard déclaré par le client, en minutes |
| `pro-stylist.take_next.button` | « Prendre le suivant » | APP_FLOW F-S8 |
| `pro-stylist.take_next.confirm` | « {firstName} passera après {count} clients (2 maximum) » | APP_FLOW F-S8 ; pluriel ICU (1 client / 2 clients) |
| `pro-stylist.call.released_banner` | À rédiger (REQ-3) | Bandeau d'information après la libération à 10 min |
| `common.ticket_status.no_show` | « Absent » | PRD §5.2 |
| `notifications.arrival_reminder.push.body` | « Le salon vous attend, place libérée dans 5 min » | APP_FLOW F-C7 ; push seulement, pas de SMS |
| `notifications.released_no_show.push.title` / `.body` | À rédiger (REQ-3) | Push seulement ; proposition de se réinscrire |
| `notifications.postponed.push.title` / `.body` | À rédiger (REQ-3) | Push seulement ; nouvelle position et raison |
| `errors.queue.postpone_limit_reached` | À rédiger (REQ-3) | Aucun texte dans les documents |
| `errors.queue.not_assigned_to_you` | À rédiger (REQ-3) | Voir C-06 |

## Questions ouvertes
- [PRD] H4 et retard déclaré de 5 à 30 min : un client appelé qui a déclaré 20 min de retard voit-il sa place libérée à 10 min si le coiffeur attend sans toucher « Prendre le suivant » ?
- [PRD / APP_FLOW] « Prendre le suivant » dépend d'un retard déclaré : le client peut-il déclarer un retard après avoir été appelé (l'écran « C'est votre tour ! » de F-C5 / F-C7 ne propose pas « Je serai en retard ») ?
- [PRD / APP_FLOW] Comment se calcule *n* dans « *Prénom* passera après *n* clients » : 2 moins `postpone_count`, borné au nombre de tickets éligibles derrière ? Que se passe-t-il s'il n'y a aucun ticket derrière (`no_eligible_ticket` ?)
- [BACKEND_SCHEMA] `notifications` a une contrainte `unique (ticket_id, channel, dedupe_key)` avec la clé `your_turn` : quand Léa est rappelée après un recul, la seconde notification « Votre tour » serait bloquée comme doublon (même chose pour le rappel à 5 min). Et ce second SMS « Votre tour » compte-t-il dans le plafond de 3 SMS ?
- [TRD] `queue-tick` tourne chaque minute : le rappel et la libération peuvent partir jusqu'à près d'une minute après 5 et 10 min. Quelle tolérance retenir pour les tests ? Le compteur affiché à 0 doit-il attendre le passage de `queue-tick` ?
- [PRD / BACKEND_SCHEMA] « Avertissement après 5 absences en 30 jours » : à la 5e ou à la 6e absence ? Aucune colonne ne stocke le compteur d'absences du client ; qui voit l'avertissement (P-03) ?
- [TRD §6.2] Code d'erreur pour `take_next` sur un ticket appelé sans retard déclaré (`invalid_transition` ?).
