# U-07 · Répondre à « votre tour approche »

**En tant que** client inscrit dans une file, **je veux** répondre à l'alerte « votre tour approche » (à l'heure, en retard de 5 à 30 min, ou j'annule), **afin que** le salon sache si j'arrive et que je ne perde pas ma place sans explication.

- Priorité : I (PRD §5.3)
- Règles appliquées : H3 (notification à T-30 min avec réponse du client), H5 (recul de 2 places au plus, sur retard déclaré seulement, avec motif affiché et journal d'audit) (PRD §5.1) ; retard déclarable de 5 à 30 min, au-delà le client annule et se réinscrit ; un retard déclaré ne fait reculer que si le coiffeur choisit « Prendre le suivant » ; une fois appelé, le client n'est libéré qu'à l'heure d'arrivée qu'il a annoncée, si elle est plus tardive que les 10 min (E2) ; heure d'arrivée annoncée = heure annoncée à T-30 + retard déclaré (K13) ; « votre tour approche » est un message d'anticipation, retenu sans la case « Me prévenir », alors que le recul (`postponed`) est indispensable (E17) (PRD §5.1 « Autres règles ») ; transitions 3, 6 et 7 (PRD §5.2) ; notification « Votre tour approche » (PRD §5.4)
- Parcours : F-C6, F-C5 (bouton « Je serai en retard »), F-C7, F-C10 (APP_FLOW §3) ; côté coiffeur F-S5 et F-S8 (C-09) ; événements « Votre tour approche », « Libération », « Recul » (APP_FLOW §7)
- Commandes et données : `respond_eta` (`ticket_id`, `response` = `on_time` | `late` | `cancel`, `delay_minutes?` de 5 à 30 ; code `queue.invalid_delay` et codes communs, TRD §6.2) · `take_next` (C-09, seule cause de recul) · `queue-tick` (envoi de T-30, libération à `release_due_at`) · tables `tickets` (`turn_approaching_sent_at`, `t30_estimated_start_at`, `eta_response`, `declared_delay_minutes`, `declared_arrival_at`, `postpone_count`, `call_count`, `release_due_at`, `status`, `cancel_reason` = `client_cancelled` pour « J'annule »), `ticket_events` (`eta_responded`, `cancelled`), `notifications` (`turn_approaching`)

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

### 4 bis. Sans la case « Me prévenir » (E17 : message d'anticipation)

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
- **Et** mon heure d'arrivée annoncée est enregistrée : heure annoncée à T-30 + 15 min (`declared_arrival_at` = `t30_estimated_start_at` + `declared_delay_minutes`, K13)
- **Et** un événement `eta_responded` est ajouté au journal
- **Et** mon ticket garde sa place : il ne recule pas (`postpone_count` inchangé)
- **Et** aucune notification « Recul » ne m'est envoyée et aucun événement `postponed` n'est ajouté
- **Et** le coiffeur voit « en retard de 15 min » sur ma carte, dans son espace

### 6 bis. Recul seulement si le coiffeur choisit « Prendre le suivant » (renvoi vers C-09)

- **Étant donné** que j'ai déclaré un retard de 15 min et que le coiffeur m'appelle
- **Quand** le coiffeur choisit « Prendre le suivant » (`take_next`)
- **Alors** mon ticket recule de 2 places au plus
- **Et** je reçois une notification push « Recul » avec ma nouvelle position et la raison, sans SMS, même sans la case « Me prévenir » (E17)
- **Et** un événement `postponed` est ajouté au journal avec le motif
- **Et** mon ticket redevient « En attente », ses heures d'appel (`called_at`, `reminder_sent_at`, `release_due_at`) sont vidées (K31)
- **Et** le client suivant est appelé
- **Quand** le coiffeur choisit d'attendre
- **Alors** mon ticket reste appelé et le compteur continue

### 6 ter. Libération à l'heure d'arrivée annoncée quand elle est plus tardive (E2, K13)

- **Étant donné** que l'heure annoncée à T-30 était 15h00, que j'ai déclaré un retard de 20 min (heure d'arrivée annoncée 15h20) et que le coiffeur m'appelle à 15h00
- **Quand** l'appel est enregistré
- **Alors** l'heure de libération de mon ticket est 15h20, la plus tardive entre 15h10 (appel + 10 min) et 15h20 (`release_due_at`)
- **Quand** il est 15h10 et que mon arrivée n'est pas validée
- **Alors** ma place n'est pas libérée et mon ticket reste « Appelé »
- **Quand** il est 15h20 et que mon arrivée n'est toujours pas validée
- **Alors** mon ticket passe « Absent »
- **Et** la carte « Appel en cours » du coiffeur affiche mon retard déclaré et un compteur jusqu'à 15h20
- **Et** l'heure du rappel dans ce cas (5 min après l'appel, ou 5 min avant la libération) dépend de E33 (en attente d'Ely)

### 6 quater. Retard déclaré plus court que les 10 min

- **Étant donné** que l'heure annoncée à T-30 était 15h00, que j'ai déclaré un retard de 5 min et que le coiffeur m'appelle à 15h00
- **Quand** l'appel est enregistré
- **Alors** l'heure de libération est 15h10 (appel + 10 min), plus tardive que 15h05

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
- **Alors** mon ticket passe au statut « Annulé » avec le motif `client_cancelled` (BACKEND_SCHEMA §3), sans absence comptée
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

| Clé (anglais)                                    | Texte (français)                                                                                     | Contrainte                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `notifications.turn_approaching.push`            | Voir `notifications.turn_approaching.push.*` dans le dictionnaire (2 textes)                         | Push seulement, avec trois actions                                                                           |
| `notifications.turn_approaching.actions.on_time` | « Je serai à l'heure »                                                                               | Action push                                                                                                  |
| `notifications.turn_approaching.actions.late`    | « En retard de… »                                                                                    | Action push                                                                                                  |
| `notifications.turn_approaching.actions.cancel`  | « J'annule »                                                                                         | Action push                                                                                                  |
| `client.ticket.turn_approaching.banner`          | Votre tour approche. Serez-vous à l'heure ?                                                          | —                                                                                                            |
| `client.ticket.late.title`                       | Combien de retard prévoyez-vous ?                                                                    | —                                                                                                            |
| `client.ticket.late.hint`                        | Plus de 30 min de retard ? Annulez votre place et réinscrivez-vous plus tard.                        | Borne de 30 min                                                                                              |
| `client.ticket.late.sent`                        | Le salon est prévenu. Si votre tour arrive avant vous, le coiffeur pourra prendre le client suivant. | Après `respond_eta` (`late`)                                                                                 |
| `client.ticket.end.reason.client_cancelled`      | Vous avez annulé votre place. Elle a été donnée au client suivant.                                   | Après « J'annule » ; partagé avec U-08                                                                       |
| `client.ticket.late.option`                      | « {minutes} min »                                                                                    | Valeurs : 5, 10, 15, 20, 30                                                                                  |
| `client.ticket.turn_approaching.cancel_confirm`  | Annuler votre place ? Elle sera donnée au client suivant.                                            | —                                                                                                            |
| `common.change_reason.client_late`               | « Vous étiez en retard : le suivant est passé. »                                                     | Raison affichée du recul (H5) ; partagé avec C-09                                                            |
| `notifications.postponed.push`                   | Voir `notifications.postponed.push.*` dans le dictionnaire (2 textes)                                | Push seulement ; nouvelle position et raison ; envoyé après `take_next` (C-09) ; message indispensable (E17) |
| `errors.queue.invalid_delay`                     | Le retard doit être compris entre 5 et 30 min. Choisissez une autre durée.                           | Retard hors 5 à 30 min                                                                                       |
| `errors.queue.invalid_transition`                | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran.                       | Partagé avec U-08, U-11, U-12                                                                                |

## Questions ouvertes

- **Résolu le 18/10** (E2) — Moment du recul : seulement quand le coiffeur choisit « Prendre le suivant » ; aucun recul à la réponse ; voir scénarios 6 et 6 bis.
- **Résolu le 19/10** (E2, K13 ; PRD v1.2 §5.1, transition 7 et §11 alignés) — Libération à `release_due_at` = la plus tardive de l'appel + 10 min et de l'heure d'arrivée annoncée ; voir scénarios 6 ter et 6 quater. Question d'origine : l'heure de libération d'un client qui a déclaré un retard diffère selon les documents. PRD : « son compteur de 10 min part de l'heure d'arrivée qu'il a annoncée » (libération à l'heure annoncée + 10 min). TRD et schéma : `release_due_at` = appel + 10 min, ou l'heure d'arrivée annoncée si elle est plus tardive (libération à l'heure annoncée). APP_FLOW F-C7 : « à l'heure d'arrivée annoncée ». Laquelle tester ?
- **Résolu le 19/10** (K13) — Heure d'arrivée annoncée = `t30_estimated_start_at` + `declared_delay_minutes` ; voir scénario 6. Question d'origine : comment calcule-t-on « l'heure d'arrivée annoncée » à partir d'un retard de _n_ min : heure de passage annoncée à T-30 (`t30_estimated_start_at`) + _n_, heure de passage courante + _n_, ou heure de la réponse + _n_ ?
- **PRD §5.1 / APP_FLOW F-C6** : le PRD autorise un retard « de 5 à 30 min » ; APP_FLOW propose 5, 10, 15, 20 et 30 min, sans 25. Est-ce voulu ?
- **Résolu le 18/10** (K1) — Retard après 2 places de recul : `respond_eta` n'a que le code `invalid_delay` ; `postpone_limit_reached` est propre à `take_next` ; voir scénario 9.
- **APP_FLOW F-C5 / F-C6** : peut-on changer de réponse (passer de « à l'heure » à « en retard ») ? « Je serai en retard » est-il utilisable avant T-30, et une fois appelé (C-09 suppose qu'un client appelé a pu déclarer un retard) ? Dans ce cas, quelle heure annoncée sert de base au calcul de K13, `t30_estimated_start_at` étant vide avant T-30 ?
- **Rattachée à E33** (rappel après un retard déclaré, en attente d'Ely) : le rappel part-il 5 min après l'appel (BACKEND_SCHEMA §10 : `called_at` + 5 min) ou 5 min avant `release_due_at` (proposition de la revue d'architecture) ? Voir scénario 6 ter.
- **notifications.json** : le push et le SMS « votre tour » disent « Vous avez 10 min pour arriver » et « Venez sous 10 min », alors qu'un client qui a déclaré un retard plus long n'est libéré qu'à son heure annoncée (E2). Faut-il une variante de texte pour ce cas ?
- **APP_FLOW F-C5 / F-C7** : l'écran client « C'est votre tour ! » affiche un compteur de 10 min. Pour un client qui a déclaré un retard, ce compteur va-t-il jusqu'à `release_due_at` (APP_FLOW ne le dit pas) ?
- **APP_FLOW F-C6** : depuis la notification push, « En retard de… » demande une durée et « J'annule » une confirmation. Ces deux actions ouvrent-elles l'app sur le bandeau ?
- **Résolu le 18/10** (K1) — Code d'un retard hors bornes : `queue.invalid_delay` (TRD §6.2) ; voir scénario 8.
- **Résolu le 19/10** (BACKEND_SCHEMA v0.5 §3, constat 28) — « J'annule » à T-30 : motif `client_cancelled` ; voir scénario 10.
- **Résolu le 19/10** (dictionnaire `client.json`) — Confirmation de « J'annule » : texte propre `client.ticket.turn_approaching.cancel_confirm`.
- **Résolu le 19/10** (dictionnaire, K26) — Textes de l'alerte T-30, du bandeau, de la raison du recul (`common.change_reason.client_late`), de la notification « Recul » et des erreurs rédigés.
