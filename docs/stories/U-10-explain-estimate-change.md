# U-10 · Savoir pourquoi mon heure de passage change

**En tant que** client inscrit dans une file, **je veux** savoir pourquoi mon heure de passage ou ma position change, **afin de** faire confiance à l'heure annoncée et de m'organiser.

- Priorité : I (PRD §5.3, v1.1)
- Règles appliquées : H5 (recul avec motif affiché et journal d'audit) (PRD §5.1) ; toute variation d'heure de 10 min ou plus et tout recul sont expliqués au client ; l'écart se mesure par rapport à la dernière heure annoncée au client et les petits écarts s'additionnent (E11) ; un retard déclaré ne fait reculer que par « Prendre le suivant » (E2) ; sans la case « Me prévenir », seuls l'inscription et « votre tour » partent (K11) (PRD §5.1 « Autres règles ») ; statut « En pause » : clients notifiés si leur heure bouge de 10 min ou plus ; fin de journée : « si son heure redevient sûre, il est simplement notifié du changement d'heure » (PRD §5.2) ; notifications « Changement d'heure » et « Recul », push sans SMS (PRD §5.4) ; principe de transparence (PRD §7.1)
- Parcours : F-C5 (bandeau « Message de changement ») et F-C10 (APP_FLOW §3) ; événements « Changement d'heure » et « Recul » (APP_FLOW §7)
- Commandes et données : déclenché par `adjust_duration`, `set_presence`, `cancel_ticket`, `complete_service`, `respond_eta`, `take_next`, `reassign_ticket`, `update_appointment` et par le recalcul de `queue-tick` · tables `tickets` (`estimated_start_at`, `last_notified_start_at`, `estimate_version`, `postpone_count`), `ticket_events` (`estimate_changed`, `postponed`), `notifications` (`estimate_changed`, `postponed`, `dedupe_key`)

## Scénarios

### 1. Heure reculée de 10 min ou plus
- **Étant donné** que j'ai coché « Me prévenir » et que la dernière heure de passage qui m'a été annoncée est 15h00 (`last_notified_start_at`)
- **Quand** le coiffeur pressenti ajoute +15 min à sa prestation en cours et que mon heure passe à 15h15
- **Alors** ma page de suivi affiche un bandeau avec la nouvelle heure et la raison du changement
- **Et** je reçois une notification push « Changement d'heure » avec la nouvelle heure et la raison
- **Et** aucun SMS n'est envoyé pour ce changement
- **Et** un événement `estimate_changed` est ajouté au journal du ticket
- **Et** 15h15 devient la dernière heure annoncée (`last_notified_start_at`)

### 2. Heure avancée de 10 min ou plus
- **Étant donné** que j'ai coché « Me prévenir » et que la dernière heure annoncée est 15h00
- **Quand** un client placé avant moi annule et que mon heure passe à 14h45
- **Alors** ma page de suivi affiche un bandeau avec la nouvelle heure et la raison
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
- **Alors** je reçois la notification « Changement d'heure » avec la raison
- **Et** le bandeau de changement s'affiche sur ma page de suivi

### 6. Recul de position
- **Étant donné** que j'ai déclaré un retard et que le coiffeur m'a appelé
- **Quand** le coiffeur choisit « Prendre le suivant » (`take_next`, seule cause de recul, E2) et que mon ticket recule
- **Alors** ma page de suivi affiche un bandeau avec ma nouvelle position et la raison
- **Et** je reçois une notification push « Recul » avec ma nouvelle position et la raison, sans SMS
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

### 9 bis. Sans la case « Me prévenir » (K11)
- **Étant donné** que je n'ai pas coché « Me prévenir » et que la dernière heure annoncée est 15h00
- **Quand** mon heure passe à 15h15
- **Alors** ma page de suivi affiche le bandeau avec la nouvelle heure et la raison
- **Et** la notification « Changement d'heure » ne part pas (`skipped`, motif `no_consent`)

### 10. Heure de dernière mise à jour toujours visible
- **Étant donné** que ma page de suivi est affichée
- **Quand** l'heure de passage change, quelle que soit la variation
- **Alors** l'heure de la dernière mise à jour est affichée et actualisée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.ticket.change_banner.estimate` | _À rédiger (absent des docs)_ | Variables `time`, `reason` |
| `client.ticket.change_banner.postponed` | _À rédiger (absent des docs)_ | Variables `position`, `reason` |
| `client.ticket.change_reason.<code>` | _À rédiger (liste des raisons absente des docs)_ | Une clé par raison |
| `notifications.estimate_changed.push` | _À rédiger (absent des docs)_ | Push seulement ; nouvelle heure et raison |
| `notifications.postponed.push` | _À rédiger (absent des docs)_ | Partagé avec U-07 ; push seulement ; nouvelle position et raison |

## Questions ouvertes
- **Résolu le 18/10** (E11) — Référence du seuil de 10 min : la dernière heure annoncée au client (`tickets.last_notified_start_at`), écarts cumulés ; voir scénarios 1 à 4 bis.
- **PRD §5.1 / BACKEND_SCHEMA §4.13** : sans consentement, aucune notification « Changement d'heure » ne part. `last_notified_start_at` est-il quand même mis à jour quand le seuil est atteint (la référence du bandeau change), ou reste-t-il l'heure annoncée à l'inscription ?
- **PRD §5.1 / APP_FLOW F-C5** : la liste des raisons affichables n'existe nulle part (pause du coiffeur, durée ajustée, coiffeur en retard ou absent, client précédent en retard, annulation, fin de journée…). Il faut une liste de codes de raison et leurs textes, y compris pour une heure qui avance.
- **Résolu le 18/10** (PRD v1.1 §5.3) — Priorité : U-10 passe en I.
- **APP_FLOW F-C5** : combien de temps le bandeau de changement reste-t-il affiché : jusqu'à fermeture par le client, jusqu'au changement suivant ?
- **Textes** : bandeaux, raisons et notifications ne figurent dans aucun document.
