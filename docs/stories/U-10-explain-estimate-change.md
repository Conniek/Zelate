# U-10 · Savoir pourquoi mon heure de passage change

**En tant que** client inscrit dans une file, **je veux** savoir pourquoi mon heure de passage ou ma position change, **afin de** faire confiance à l'heure annoncée et de m'organiser.

- Priorité : S (PRD §5.3)
- Règles appliquées : H5 (recul avec motif affiché et journal d'audit) (PRD §5.1) ; toute variation d'heure de 10 min ou plus et tout recul sont expliqués au client (PRD §5.1 « Autres règles ») ; statut « En pause » : clients notifiés si leur heure bouge de 10 min ou plus ; fin de journée : « si son heure redevient sûre, il est simplement notifié du changement d'heure » (PRD §5.2) ; notifications « Changement d'heure » et « Recul », push sans SMS (PRD §5.4) ; principe de transparence (PRD §7.1)
- Parcours : F-C5 (bandeau « Message de changement ») et F-C10 (APP_FLOW §3) ; événements « Changement d'heure » et « Recul » (APP_FLOW §7)
- Commandes et données : déclenché par `adjust_duration`, `set_presence`, `cancel_ticket`, `complete_service`, `respond_eta`, `take_next` et par le recalcul de `queue-tick` · tables `tickets` (`estimated_start_at`, `estimate_version`, `postpone_count`), `ticket_events` (`estimate_changed`, `postponed`), `notifications` (`estimate_changed`, `postponed`, `dedupe_key`)

## Scénarios

### 1. Heure reculée de 10 min ou plus
- **Étant donné** que mon heure de passage est 15h00
- **Quand** le coiffeur pressenti ajoute +15 min à sa prestation en cours et que mon heure passe à 15h15
- **Alors** ma page de suivi affiche un bandeau avec la nouvelle heure et la raison du changement
- **Et** je reçois une notification push « Changement d'heure » avec la nouvelle heure et la raison
- **Et** aucun SMS n'est envoyé pour ce changement
- **Et** un événement `estimate_changed` est ajouté au journal du ticket

### 2. Heure avancée de 10 min ou plus
- **Étant donné** que mon heure de passage est 15h00
- **Quand** un client placé avant moi annule et que mon heure passe à 14h45
- **Alors** ma page de suivi affiche un bandeau avec la nouvelle heure et la raison
- **Et** je reçois une notification push « Changement d'heure »

### 3. Variation de moins de 10 min
- **Étant donné** que mon heure de passage est 15h00
- **Quand** elle passe à 15h05 après un ajustement de +5 min
- **Alors** la nouvelle heure s'affiche avec l'heure de dernière mise à jour
- **Et** aucun bandeau de changement n'est affiché
- **Et** aucune notification n'est envoyée

### 4. Limite exacte de 10 min
- **Étant donné** que mon heure de passage est 15h00
- **Quand** elle passe à 15h10
- **Alors** le bandeau et la notification « Changement d'heure » sont déclenchés
- **Quand** elle passe à 15h09 au lieu de 15h10
- **Alors** ni bandeau ni notification ne sont déclenchés

### 5. Pause du coiffeur
- **Étant donné** que le coiffeur pressenti pour mon ticket se met en pause pour 30 min
- **Quand** mon heure de passage recule de 10 min ou plus à cause de cette pause
- **Alors** je reçois la notification « Changement d'heure » avec la raison
- **Et** le bandeau de changement s'affiche sur ma page de suivi

### 6. Recul de position
- **Étant donné** que mon ticket recule dans la file sur un retard que j'ai déclaré
- **Quand** le recul est appliqué
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
- **PRD §5.1 / PRD §5.4** : par rapport à quelle heure mesure-t-on les 10 min : la dernière heure notifiée, la dernière heure affichée, ou l'heure annoncée à l'inscription ? Plusieurs petites variations qui s'additionnent (3 fois 4 min) donnent-elles une notification ?
- **PRD §5.1 / APP_FLOW F-C5** : la liste des raisons affichables n'existe nulle part (pause du coiffeur, durée ajustée, coiffeur en retard ou absent, client précédent en retard, annulation, fin de journée…). Il faut une liste de codes de raison et leurs textes, y compris pour une heure qui avance.
- **PRD §5.3** : U-10 est classée « S », mais la règle « toute variation d'heure de 10 min ou plus et tout recul sont expliqués au client » est validée (PRD §5.1), et H5 impose un motif affiché. L'explication du recul, au moins, n'est-elle pas indispensable au MVP ?
- **APP_FLOW F-C5** : combien de temps le bandeau de changement reste-t-il affiché : jusqu'à fermeture par le client, jusqu'au changement suivant ?
- **Textes** : bandeaux, raisons et notifications ne figurent dans aucun document.
