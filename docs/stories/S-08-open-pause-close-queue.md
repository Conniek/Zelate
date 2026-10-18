# S-08 · Ouvrir, mettre en pause et fermer la file

**En tant que** gérant, **je veux** ouvrir, mettre en pause et fermer la file de mon salon en un clic, **afin de** maîtriser l'arrivée de nouveaux clients, avec un changement que les clients voient en moins de 2 s.

- Priorité : I (PRD §5.3)
- Règles appliquées : PRD §5.2 États de la file (Fermée, Ouverte, En pause, Complète) ; PRD §5.2 transition 1 (création seulement si la file est ouverte et non complète) ; propagation en moins de 2 s pour 95 % des événements, repli toutes les 30 s côté client et 10 s côté dashboard (PRD §6)
- Parcours : F-M5 ; F-M12 « Fermer la file maintenant » ; effets côté client F-C1 (filtre « Ouvert maintenant »), F-C2, F-C3 (erreurs)
- Commandes et données : `set_queue_status` · `join_queue` et `register_walk_in` (refus) · tables `salons` (`queue_status`), `salon_events` (`queue_opened`, `queue_paused`, `queue_closed`) · message temps réel `queue_status_changed`

## Scénarios

### 1. Ouvrir la file
- **Étant donné** un salon publié dont la file est fermée
- **Quand** le gérant clique sur « Ouvrir » dans le commutateur en haut du dashboard
- **Alors** la commande `set_queue_status` (`open`) est envoyée
- **Alors** le commutateur affiche l'état « Ouverte »
- **Alors** un client qui a la fiche du salon ouverte voit le bouton « Rejoindre la file » s'activer en moins de 2 s (95 % des cas)
- **Alors** l'événement `queue_opened` est inscrit au journal du salon

### 2. Mettre la file en pause
- **Étant donné** une file ouverte avec des clients en attente
- **Quand** le gérant clique sur « Pause »
- **Alors** la commande `set_queue_status` (`paused`) est envoyée
- **Alors** aucun nouveau ticket n'est accepté
- **Alors** les tickets déjà en attente restent dans la file
- **Alors** la fiche salon affiche le bouton désactivé « File en pause, réessayez dans quelques minutes »
- **Alors** le salon disparaît de la liste quand le filtre « Ouvert maintenant » est activé
- **Alors** l'événement `queue_paused` est inscrit au journal du salon

### 3. Reprendre après une pause
- **Étant donné** une file en pause avec des tickets en attente
- **Quand** le gérant clique sur « Ouvrir »
- **Alors** la file accepte de nouveau des tickets
- **Alors** les tickets en attente sont traités dans leur ordre (PRD §5.2 « En pause » : traités à la reprise)

### 4. Fermer la file
- **Étant donné** une file ouverte avec *n* clients en attente
- **Quand** le gérant clique sur « Fermer »
- **Alors** une confirmation s'affiche : « Les *n* clients en attente seront servis jusqu'à la fin de journée »
- **Quand** il confirme
- **Alors** la commande `set_queue_status` (`closed`) est envoyée
- **Alors** aucun nouveau ticket n'est accepté
- **Alors** la fiche salon affiche « Fermé » avec la prochaine ouverture
- **Alors** l'événement `queue_closed` est inscrit au journal du salon

### 5. Renoncer à la fermeture
- **Étant donné** la confirmation de fermeture affichée
- **Quand** le gérant la ferme sans confirmer
- **Alors** la file reste dans son état précédent

### 6. Rejoindre une file fermée ou en pause
- **Étant donné** une file fermée ou en pause
- **Quand** un client envoie `join_queue`, ou que le gérant envoie `register_walk_in`
- **Alors** la commande est refusée avec l'erreur `queue.queue_closed`
- **Alors** le client voit le message et le lien « Salons proches » (F-C3)

### 7. File complète (état automatique)
- **Étant donné** une file ouverte dont la prochaine prestation finirait après la fermeture
- **Quand** un client envoie `join_queue`
- **Alors** la commande est refusée avec l'erreur `queue.queue_full`
- **Alors** la fiche salon affiche le bouton désactivé « Complet pour aujourd'hui » et le lien « Salons proches »

### 8. Repli sans temps réel
- **Étant donné** un client dont la page n'est pas mise à jour en temps réel
- **Quand** le gérant change l'état de la file
- **Alors** la page du client affiche le nouvel état au plus tard au rafraîchissement suivant, toutes les 30 s
- **Alors** un autre écran du dashboard affiche le nouvel état au plus tard 10 s après

### 9. Dashboard hors ligne
- **Étant donné** un dashboard qui a perdu la connexion
- **Quand** le gérant regarde le commutateur
- **Alors** le commutateur est désactivé et un bandeau signale la perte de connexion

### 10. Double clic
- **Étant donné** une file fermée
- **Quand** le gérant clique deux fois rapidement sur « Ouvrir »
- **Alors** un seul événement `queue_opened` est inscrit au journal

### 11. Seul le gérant change l'état de la file
- **Étant donné** un coiffeur connecté du salon
- **Quand** une commande `set_queue_status` est envoyée depuis son compte
- **Alors** la commande est refusée
- **Alors** l'état de la file ne change pas

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.queueStatus.open` | « Ouvrir » | Libellé indicatif (APP_FLOW F-M5) |
| `pro-manager.queueStatus.pause` | « Pause » | Libellé indicatif (APP_FLOW F-M5) |
| `pro-manager.queueStatus.close` | « Fermer » | Libellé indicatif (APP_FLOW F-M5) |
| `pro-manager.queueStatus.closeConfirm` | « Les {count} clients en attente seront servis jusqu'à la fin de journée » | APP_FLOW F-M5 ; pluriel ICU (0, 1, plusieurs) |
| `common.queueStatus.closed` | « Fermée » | PRD §5.2 |
| `common.queueStatus.open` | « Ouverte » | PRD §5.2 |
| `common.queueStatus.paused` | « En pause » | PRD §5.2 |
| `common.queueStatus.full` | « Complète » | PRD §5.2 |
| `pro-manager.board.offlineBanner` | — (à rédiger) | Commun aux écrans du dashboard (APP_FLOW §8) |
| `errors.queue.queue_closed` | — (à rédiger) | — |
| `errors.queue.queue_full` | — (à rédiger) | — |

## Questions ouvertes
- **PRD / APP_FLOW (contradiction)** : selon PRD §5.2 (transition 6), §5.4 (« Annulation par le salon : retrait, fermeture, fin de journée ») et `cancel_reason` = `queue_closed`, la fermeture annule les tickets en attente. Selon APP_FLOW F-M5 et F-M12, les clients en attente « seront servis » et « restent ». Lequel est juste ?
- **PRD / APP_FLOW** : pendant une pause de la file, les coiffeurs peuvent-ils encore appeler les clients en attente ? Le PRD dit « traités à la reprise », APP_FLOW dit seulement « les inscrits restent ».
- **TRD** : quel code renvoie `join_queue` sur une file en pause ? Est-ce `queue_closed`, comme le suppose cette story, ou un autre code ?
- **PRD / APP_FLOW** : le PRD promet « en un clic », mais APP_FLOW F-M5 demande une confirmation pour « Fermer ». Faut-il accepter deux clics pour la fermeture ?
- **PRD / BACKEND_SCHEMA** : BACKEND_SCHEMA §10 dit que `queue-tick` ouvre et ferme la file « selon les horaires ». Le PRD et APP_FLOW ne décrivent qu'une action du gérant. La file s'ouvre-t-elle toute seule à l'heure d'ouverture ? Le gérant peut-il l'ouvrir hors des horaires ou pendant une fermeture exceptionnelle ?
- **PRD** : les clients déjà en attente sont-ils prévenus quand la file passe en pause ou se ferme ? PRD §5.4 n'en dit rien.
- **TRD** : quel code d'erreur reçoit un compte qui n'a pas le droit d'envoyer une commande (par exemple un coiffeur qui envoie `set_queue_status`) ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
