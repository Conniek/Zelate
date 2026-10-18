# C-07 · Ajuster la durée de la prestation en cours

**En tant que** coiffeur, **je veux** rallonger la prestation en cours d'un geste (+5, +15, +30, +45 min), **afin que** les clients suivants aient une heure de passage juste sans que j'arrête de coiffer.

- Priorité : I (PRD §5.3)
- Règles appliquées : H2, H9 ; PRD §5.2 « Calcul de l'heure de passage » (minimum m = 5 min en cas de débordement) et « Fin de journée » ; PRD §5.1 règle des 10 min ; PRD §5.4 « Changement d'heure », « Risque de fin de journée »
- Parcours : F-S7 (APP_FLOW §4) ; APP_FLOW §8 (mise à jour de l'app)
- Commandes et données : `adjust_duration` · tables `tickets` (`planned_duration_minutes`, `estimated_start_at`, `end_of_day_warned_at`), `ticket_events`, `notifications`

## Scénarios

### 1. Rallonger de 15 min
- **Étant donné** Inès en prestation avec Léa depuis 14h00, durée prévue 30 min
- **Quand** à 14h20, Inès touche « +15 »
- **Alors** la durée prévue devient 45 min
- **Et** la fin estimée affichée passe à 14h45
- **Et** le journal du ticket enregistre un événement `duration_adjusted`
- **Et** chaque client suivant dont l'heure de passage recule de 15 min reçoit une notification push de changement d'heure, avec la nouvelle heure et la raison
- **Et** aucun SMS n'est envoyé pour ce changement d'heure
- **Et** le dashboard affiche la nouvelle fin estimée en moins de 2 s

### 2. Petit ajustement sans notification
- **Étant donné** Inès en prestation, avec des clients suivants dont l'heure n'a pas encore bougé
- **Quand** elle touche « +5 »
- **Alors** la durée prévue augmente de 5 min
- **Et** aucune notification de changement d'heure n'est envoyée

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
- **Alors** la commande est refusée par la validation du contrat
- **Et** la durée prévue ne change pas

### 6. Prestation qui déborde sans ajustement
- **Étant donné** Inès en prestation depuis 14h00, durée prévue 30 min, sans ajustement
- **Quand** il est 14h35
- **Alors** le temps restant pris en compte pour les clients suivants est de 5 min (minimum m = 5 min, PRD §5.2)
- **Et** la fin estimée affichée est 14h40

### 7. Ajustement qui fait passer un client après la fermeture
- **Étant donné** il est moins de 2 h avant la fermeture du salon (valeur par défaut de `salons.end_of_day_warning_minutes` = 120)
- **Et** Karim, client suivant d'Inès, n'a encore reçu aucune alerte de fin de journée
- **Quand** Inès touche « +45 » et la fin estimée de Karim dépasse l'heure de fermeture
- **Alors** Karim reçoit une seule alerte « Vous risquez de ne pas être pris avant la fermeture », avec « Je reste » ou « J'annule »
- **Et** l'alerte part par push, ou par SMS s'il n'a pas de push actif, dans la limite de 3 SMS par ticket
- **Et** l'envoi est horodaté (`end_of_day_warned_at`)

### 8. Alerte de fin de journée déjà envoyée
- **Étant donné** Karim, qui a déjà reçu l'alerte de fin de journée aujourd'hui
- **Quand** un nouvel ajustement d'Inès repousse encore sa fin estimée après la fermeture
- **Alors** aucune seconde alerte de fin de journée n'est envoyée à Karim

### 9. Pas de mise à jour de l'app pendant la prestation
- **Étant donné** Inès en prestation et une nouvelle version de Zelaté Pro disponible
- **Quand** l'app détecte la nouvelle version
- **Alors** le toast « Nouvelle version » ne s'affiche pas tant que la prestation est en cours

### 10. Ticket d'un autre coiffeur ou pas en prestation
- **Étant donné** Léa en prestation chez Karim
- **Quand** une commande `adjust_duration` est envoyée avec le compte d'Inès pour ce ticket
- **Alors** la commande est refusée avec `queue.not_assigned_to_you`
- **Et** la durée prévue ne change pas

### 11. Connexion perdue
- **Étant donné** Inès en prestation, dont l'écran affiche « Connexion perdue »
- **Quand** elle veut toucher « +15 »
- **Alors** les boutons d'ajustement sont désactivés
- **Et** la durée prévue ne change pas

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.service.in_progress` | « En cours » | APP_FLOW F-S7 |
| `pro-stylist.service.elapsed_planned` | À rédiger (REQ-3) | Temps écoulé / prévu, annoncé au lecteur d'écran une fois par minute au plus |
| `pro-stylist.service.estimated_end` | À rédiger (REQ-3) | Fin estimée |
| `pro-stylist.service.adjust_5` | « +5 » | Nom accessible à rédiger (ex. durée en minutes) |
| `pro-stylist.service.adjust_15` | « +15 » | Idem |
| `pro-stylist.service.adjust_30` | « +30 » | Idem |
| `pro-stylist.service.adjust_45` | « +45 » | Idem |
| `common.app_update.toast` | « Nouvelle version » | APP_FLOW §8 ; jamais pendant une prestation |
| `common.app_update.reload` | « Recharger » | APP_FLOW §8 |
| `notifications.estimate_changed.push.title` / `.body` | À rédiger (REQ-3) | Push seulement ; raison : prestation en cours rallongée |
| `notifications.end_of_day_risk.push.body` | « Vous risquez de ne pas être pris avant la fermeture » | PRD §5.2 ; boutons « Je reste » / « J'annule » ; partagé avec U-11 |
| `notifications.end_of_day_risk.sms` | À rédiger (REQ-3) | SMS ≤ 160 caractères GSM-7, testé avec les valeurs de longueur maximale ; seulement sans push actif, dans le plafond de 3 SMS ; partagé avec U-11 |
| `errors.queue.not_assigned_to_you` | À rédiger (REQ-3) | Voir C-06 |

## Questions ouvertes
- [PRD / APP_FLOW / TRD] Seuil de notification : PRD §5.1 « 10 min ou plus », APP_FLOW F-S7 « au-delà de 10 min d'écart », TRD §6.2 « ±10 min ». Un client dont l'heure bouge d'exactement 10 min est-il notifié ?
- [PRD / BACKEND_SCHEMA] La variation de 10 min se mesure par rapport à quoi : la dernière heure notifiée au client, ou l'estimation précédente ? Avec trois « +5 » successifs, le client a reculé de 15 min sans qu'un seul ajustement atteigne 10 min.
- [PRD / BACKEND_SCHEMA] Plafond de la durée cumulée : `planned_duration_minutes` est limité à 240 min. Que se passe-t-il quand un « +45 » dépasserait 240 : refus (quel code ?), ou plafonnement ?
- [PRD] Annuler un ajustement fait par erreur (« +45 » au lieu de « +5 ») : aucun moyen prévu. Est-ce voulu ?
- [TRD §6.2] Code d'erreur pour `adjust_duration` sur un ticket qui n'est pas en prestation (`invalid_transition` ?), et clé `errors` d'une erreur de validation de contrat.
