# U-10 · Savoir pourquoi mon heure de passage change

**En tant que** client inscrit dans une file, **je veux** savoir pourquoi mon heure de passage ou ma position change, **afin de** faire confiance à l'heure annoncée et de m'organiser.

- Priorité : I (PRD §5.3, v1.1)
- Règles appliquées : H5 (recul avec motif affiché et journal d'audit) (PRD §5.1) ; toute variation d'heure de 10 min ou plus et tout recul sont expliqués au client ; l'écart se mesure par rapport à la dernière heure annoncée au client et les petits écarts s'additionnent (E11) ; un retard déclaré ne fait reculer que par « Prendre le suivant » (E2) ; « changement d'heure » est un message d'anticipation, retenu sans la case « Me prévenir », alors que le recul est indispensable (E17) (PRD §5.1 « Autres règles ») ; la dernière heure annoncée n'est mise à jour que quand une notification part réellement (K19) ; raison choisie dans l'enum `estimate_change_reason`, textes uniques `common.change_reason.<code>` (K26) ; statut « En pause » : clients notifiés si leur heure bouge de 10 min ou plus ; fin de journée : « si son heure redevient sûre, il est simplement notifié du changement d'heure » (PRD §5.2) ; notifications « Changement d'heure » et « Recul », push sans SMS (PRD §5.4) ; principe de transparence (PRD §7.1)
- Parcours : F-C5 (bandeau « Message de changement ») et F-C10 (APP_FLOW §3) ; événements « Changement d'heure » et « Recul » (APP_FLOW §7)
- Commandes et données : déclenché par `adjust_duration`, `set_presence`, `cancel_ticket`, `complete_service`, `respond_eta`, `take_next`, `reassign_ticket`, `update_appointment` et par le recalcul de `queue-tick` · tables `tickets` (`estimated_start_at`, `last_notified_start_at`, `estimate_version`, `postpone_count`), `ticket_events` (`estimate_changed`, `postponed`), `notifications` (`estimate_changed` avec `params.reason`, `postponed`, `dedupe_key` du type `estimate_changed:v7`) · enum `estimate_change_reason`

## Scénarios

### 1. Heure reculée de 10 min ou plus

- **Étant donné** que j'ai coché « Me prévenir » et que la dernière heure de passage qui m'a été annoncée est 15h00 (`last_notified_start_at`)
- **Quand** le coiffeur pressenti ajoute +15 min à sa prestation en cours et que mon heure passe à 15h15
- **Alors** ma page de suivi affiche un bandeau avec la nouvelle heure et la raison du changement : `service_longer`, « Une prestation dure plus longtemps que prévu. »
- **Et** je reçois une notification push « Changement d'heure » avec la nouvelle heure et la même raison
- **Et** aucun SMS n'est envoyé pour ce changement
- **Et** un événement `estimate_changed` est ajouté au journal du ticket
- **Et** 15h15 devient la dernière heure annoncée (`last_notified_start_at`)

### 2. Heure avancée de 10 min ou plus

- **Étant donné** que j'ai coché « Me prévenir » et que la dernière heure annoncée est 15h00
- **Quand** un client placé avant moi annule et que mon heure passe à 14h45
- **Alors** ma page de suivi affiche un bandeau avec la nouvelle heure et la raison `client_ahead_left`, « Un client avant vous a quitté la file. »
- **Et** je reçois une notification push « Changement d'heure »

### 3. Variation de moins de 10 min

- **Étant donné** que la dernière heure annoncée est 15h00
- **Quand** elle passe à 15h05 après un ajustement de +5 min
- **Alors** la nouvelle heure s'affiche avec l'heure de dernière mise à jour
- **Et** aucun bandeau de changement n'est affiché
- **Et** aucune notification n'est envoyée
- **Et** la dernière heure annoncée reste 15h00

### 3 bis. Petits écarts cumulés (E11)

- **Étant donné** que la dernière heure annoncée est 15h00 et que mon heure est déjà passée à 15h05 sans notification
- **Quand** un nouvel ajustement de +5 min la fait passer à 15h10
- **Alors** l'écart avec la dernière heure annoncée atteint 10 min
- **Et** le bandeau et la notification « Changement d'heure » sont déclenchés
- **Quand** l'écart cumulé n'est que de 9 min (heure passée à 15h09 depuis 15h00 en plusieurs fois)
- **Alors** ni bandeau ni notification ne sont déclenchés

### 4. Limite exacte de 10 min

- **Étant donné** que la dernière heure annoncée est 15h00
- **Quand** elle passe à 15h10
- **Alors** le bandeau et la notification « Changement d'heure » sont déclenchés
- **Quand** elle passe à 15h09 au lieu de 15h10
- **Alors** ni bandeau ni notification ne sont déclenchés

### 4 bis. Va-et-vient sans écart net

- **Étant donné** que la dernière heure annoncée est 15h00
- **Quand** mon heure passe à 15h08, puis revient à 15h02
- **Alors** aucun bandeau ni aucune notification ne sont déclenchés, l'écart avec 15h00 restant sous 10 min

### 5. Pause du coiffeur

- **Étant donné** que le coiffeur pressenti pour mon ticket se met en pause pour 30 min
- **Quand** mon heure de passage recule de 10 min ou plus à cause de cette pause
- **Alors** je reçois la notification « Changement d'heure » avec la raison `stylist_break`, « Le coiffeur prévu fait une pause. »
- **Et** le bandeau de changement s'affiche sur ma page de suivi
- **Et** aucun choix « attendre / premier disponible » ne m'est demandé (E25)

### 6. Recul de position

- **Étant donné** que j'ai déclaré un retard et que le coiffeur m'a appelé
- **Quand** le coiffeur choisit « Prendre le suivant » (`take_next`, seule cause de recul, E2) et que mon ticket recule
- **Alors** ma page de suivi affiche un bandeau avec ma nouvelle position et la raison `client_late`, « Vous étiez en retard : le suivant est passé. »
- **Et** je reçois une notification push « Recul » avec ma nouvelle position et la raison, sans SMS, même sans la case « Me prévenir » (E17)
- **Et** les clients qui passent devant moi et dont l'heure avance de 10 min ou plus voient la raison `client_postponed`, « Un client en retard passe après vous. »
- **Et** un événement `postponed` est ajouté au journal avec le motif

### 7. Heure de nouveau sûre en fin de journée

- **Étant donné** que j'ai reçu l'alerte de risque de fin de journée (U-11)
- **Quand** mon heure de passage redevient sûre et avance de 10 min ou plus
- **Alors** je reçois seulement la notification « Changement d'heure »
- **Et** je ne reçois aucune nouvelle alerte de fin de journée

### 8. Une seule notification par changement

- **Étant donné** qu'un changement d'estimation de 10 min ou plus m'a été notifié
- **Quand** ma page de suivi est relue plusieurs fois sans nouveau changement
- **Alors** je ne reçois pas de seconde notification pour ce même changement

### 9. Lien SMS

- **Étant donné** que je suis mon ticket par `/t/:shortCode`
- **Quand** mon heure de passage change de 10 min ou plus
- **Alors** le bandeau avec la raison s'affiche à la relecture suivante de la page (au plus tard 30 s)

### 9 bis. Sans la case « Me prévenir » (E17, K19)

- **Étant donné** que je n'ai pas coché « Me prévenir » et que la dernière heure annoncée est 15h00
- **Quand** mon heure passe à 15h15
- **Alors** ma page de suivi affiche le bandeau avec la nouvelle heure et la raison
- **Et** la notification « Changement d'heure » ne part pas (`skipped`, motif `no_consent`)
- **Et** la dernière heure annoncée reste 15h00, puisqu'aucune notification n'est réellement partie (`last_notified_start_at`, K19)
- **Quand** mon heure revient ensuite à 15h05
- **Alors** l'écart avec 15h00 est de moins de 10 min et le bandeau de changement n'est plus affiché

### 10. Heure de dernière mise à jour toujours visible

- **Étant donné** que ma page de suivi est affichée
- **Quand** l'heure de passage change, quelle que soit la variation
- **Alors** l'heure de la dernière mise à jour est affichée et actualisée

## Textes à prévoir

| Clé (anglais)                           | Texte (français)                                                                                 | Contrainte                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `client.ticket.change_banner.estimate`  | Nouvelle heure de passage : vers {time}. {reason}                                                | Variables `time`, `reason`                                                                     |
| `client.ticket.change_banner.postponed` | Votre place a reculé : {position, plural, one {# client} other {# clients}} avant vous. {reason} | Variables `position`, `reason`                                                                 |
| `common.change_reason.<code>`           | Voir `common.change_reason.*` dans le dictionnaire (17 textes)                                   | Une clé par raison                                                                             |
| `notifications.estimate_changed.push`   | Voir `notifications.estimate_changed.push.*` dans le dictionnaire (2 textes)                     | Push seulement ; nouvelle heure et raison ; message d'anticipation (consentement, E17)         |
| `notifications.postponed.push`          | Voir `notifications.postponed.push.*` dans le dictionnaire (2 textes)                            | Partagé avec U-07 ; push seulement ; nouvelle position et raison ; message indispensable (E17) |

## Questions ouvertes

- **Résolu le 18/10** (E11) — Référence du seuil de 10 min : la dernière heure annoncée au client (`tickets.last_notified_start_at`), écarts cumulés ; voir scénarios 1 à 4 bis.
- **Résolu le 19/10** (K19) — Sans consentement, `last_notified_start_at` n'est mis à jour que quand une notification part réellement ; la référence reste la dernière heure vraiment annoncée ; voir scénario 9 bis.
- **Résolu le 19/10** (K26) — Liste des raisons : enum `estimate_change_reason` (17 codes, y compris pour une heure qui avance), textes uniques `common.change_reason.<code>` ; voir scénarios 1, 2, 5 et 6.
- **Résolu le 18/10** (PRD v1.1 §5.3) — Priorité : U-10 passe en I.
- **APP_FLOW F-C5** : combien de temps le bandeau de changement reste-t-il affiché : jusqu'à fermeture par le client, jusqu'au changement suivant ?
- **Résolu le 19/10** (dictionnaire `client.json`, `common.json`, `notifications.json`) — Bandeaux, raisons et notifications rédigés.
- **Rattachée à E36** (client appelé repris en tête, en attente d'Ely) : quelle raison afficher aux clients qui reculent d'une place quand un client appelé est repris en tête de file ? Aucun code de `estimate_change_reason` ne vise ce cas (`stylist_unavailable` est le plus proche).
