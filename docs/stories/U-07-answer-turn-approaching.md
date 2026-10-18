# U-07 · Répondre à « votre tour approche »

**En tant que** client inscrit dans une file, **je veux** répondre à l'alerte « votre tour approche » (à l'heure, en retard de 5 à 30 min, ou j'annule), **afin que** le salon sache si j'arrive et que je ne perde pas ma place sans explication.

- Priorité : I (PRD §5.3)
- Règles appliquées : H3 (notification à T-30 min avec réponse du client), H5 (recul de 2 places au plus, sur retard déclaré seulement, avec motif affiché et journal d'audit) (PRD §5.1) ; retard déclarable de 5 à 30 min, au-delà le client annule et se réinscrit (PRD §5.1 « Autres règles ») ; transitions 3 et 6 (PRD §5.2) ; notifications « Votre tour approche » et « Recul » (PRD §5.4)
- Parcours : F-C6, F-C5 (bouton « Je serai en retard »), F-C10 (APP_FLOW §3) ; événements « Votre tour approche », « Recul » (APP_FLOW §7)
- Commandes et données : `respond_eta` (`ticket_id`, `response` = `on_time` | `late` | `cancel`, `delay_minutes?` de 5 à 30) · `queue-tick` (envoi de T-30) · tables `tickets` (`turn_approaching_sent_at`, `t30_estimated_start_at`, `eta_response`, `declared_delay_minutes`, `postpone_count`, `status`, `cancel_reason`), `ticket_events` (`eta_responded`, `postponed`, `cancelled`), `notifications` (`turn_approaching`, `postponed`)

## Scénarios

### 1. Alerte T-30 envoyée une seule fois
- **Étant donné** que mon ticket est « En attente » et que mon heure de passage arrive à 30 min ou moins
- **Quand** le moteur détecte ce seuil
- **Alors** je reçois une notification push « Votre tour approche » avec trois réponses : « Je serai à l'heure », « En retard de… », « J'annule »
- **Et** aucun SMS n'est envoyé pour cette alerte
- **Et** l'heure de passage annoncée à cet instant est enregistrée (`t30_estimated_start_at`)

### 2. Pas de seconde alerte T-30
- **Étant donné** que j'ai déjà reçu l'alerte T-30
- **Quand** mon heure de passage remonte au-dessus de 30 min puis redescend à 30 min ou moins
- **Alors** je ne reçois pas de seconde alerte T-30

### 3. Bandeau sur la page de suivi
- **Étant donné** que l'alerte T-30 a été déclenchée pour mon ticket et que je n'ai pas encore répondu
- **Quand** j'ouvre `/ticket` ou `/t/:shortCode`
- **Alors** un bandeau affiche les trois mêmes réponses

### 4. Client sans push : réponses sur la page seulement
- **Étant donné** que je n'ai pas de push actif
- **Quand** mon heure de passage arrive à 30 min ou moins
- **Alors** aucune notification ni aucun SMS ne m'est envoyé pour T-30
- **Et** le bandeau de réponse est affiché à l'ouverture de ma page de suivi

### 5. « Je serai à l'heure »
- **Étant donné** que l'alerte T-30 est affichée
- **Quand** je touche « Je serai à l'heure »
- **Alors** ma réponse `on_time` est enregistrée sur le ticket
- **Et** un événement `eta_responded` est ajouté au journal
- **Et** le coiffeur voit ma réponse sur ma carte, dans son espace
- **Et** mon ticket garde sa place

### 6. « En retard de… » avec recul
- **Étant donné** que l'alerte T-30 est affichée
- **Quand** je choisis « En retard de… » puis 15 min
- **Alors** ma réponse `late` et un retard de 15 min sont enregistrés sur le ticket
- **Et** si un recul est nécessaire, mon ticket recule de 2 places au plus
- **Et** ma nouvelle heure de passage est affichée avec la raison du changement
- **Et** en cas de recul, je reçois une notification push « Recul » avec ma nouvelle position et la raison, sans SMS
- **Et** en cas de recul, un événement `postponed` est ajouté au journal avec le motif

### 7. Durées de retard proposées
- **Étant donné** que je touche « En retard de… »
- **Quand** le choix de durée s'affiche
- **Alors** seules les durées 5, 10, 15, 20 et 30 min sont proposées
- **Et** aucune durée au-delà de 30 min n'est proposée

### 8. Retard hors des bornes refusé
- **Étant donné** un ticket « En attente »
- **Quand** une commande `respond_eta` arrive avec `late` et un retard de 35 min (ou de 0 min)
- **Alors** la commande est refusée
- **Et** le ticket n'est pas modifié

### 9. Erreur `queue.postpone_limit_reached`
- **Étant donné** que mon ticket a déjà reculé de 2 places au total (`postpone_count` = 2)
- **Quand** je déclare un nouveau retard
- **Alors** mon ticket ne recule pas davantage
- **Et** le message d'erreur `queue.postpone_limit_reached` s'affiche (voir questions ouvertes)

### 10. « J'annule »
- **Étant donné** que l'alerte T-30 est affichée
- **Quand** je touche « J'annule » puis que je confirme
- **Alors** mon ticket passe au statut « Annulé »
- **Et** un événement `cancelled` est ajouté au journal
- **Et** les tickets suivants avancent
- **Et** l'écran de fin s'affiche avec « Rejoindre une autre file »

### 11. Sans réponse
- **Étant donné** que j'ai reçu l'alerte T-30
- **Quand** je ne réponds pas
- **Alors** mon ticket reste à sa place
- **Et** le coiffeur voit « sans réponse » sur ma carte

### 12. Réponse depuis le lien SMS
- **Étant donné** que je suis mon ticket par `/t/:shortCode`, sans session
- **Quand** je réponds « Je serai à l'heure » dans le bandeau
- **Alors** ma réponse est enregistrée comme depuis l'app

### 13. Erreur `queue.invalid_transition`
- **Étant donné** que mon ticket vient d'être annulé par le salon ou est déjà terminé
- **Quand** j'envoie une réponse à T-30 depuis une notification ou une page restée ouverte
- **Alors** la réponse est refusée et le ticket n'est pas modifié
- **Et** le message d'erreur `queue.invalid_transition` s'affiche

### 14. Double appui
- **Étant donné** que l'alerte T-30 est affichée
- **Quand** je touche deux fois de suite « Je serai à l'heure »
- **Alors** une seule réponse est enregistrée
- **Et** un seul événement `eta_responded` est ajouté au journal

### 15. Confidentialité : le coiffeur voit la réponse, pas le numéro
- **Étant donné** que j'ai répondu « En retard de 15 min »
- **Quand** le coiffeur consulte ma carte et que le gérant consulte le dashboard
- **Alors** ils voient mon prénom et mon retard de 15 min
- **Et** ni l'un ni l'autre ne voit mon numéro de téléphone

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `notifications.turn_approaching.push` | _À rédiger (absent des docs)_ | Push seulement, avec trois actions |
| `notifications.turn_approaching.actions.on_time` | « Je serai à l'heure » | Action push |
| `notifications.turn_approaching.actions.late` | « En retard de… » | Action push |
| `notifications.turn_approaching.actions.cancel` | « J'annule » | Action push |
| `client.ticket.turn_approaching.banner` | _À rédiger (absent des docs)_ | — |
| `client.ticket.late.option` | « {minutes} min » | Valeurs : 5, 10, 15, 20, 30 |
| `client.ticket.turn_approaching.cancel_confirm` | _À rédiger (absent des docs)_ | — |
| `client.ticket.change_reason.client_late` | _À rédiger (absent des docs)_ | Raison affichée du recul (H5) |
| `notifications.postponed.push` | _À rédiger (absent des docs)_ | Push seulement ; nouvelle position et raison |
| `errors.queue.postpone_limit_reached` | _À rédiger (absent des docs)_ | — |
| `errors.queue.invalid_transition` | _À rédiger (absent des docs)_ | Partagé avec U-08, U-11, U-12 |

## Questions ouvertes
- **PRD §5.2 transition 3 / APP_FLOW F-C6 / TRD §6.2** : quand le recul s'applique-t-il ? Selon le PRD, seulement quand le coiffeur choisit « Prendre le suivant » (`take_next`) pour un client **appelé** qui a déclaré un retard. Selon APP_FLOW, dès la réponse « En retard de… » (« recul de 2 places au plus si nécessaire »). De combien de places recule-t-on pour un retard donné, et qu'est-ce qui rend le recul « nécessaire » ?
- **PRD §5.1 / APP_FLOW F-C6** : le PRD autorise un retard « de 5 à 30 min » ; APP_FLOW propose 5, 10, 15, 20 et 30 min, sans 25. Est-ce voulu ?
- **TRD §6.2** : avec `postpone_count` = 2, une nouvelle réponse `late` est-elle refusée (`queue.postpone_limit_reached`), ou acceptée et enregistrée sans recul ?
- **APP_FLOW F-C5 / F-C6** : peut-on changer de réponse (passer de « à l'heure » à « en retard ») ? « Je serai en retard » est-il utilisable avant T-30, et une fois appelé (C-09 suppose qu'un client appelé a pu déclarer un retard) ?
- **APP_FLOW F-C6** : depuis la notification push, « En retard de… » demande une durée et « J'annule » une confirmation. Ces deux actions ouvrent-elles l'app sur le bandeau ?
- **TRD §6.2** : aucun code d'erreur métier ne correspond à un `delay_minutes` hors de 5 à 30 (validation zod). Quelle clé `errors.*` utiliser ?
- **BACKEND_SCHEMA §3** : « J'annule » donne le statut `cancelled`. Le `cancel_reason` est-il bien `client_cancelled` ?
- **APP_FLOW F-C6** : la confirmation de « J'annule » reprend-elle le texte de F-C8 (« Votre place sera donnée au suivant ») ?
- **Textes** : l'alerte T-30, le bandeau, la raison du recul, la notification « Recul » et les messages d'erreur ne figurent dans aucun document.
