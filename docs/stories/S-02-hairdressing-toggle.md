# S-02 · Interrupteur « Je coiffe »

**En tant que** gérant, **je veux** indiquer si je coiffe et changer ce choix à tout moment depuis le dashboard, **afin de** recevoir des clients comme un coiffeur quand je travaille au fauteuil, ou de ne plus en recevoir automatiquement quand je gère le salon, tout en pouvant prendre le prochain client si besoin.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1 ; PRD §5.2 Distribution, règle 5 ; PRD §3 « Rôles combinés » ; PRD §11 n° 12 ; « Je coiffe » coupé : même règle qu'un coiffeur absent pour les clients qui le demandaient (PRD §5.1, §5.2 transition 8, §11 E8) ; toute variation d'heure de 10 min ou plus par rapport à la dernière heure annoncée, écarts cumulés, est expliquée (PRD §5.1, E11) ; H4 (compteur de 10 min après l'appel) ; file en pause : les inscrits continuent d'être appelés (PRD §5.1, E4)
- Parcours : F-M1 étape 3, F-M6 (interrupteur et « Je prends le prochain »), « Gérant qui coiffe » (APP_FLOW §4), F-S5 ; côté client F-C5 bandeau « Votre coiffeur n'est plus disponible » (story U-12)
- Commandes et données : `set_hairdressing` · `call_ticket` · `resolve_stylist_change` (réponse du client) · tables `salon_members` (`is_hairdressing`), `tickets` (`requested_member_id`, `estimated_member_id`, `assigned_member_id`, `estimated_start_at`, `last_notified_start_at`, `stylist_change_pending_since`, `called_at`), `salon_events` (`hairdressing_toggled`), `ticket_events` (`stylist_change_requested`), `notifications` (`estimate_changed`, `stylist_change_required`, `your_turn`)

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

### 3 bis. Clients qui demandaient le gérant quand il coupe « Je coiffe »
- **Étant donné** des clients en attente qui ont demandé le gérant (`requested_member_id`)
- **Quand** le gérant coupe « Je coiffe »
- **Alors** chacun de ces clients qui a coché « Me prévenir » reçoit une notification lui demandant de choisir (E8, même règle qu'un coiffeur absent toute la journée ; sans la case, la notification est marquée `skipped`, K11)
- **Alors** sa page de suivi ne lui propose que « Premier disponible » ou « Annuler ma place », sans « Attendre » (APP_FLOW F-C5, E7)
- **Alors** ces tickets sont marqués « en attente de réponse » sur le dashboard

### 3 ter. Pas de réponse en 10 min après la coupure
- **Étant donné** un client qui demandait le gérant et qui doit choisir depuis la coupure de « Je coiffe »
- **Quand** 10 min passent sans réponse (tolérance des tests ±60 s, TRD §10.1, K7)
- **Alors** son ticket passe en « premier disponible » (PRD §5.2 transition 8)

### 4. Clients prévenus quand leur heure bouge de 10 min ou plus
- **Étant donné** un client en attente dont l'heure de passage s'écarte de 10 min ou plus de la dernière heure qui lui a été annoncée (`last_notified_start_at`) après le changement de l'interrupteur
- **Quand** le recalcul est terminé
- **Alors** le client reçoit une notification push « changement d'heure » avec la nouvelle heure et la raison
- **Alors** aucun SMS n'est envoyé pour ce changement (PRD §5.4)

### 5. Variation de moins de 10 min : pas de notification
- **Étant donné** un client en attente dont l'heure de passage s'écarte de moins de 10 min de la dernière heure annoncée, écarts précédents compris (E11)
- **Quand** le recalcul est terminé
- **Alors** aucune notification ne lui est envoyée
- **Alors** sa page de suivi affiche la nouvelle heure

### 6. « Je prends le prochain » avec « Je coiffe » coupé
- **Étant donné** un gérant dont « Je coiffe » est coupé et au moins un ticket éligible en attente
- **Quand** il clique sur « Je prends le prochain »
- **Alors** la commande `call_ticket` est envoyée en son nom
- **Alors** le premier ticket éligible de la file passe au statut « appelé », attribué au gérant (PRD §5.2 règles 4 et 6 à 8)
- **Alors** le client reçoit « votre tour » par push et par SMS, même si le plafond de 3 SMS est atteint (E1)
- **Alors** le compteur de 10 min démarre, visible par le client
- **Alors** le dashboard affiche l'appel en cours, comme la carte « Appel en cours » de l'espace coiffeur (F-S5)

### 6 bis. « Je prends le prochain » avec la file en pause
- **Étant donné** une file en pause, un gérant dont « Je coiffe » est coupé et au moins un ticket éligible en attente
- **Quand** il clique sur « Je prends le prochain »
- **Alors** le premier ticket éligible passe au statut « appelé » (PRD §5.1, E4 ; TRD §6.2 `call_ticket`)

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
- **Alors** le message de l'erreur `queue.call_already_in_progress` s'affiche (TRD §6.2)
- **Alors** aucun autre ticket ne change de statut

### 9 bis. Un coiffeur ne peut pas changer l'interrupteur
- **Étant donné** un coiffeur connecté du salon
- **Quand** une commande `set_hairdressing` est envoyée depuis son compte
- **Alors** la commande est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)
- **Alors** `is_hairdressing` ne change pas

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
| `pro-manager.board.take_next` | « Je prends le prochain » | Libellé indicatif (APP_FLOW F-M6) |
| `notifications.estimate_changed.push` | Voir `notifications.estimate_changed.push.*` dans le dictionnaire (2 textes) | Push seulement ; nouvelle heure et raison (APP_FLOW §7) |
| `common.change_reason.hairdressing_toggled` | « Le nombre de coiffeurs disponibles a changé. » | Raison montrée au client, sans détail sur le gérant |
| `notifications.stylist_change_required.push` | Voir `notifications.stylist_change_required.push.*` dans le dictionnaire (2 textes) | Partagée avec S-11 et S-16 ; ici sans « attendre » (E7, E8) |
| `errors.queue.no_eligible_ticket` | « Aucun client à appeler pour l'instant. Il a peut-être été pris par un collègue : vérifiez votre file. » | — |
| `errors.queue.call_already_in_progress` | « Vous avez déjà un client appelé ou en prestation. Finissez avec lui avant d'appeler le suivant. » | TRD §6.2 |
| `errors.queue.invalid_transition` | « Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. » | — |
| `errors.queue.forbidden` | « Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. » | Code commun (TRD §6.2) |

## Questions ouvertes
- **Résolu le 18/10** (E8, PRD §5.1) : quand le gérant coupe « Je coiffe », ceux qui le demandaient suivent la règle d'un coiffeur absent : « premier disponible » ou annuler, sans « attendre » ; sans réponse en 10 min, premier disponible.
- **Résolu le 18/10** (K1, TRD §6.2) : un second appel du même membre renvoie `queue.call_already_in_progress`.
- **PRD / BACKEND_SCHEMA** : les clients peuvent-ils encore demander le gérant pendant que l'interrupteur est coupé (`public_stylists` = membres « qui coiffent aujourd'hui ») ? Sa réactivation rend-elle le choix « attendre » à ceux qui n'ont pas encore répondu ?
- **PRD / TRD** : PRD §5.1 dit « la même règle s'applique quand le gérant coupe « Je coiffe » » juste après la règle du client appelé (repris en tête) et du client en prestation (terminé par le gérant). TRD §6.2 `set_hairdressing` ne parle que de « ses clients ». Si le gérant coupe l'interrupteur pendant qu'il a un client appelé ou en prestation, ce client appelé est-il repris en tête par le premier coiffeur libre, ou reste-t-il attribué au gérant ?
- **APP_FLOW / BACKEND_SCHEMA** : F-M1 ne demande pas ses spécialités au gérant. Or l'éligibilité dépend de la maîtrise de la prestation (H1, règle 4). Où le gérant déclare-t-il ses spécialités ? Quels tickets sont éligibles pour « Je prends le prochain » ?
- **PRD / BACKEND_SCHEMA** : BACKEND_SCHEMA §4.4 dit qu'un membre reçoit des clients s'il est actif, `is_hairdressing = true` et présent, et que le gérant qui a coupé « Je coiffe » peut quand même prendre le prochain client. Pour « Je prends le prochain », faut-il aussi que le gérant ait un statut de présence « disponible » (`stylist_presence`, condition de la transition 2) ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
