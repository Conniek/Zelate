# S-02 · Interrupteur « Je coiffe »

**En tant que** gérant, **je veux** indiquer si je coiffe et changer ce choix à tout moment depuis le dashboard, **afin de** recevoir des clients comme un coiffeur quand je travaille au fauteuil, ou de ne plus en recevoir automatiquement quand je gère le salon, tout en pouvant prendre le prochain client si besoin.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1 ; PRD §5.2 Distribution, règle 5 ; PRD §3 « Rôles combinés » ; PRD §11 n° 12 ; toute variation d'heure de 10 min ou plus est expliquée (PRD §5.1) ; H4 (compteur de 10 min après l'appel)
- Parcours : F-M1 étape 3, F-M6 (interrupteur et « Je prends le prochain »), « Gérant qui coiffe » (APP_FLOW §4), F-S5
- Commandes et données : `set_hairdressing` · `call_ticket` · tables `salon_members` (`is_hairdressing`), `tickets` (`estimated_member_id`, `assigned_member_id`, `estimated_start_at`, `called_at`), `salon_events` (`hairdressing_toggled`), `notifications` (`estimate_changed`, `your_turn`)

## Scénarios

### 1. Choix à l'inscription
- **Étant donné** le gérant à l'étape 3 de l'inscription (F-M1)
- **Quand** il active l'interrupteur « Je coiffe aussi » puis passe à l'étape suivante
- **Alors** `is_hairdressing` vaut vrai pour son compte de membre

### 2. Activer « Je coiffe » depuis le dashboard
- **Étant donné** un gérant dont « Je coiffe » est coupé, sur `/dashboard`
- **Quand** il active l'interrupteur « Je coiffe » dans l'en-tête
- **Alors** la commande `set_hairdressing` (`is_hairdressing` = vrai) est envoyée
- **Alors** le gérant entre dans la distribution comme un coiffeur ordinaire
- **Alors** les heures de passage des tickets en attente sont recalculées
- **Alors** le bouton « Je prends le prochain » disparaît
- **Alors** l'événement `hairdressing_toggled` est inscrit au journal du salon

### 3. Couper « Je coiffe » depuis le dashboard
- **Étant donné** un gérant dont « Je coiffe » est activé
- **Quand** il coupe l'interrupteur
- **Alors** la commande `set_hairdressing` (`is_hairdressing` = faux) est envoyée
- **Alors** aucun nouveau client ne lui est plus attribué automatiquement
- **Alors** il n'est plus retenu comme coiffeur pressenti dans le calcul des heures
- **Alors** les heures de passage des tickets en attente sont recalculées
- **Alors** le bouton « Je prends le prochain » apparaît
- **Alors** l'événement `hairdressing_toggled` est inscrit au journal du salon

### 4. Clients prévenus quand leur heure bouge de 10 min ou plus
- **Étant donné** un client en attente dont l'heure de passage change de 10 min ou plus après le changement de l'interrupteur
- **Quand** le recalcul est terminé
- **Alors** le client reçoit une notification push « changement d'heure » avec la nouvelle heure et la raison
- **Alors** aucun SMS n'est envoyé pour ce changement (PRD §5.4)

### 5. Variation de moins de 10 min : pas de notification
- **Étant donné** un client en attente dont l'heure de passage change de moins de 10 min après le changement de l'interrupteur
- **Quand** le recalcul est terminé
- **Alors** aucune notification ne lui est envoyée
- **Alors** sa page de suivi affiche la nouvelle heure

### 6. « Je prends le prochain » avec « Je coiffe » coupé
- **Étant donné** un gérant dont « Je coiffe » est coupé et au moins un ticket éligible en attente
- **Quand** il clique sur « Je prends le prochain »
- **Alors** la commande `call_ticket` est envoyée en son nom
- **Alors** le premier ticket éligible de la file passe au statut « appelé », attribué au gérant
- **Alors** le client reçoit « votre tour » par push et par SMS
- **Alors** le compteur de 10 min démarre, visible par le client
- **Alors** le dashboard affiche l'appel en cours, comme la carte « Appel en cours » de l'espace coiffeur (F-S5)

### 7. « Je prends le prochain » sans ticket éligible
- **Étant donné** un gérant dont « Je coiffe » est coupé et aucun ticket éligible
- **Quand** il clique sur « Je prends le prochain »
- **Alors** le message de l'erreur `queue.no_eligible_ticket` s'affiche
- **Alors** aucun ticket ne change de statut

### 8. Deux appels simultanés sur le même ticket
- **Étant donné** un seul ticket éligible
- **Quand** le gérant clique sur « Je prends le prochain » au même moment qu'un coiffeur clique sur « Appeler »
- **Alors** un seul des deux appels réussit
- **Alors** l'autre reçoit le message de l'erreur `queue.invalid_transition` (TRD §14)

### 9. Second appel alors qu'un appel du gérant est déjà en cours
- **Étant donné** un gérant qui a déjà un client appelé ou en prestation
- **Quand** il demande un nouvel appel
- **Alors** l'appel est refusé (APP_FLOW F-S4 : « refuse un second appel en cours »)
- **Alors** aucun autre ticket ne change de statut

### 10. Double clic sur l'interrupteur ou sur « Je prends le prochain »
- **Étant donné** le gérant sur le dashboard
- **Quand** il clique deux fois rapidement sur « Je prends le prochain »
- **Alors** un seul ticket est appelé

### 11. Dashboard hors ligne
- **Étant donné** un dashboard qui a perdu la connexion
- **Quand** le gérant regarde l'en-tête
- **Alors** l'interrupteur « Je coiffe » et « Je prends le prochain » sont désactivés

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.signup.hairdressing.label` | « Je coiffe aussi » | Partagée avec S-01 ; libellé indicatif (APP_FLOW F-M1) |
| `pro-manager.board.hairdressing.label` | « Je coiffe » | Libellé indicatif (APP_FLOW F-M6) |
| `pro-manager.board.takeNext` | « Je prends le prochain » | Libellé indicatif (APP_FLOW F-M6) |
| `notifications.estimate_changed.push` | — (à rédiger) | Push seulement ; nouvelle heure et raison (APP_FLOW §7) |
| `notifications.estimate_changed.reason.hairdressingToggled` | — (à rédiger) | Raison montrée au client, sans détail sur le gérant |
| `errors.queue.no_eligible_ticket` | — (à rédiger) | — |
| `errors.queue.invalid_transition` | — (à rédiger) | — |

## Questions ouvertes
- **PRD** : que deviennent les tickets qui demandaient le gérant quand il coupe « Je coiffe » ? Le client doit-il choisir « attendre » ou « premier disponible » (transition 8), ou se passe-t-il autre chose ? Les clients peuvent-ils encore demander le gérant pendant que l'interrupteur est coupé (`public_stylists` = membres « qui coiffent aujourd'hui ») ?
- **PRD / APP_FLOW** : que se passe-t-il si le gérant coupe « Je coiffe » pendant qu'il a un client appelé ou en prestation ?
- **APP_FLOW / BACKEND_SCHEMA** : F-M1 ne demande pas ses spécialités au gérant. Or l'éligibilité dépend de la maîtrise de la prestation (H1, règle 4). Où le gérant déclare-t-il ses spécialités ? Quels tickets sont éligibles pour « Je prends le prochain » ?
- **PRD / BACKEND_SCHEMA** : le gérant doit-il avoir un statut de présence « disponible » (`stylist_presence`) pour recevoir des clients ou pour utiliser « Je prends le prochain » ? Comment cela se combine-t-il avec `is_hairdressing` ?
- **TRD** : quel code d'erreur renvoie un second `call_ticket` quand le même membre a déjà un appel en cours ? TRD §6.2 ne dit pas quels codes chaque commande peut renvoyer.
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
