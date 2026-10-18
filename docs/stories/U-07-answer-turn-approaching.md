# U-07 · Répondre à « votre tour approche »

**En tant que** client inscrit dans une file, **je veux** répondre à l'alerte « votre tour approche » (à l'heure, en retard de 5 à 30 min, ou j'annule), **afin que** le salon sache si j'arrive et que je ne perde pas ma place sans explication.

- Priorité : I (PRD §5.3)
- Règles appliquées : H3 (notification à T-30 min avec réponse du client), H5 (recul de 2 places au plus, sur retard déclaré seulement, avec motif affiché et journal d'audit) (PRD §5.1) ; retard déclarable de 5 à 30 min, au-delà le client annule et se réinscrit ; un retard déclaré ne fait reculer que si le coiffeur choisit « Prendre le suivant », et le compteur de 10 min part de l'heure d'arrivée annoncée (E2) ; sans la case « Me prévenir », la notification T-30 ne part pas (K11) (PRD §5.1 « Autres règles ») ; transitions 3, 6 et 7 (PRD §5.2) ; notification « Votre tour approche » (PRD §5.4)
- Parcours : F-C6, F-C5 (bouton « Je serai en retard »), F-C7, F-C10 (APP_FLOW §3) ; côté coiffeur F-S5 et F-S8 (C-09) ; événements « Votre tour approche », « Libération », « Recul » (APP_FLOW §7)
- Commandes et données : `respond_eta` (`ticket_id`, `response` = `on_time` | `late` | `cancel`, `delay_minutes?` de 5 à 30 ; code `queue.invalid_delay` et codes communs, TRD §6.2) · `take_next` (C-09, seule cause de recul) · `queue-tick` (envoi de T-30, libération à `release_due_at`) · tables `tickets` (`turn_approaching_sent_at`, `t30_estimated_start_at`, `eta_response`, `declared_delay_minutes`, `postpone_count`, `release_due_at`, `status`, `cancel_reason`), `ticket_events` (`eta_responded`, `cancelled`), `notifications` (`turn_approaching`)

## Scénarios

### 1. Alerte T-30 envoyée une seule fois
- **Étant donné** que mon ticket est « En attente », que j'ai coché « Me prévenir » et que mon heure de passage arrive à 30 min ou moins
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

### 4 bis. Sans la case « Me prévenir » (K11)
- **Étant donné** que je n'ai pas coché « Me prévenir » à l'inscription
- **Quand** mon heure de passage arrive à 30 min ou moins
- **Alors** la notification T-30 ne part pas (`skipped`, motif `no_consent`)
- **Et** le bandeau de réponse est affiché à l'ouverture de ma page de suivi

### 5. « Je serai à l'heure »
- **Étant donné** que l'alerte T-30 est affichée
- **Quand** je touche « Je serai à l'heure »
- **Alors** ma réponse `on_time` est enregistrée sur le ticket
- **Et** un événement `eta_responded` est ajouté au journal
- **Et** le coiffeur voit ma réponse sur ma carte, dans son espace
- **Et** mon ticket garde sa place

### 6. « En retard de… » : pas de recul immédiat (E2)
- **Étant donné** que l'alerte T-30 est affichée et que mon ticket est 1er chez mon coiffeur
- **Quand** je choisis « En retard de… » puis 15 min
- **Alors** ma réponse `late` et un retard de 15 min sont enregistrés sur le ticket
- **Et** un événement `eta_responded` est ajouté au journal
- **Et** mon ticket garde sa place : il ne recule pas (`postpone_count` inchangé)
- **Et** aucune notification « Recul » ne m'est envoyée et aucun événement `postponed` n'est ajouté
- **Et** le coiffeur voit « en retard de 15 min » sur ma carte, dans son espace

### 6 bis. Recul seulement si le coiffeur choisit « Prendre le suivant » (renvoi vers C-09)
- **Étant donné** que j'ai déclaré un retard de 15 min et que le coiffeur m'appelle
- **Quand** le coiffeur choisit « Prendre le suivant » (`take_next`)
- **Alors** mon ticket recule de 2 places au plus
- **Et** je reçois une notification push « Recul » avec ma nouvelle position et la raison, sans SMS
- **Et** un événement `postponed` est ajouté au journal avec le motif
- **Quand** le coiffeur choisit d'attendre
- **Alors** mon ticket reste appelé et le compteur continue

### 6 ter. Pas de libération à 10 min après l'appel quand j'ai déclaré un retard (E2)
- **Étant donné** que j'ai déclaré un retard de 20 min et que le coiffeur m'appelle
- **Quand** 10 min se sont écoulées depuis l'appel sans que mon arrivée soit validée, et que l'heure d'arrivée que j'ai annoncée n'est pas encore passée
- **Alors** ma place n'est pas libérée et mon ticket reste « Appelé »
- **Et** la carte « Appel en cours » du coiffeur affiche un compteur jusqu'à la libération calculée à partir de mon heure d'arrivée annoncée, et mon retard déclaré (`release_due_at`, heure exacte : voir questions ouvertes)

### 7. Durées de retard proposées
- **Étant donné** que je touche « En retard de… »
- **Quand** le choix de durée s'affiche
- **Alors** seules les durées 5, 10, 15, 20 et 30 min sont proposées
- **Et** aucune durée au-delà de 30 min n'est proposée

### 8. Erreur `queue.invalid_delay` : retard hors des bornes
- **Étant donné** un ticket « En attente »
- **Quand** une commande `respond_eta` arrive avec `late` et un retard de 35 min (ou de 4 min)
- **Alors** la commande est refusée avec le code `queue.invalid_delay`
- **Et** le ticket n'est pas modifié
- **Quand** le retard est de 5 min ou de 30 min
- **Alors** la réponse est enregistrée

### 9. Retard déclaré après 2 places de recul
- **Étant donné** que mon ticket a déjà reculé de 2 places au total (`postpone_count` = 2)
- **Quand** je déclare un nouveau retard de 10 min
- **Alors** ma réponse est enregistrée, sans erreur (`respond_eta` n'a pas le code `postpone_limit_reached`, propre à `take_next`, TRD §6.2)
- **Et** mon ticket ne recule pas

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
| `client.ticket.change_reason.client_late` | _À rédiger (absent des docs)_ | Raison affichée du recul (H5) ; partagé avec C-09 |
| `notifications.postponed.push` | _À rédiger (absent des docs)_ | Push seulement ; nouvelle position et raison ; envoyé après `take_next` (C-09) |
| `errors.queue.invalid_delay` | _À rédiger (absent des docs)_ | Retard hors 5 à 30 min |
| `errors.queue.invalid_transition` | _À rédiger (absent des docs)_ | Partagé avec U-08, U-11, U-12 |

## Questions ouvertes
- **Résolu le 18/10** (E2) — Moment du recul : seulement quand le coiffeur choisit « Prendre le suivant » ; aucun recul à la réponse ; voir scénarios 6 et 6 bis.
- **PRD §5.1 et §5.2 transition 7 / TRD §6.2 `call_ticket` / BACKEND_SCHEMA §4.13 `release_due_at` / APP_FLOW F-C7** : l'heure de libération d'un client qui a déclaré un retard diffère selon les documents. PRD : « son compteur de 10 min part de l'heure d'arrivée qu'il a annoncée » (libération à l'heure annoncée + 10 min). TRD et schéma : `release_due_at` = appel + 10 min, ou l'heure d'arrivée annoncée si elle est plus tardive (libération à l'heure annoncée). APP_FLOW F-C7 : « à l'heure d'arrivée annoncée ». Laquelle tester ?
- **PRD §5.1 / BACKEND_SCHEMA §4.13** : comment calcule-t-on « l'heure d'arrivée annoncée » à partir d'un retard de *n* min : heure de passage annoncée à T-30 (`t30_estimated_start_at`) + *n*, heure de passage courante + *n*, ou heure de la réponse + *n* ?
- **PRD §5.1 / APP_FLOW F-C6** : le PRD autorise un retard « de 5 à 30 min » ; APP_FLOW propose 5, 10, 15, 20 et 30 min, sans 25. Est-ce voulu ?
- **Résolu le 18/10** (K1) — Retard après 2 places de recul : `respond_eta` n'a que le code `invalid_delay` ; `postpone_limit_reached` est propre à `take_next` ; voir scénario 9.
- **APP_FLOW F-C5 / F-C6** : peut-on changer de réponse (passer de « à l'heure » à « en retard ») ? « Je serai en retard » est-il utilisable avant T-30, et une fois appelé (C-09 suppose qu'un client appelé a pu déclarer un retard) ?
- **APP_FLOW F-C5 / F-C7** : l'écran client « C'est votre tour ! » affiche un compteur de 10 min. Pour un client qui a déclaré un retard, ce compteur va-t-il jusqu'à `release_due_at` ?
- **APP_FLOW F-C6** : depuis la notification push, « En retard de… » demande une durée et « J'annule » une confirmation. Ces deux actions ouvrent-elles l'app sur le bandeau ?
- **Résolu le 18/10** (K1) — Code d'un retard hors bornes : `queue.invalid_delay` (TRD §6.2) ; voir scénario 8.
- **BACKEND_SCHEMA §3** : « J'annule » donne le statut `cancelled`. Le `cancel_reason` est-il bien `client_cancelled` ?
- **APP_FLOW F-C6** : la confirmation de « J'annule » reprend-elle le texte de F-C8 (« Votre place sera donnée au suivant ») ?
- **Textes** : l'alerte T-30, le bandeau, la raison du recul, la notification « Recul » et les messages d'erreur ne figurent dans aucun document.
