# C-03 · Voir ma file

**En tant que** coiffeur, **je veux** voir sur mon téléphone mes prochains clients, avec le prochain en haut, **afin de** savoir qui je prends ensuite sans interrompre ma prestation.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1, H5 (aucune réorganisation libre), H6, H8 ; PRD §5.2 « Distribution » règles 3 et 4 ; PRD §5.1 « Aucune donnée client n'est stockée sur le téléphone du coiffeur » et isolation par salon ; PRD §6 (perte de connexion, repli 10 s)
- Parcours : F-S4 (APP_FLOW §4) ; événements « Ticket créé » et « Votre tour approche » (APP_FLOW §7)
- Commandes et données : RPC `get_stylist_queue` · tables `tickets`, `services`, `member_specialties`, `stylist_presence` · canal `salon:{salon_id}` (`queue_updated`)

## Scénarios

### 1. Prochain client qui me demande
- **Étant donné** Inès, coiffeuse « Disponible »
- **Et** le premier ticket éligible pour elle est celui de Léa, qui a demandé Inès, pour une prestation de 30 min, et qui a répondu « Je serai à l'heure » à T-30
- **Quand** Inès ouvre « Ma file » (`/stylist/queue`)
- **Alors** la carte « Prochain client » en haut de l'écran affiche le prénom Léa, la prestation et la durée de 30 min
- **Et** la carte affiche le statut d'approche et la réponse T-30 de Léa
- **Et** la carte porte la mention « vous a demandé »
- **Et** le bouton « Appeler » de la barre du bas est actif

### 2. Tickets non éligibles sautés sans perdre leur rang
- **Étant donné** Inès « Disponible », qui maîtrise la spécialité `men_cut` et pas `color`
- **Et** la file du salon contient, dans l'ordre d'inscription : le ticket 1 qui demande un autre coiffeur, le ticket 2 sans préférence pour une prestation qui requiert `color`, le ticket 3 sans préférence pour une prestation qui requiert `men_cut`
- **Quand** Inès ouvre « Ma file »
- **Alors** la carte « Prochain client » affiche le ticket 3
- **Et** le ticket 1 n'apparaît nulle part dans l'espace d'Inès
- **Et** le ticket 2 n'apparaît nulle part dans l'espace d'Inès
- **Et** sur le dashboard, les tickets 1 et 2 gardent leur rang dans la file du salon

### 3. Client qui a déclaré une heure d'arrivée plus tardive (H8)
- **Étant donné** il est 14h40
- **Et** le ticket 1, sans préférence et éligible pour Inès, a déclaré « J'arrive vers 15h00 » et n'est pas arrivé
- **Et** le ticket 2, inscrit après, est éligible pour Inès
- **Quand** Inès ouvre « Ma file »
- **Alors** la carte « Prochain client » affiche le ticket 2

### 4. Réponse T-30 affichée en temps réel
- **Étant donné** Inès qui regarde « Ma file », où figure Léa
- **Quand** Léa répond « En retard de 15 min » à « votre tour approche »
- **Alors** en moins de 2 s, la carte ou la ligne de Léa indique un retard déclaré de 15 min

### 5. Nouveau ticket
- **Étant donné** Inès qui regarde « Ma file »
- **Quand** un client rejoint la file en demandant Inès
- **Alors** en moins de 2 s, ce client apparaît dans la liste « Ensuite » d'Inès

### 6. Liste « Ensuite » en lecture seule
- **Étant donné** Inès avec plusieurs clients dans sa liste « Ensuite »
- **Quand** elle tente de déplacer un client dans la liste (glisser-déposer) ou de toucher une ligne pour l'appeler
- **Alors** l'ordre de la liste ne change pas
- **Et** aucun client n'est appelé depuis la liste

### 7. Aucun client
- **Étant donné** Inès « Disponible » et aucun ticket éligible pour elle
- **Quand** elle ouvre « Ma file »
- **Alors** l'écran affiche « Aucun client pour l'instant »
- **Et** le bouton « Appeler » est désactivé

### 8. Appeler désactivé hors disponibilité
- **Étant donné** Inès « En pause », « Fin de journée » ou « Hors ligne », avec des tickets éligibles
- **Quand** elle ouvre « Ma file »
- **Alors** le bouton « Appeler » est désactivé

### 9. Connexion perdue
- **Étant donné** Inès qui regarde « Ma file »
- **Quand** son téléphone perd la connexion au serveur
- **Alors** un bandeau rouge « Connexion perdue » s'affiche
- **Et** toutes les actions de l'espace coiffeur sont désactivées
- **Et** la reconnexion est tentée automatiquement

### 10. Retour de la connexion
- **Étant donné** Inès dont l'écran affiche « Connexion perdue »
- **Quand** la connexion revient
- **Alors** le bandeau rouge disparaît
- **Et** la file affichée est relue et à jour
- **Et** les actions redeviennent disponibles

### 11. Repli sans temps réel
- **Étant donné** Inès connectée, mais sans canal temps réel actif
- **Quand** la file change côté serveur
- **Alors** « Ma file » est mise à jour dans les 10 s

### 12. Jamais de numéro de téléphone
- **Étant donné** Inès qui regarde « Ma file » avec des clients inscrits par l'app, par le QR de l'affiche et à l'accueil
- **Quand** l'écran s'affiche
- **Alors** aucun numéro de téléphone n'apparaît à l'écran
- **Et** la réponse de `get_stylist_queue` ne contient ni numéro de téléphone ni `tracking_token`
- **Et** chaque client est désigné par son seul prénom

### 13. Rien du client conservé sur le téléphone
- **Étant donné** Inès qui a consulté « Ma file »
- **Quand** elle ferme Zelaté Pro, coupe le réseau et la rouvre
- **Alors** aucun prénom ni aucune donnée de ticket ne s'affiche
- **Et** le stockage local du navigateur (`localStorage`, IndexedDB, cache du service worker) ne contient aucune donnée client

### 14. Isolation entre salons
- **Étant donné** Inès, coiffeuse du salon A, et des tickets actifs au salon B
- **Quand** elle ouvre « Ma file »
- **Alors** aucun ticket du salon B n'apparaît
- **Et** elle ne peut pas s'abonner au canal `salon:{salon_id}` du salon B

### 15. Accès retiré pendant la consultation
- **Étant donné** Inès qui regarde « Ma file »
- **Quand** le gérant la désactive ou coupe ses sessions
- **Alors** la file n'est plus affichée sur son téléphone
- **Et** `get_stylist_queue` ne lui renvoie plus aucun ticket

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.queue.title` | « Ma file » | Titre de page (APP_FLOW §2.2) |
| `pro-stylist.queue.next_client` | « Prochain client » | Libellé indicatif (APP_FLOW F-S4) |
| `pro-stylist.queue.requested_you` | « vous a demandé » | APP_FLOW F-S4 |
| `pro-stylist.queue.up_next` | « Ensuite » | APP_FLOW F-S4 |
| `pro-stylist.queue.empty` | « Aucun client pour l'instant » | État vide (APP_FLOW F-S4) |
| `pro-stylist.queue.call` | « Appeler » | Bouton `xl` de la barre du bas (voir C-04) |
| `pro-stylist.connection.lost` | « Connexion perdue » | Bandeau rouge, bloque les actions |
| `common.approach_status.arrived` | « arrivé » | Valeurs à arbitrer (voir questions) |
| `common.approach_status.late` | « en retard de {minutes} min » | Valeurs à arbitrer |
| `common.approach_status.confirmed` | « confirmé » | BACKEND_SCHEMA §4.13 seulement |
| `common.approach_status.no_response` | « sans réponse » | BACKEND_SCHEMA §4.13 seulement |
| `common.approach_status.not_left` | « pas parti » | APP_FLOW F-S4 seulement |
| `common.approach_status.on_the_way` | « en route » | APP_FLOW F-S4 seulement |

## Questions ouvertes
- [APP_FLOW / BACKEND_SCHEMA] Les valeurs du statut d'approche diffèrent : APP_FLOW F-S4 « pas parti, en route, arrivé, en retard de X min » ; BACKEND_SCHEMA §4.13 « arrivé, en retard de X min, confirmé, sans réponse », calculées depuis `arrived_at`, `eta_response`, `declared_delay_minutes`. « Pas parti » et « en route » ne se calculent pas sans GPS (H7). Quelle liste retenir ?
- [APP_FLOW / PRD / TRD] Contenu de la liste « Ensuite » : APP_FLOW §7 dit qu'un nouveau ticket apparaît chez le coiffeur « demandé ou pressenti » (`estimated_member_id`) ; PRD C-03 et ADR-015 parlent de tous les tickets « sans préférence » éligibles (un même ticket apparaîtrait chez plusieurs coiffeurs). Laquelle ?
- [APP_FLOW] Nombre de clients affichés dans « Ensuite », et affiche-t-on l'heure estimée de chacun ?
- [PRD] H8 : le client « reprend la tête de file dès son arrivée ». L'arrivée est-elle l'heure déclarée atteinte, ou l'arrivée validée par le code du ticket (C-05) ?
- [PRD] Ticket « je ne sais pas encore » (`service_id` vide, aucune spécialité requise) : est-il éligible pour tous les coiffeurs ?
- [APP_FLOW] Un coiffeur « Hors ligne » ou « Fin de journée » voit-il encore sa liste « Ensuite » ?
