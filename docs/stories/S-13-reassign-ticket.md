# S-13 · Réaffecter un ticket à un autre coiffeur

**En tant que** gérant, **je veux** réaffecter un ticket à un autre coiffeur, seulement si l'heure du client ne recule pas (sinon avec son accord), **afin de** mieux répartir la charge sans jamais pénaliser un client à son insu.

- Priorité : S (PRD §5.3)
- Règles appliquées : changer le coiffeur d'un client ne le fait jamais reculer, sauf accord du client (PRD §5.1, §11 n° 8-11) ; H5 (aucune réorganisation libre) ; toute variation d'heure de 10 min ou plus est expliquée (PRD §5.1) ; H6
- Parcours : F-M10 ; F-M6 (clic sur un ticket)
- Commandes et données : `reassign_ticket` (`ticket_id`, `member_id`, `client_agreed`) · tables `tickets` (`requested_member_id`, `estimated_member_id`, `assigned_member_id`, `estimated_start_at`), `ticket_events` (`reassigned`, `before`, `after`), `notifications` (`estimate_changed`)

## Scénarios

### 1. Voir les coiffeurs et la nouvelle heure
- **Étant donné** un ticket en attente, et le gérant qui a ouvert son panneau détail
- **Quand** il clique sur « Changer de coiffeur »
- **Alors** la liste des coiffeurs s'affiche
- **Alors** chaque coiffeur est accompagné de la nouvelle heure de passage estimée du client

### 2. Réaffecter sans recul, variation de 10 min ou plus
- **Étant donné** la liste des coiffeurs affichée, avec Léa qui ferait passer le client 15 min plus tôt
- **Quand** le gérant choisit Léa
- **Alors** la commande `reassign_ticket` est envoyée sans accord du client
- **Alors** le ticket est rattaché à Léa
- **Alors** le client reçoit une notification push avec sa nouvelle heure et la raison
- **Alors** l'événement `reassigned` est inscrit au journal du ticket, avec le coiffeur d'avant et le coiffeur d'après

### 3. Réaffecter sans recul, variation de moins de 10 min
- **Étant donné** un coiffeur qui ferait passer le client moins de 10 min plus tôt, ou à la même heure
- **Quand** le gérant le choisit
- **Alors** le ticket est rattaché à ce coiffeur
- **Alors** aucune notification n'est envoyée au client

### 4. Choix qui ferait reculer l'heure du client
- **Étant donné** la liste des coiffeurs affichée, avec Sam qui ferait passer le client 20 min plus tard
- **Quand** le gérant choisit Sam
- **Alors** le message « L'heure du client reculerait de 20 min : demandez-lui son accord » s'affiche
- **Alors** une case « Le client est d'accord » s'affiche, décochée

### 5. Recul refusé sans accord
- **Étant donné** un choix qui ferait reculer l'heure du client
- **Quand** une commande `reassign_ticket` est envoyée sans `client_agreed`
- **Alors** le message de l'erreur `queue.would_delay_client` s'affiche
- **Alors** le ticket garde son coiffeur et son heure

### 6. Recul accepté avec l'accord du client
- **Étant donné** un choix qui ferait reculer l'heure du client de 20 min
- **Quand** le gérant coche « Le client est d'accord » et confirme
- **Alors** la commande `reassign_ticket` est envoyée avec `client_agreed`
- **Alors** le ticket est rattaché au nouveau coiffeur
- **Alors** le client reçoit une notification push avec sa nouvelle heure et la raison
- **Alors** l'accord du client est inscrit au journal du ticket

### 7. Ticket qui ne peut plus être réaffecté
- **Étant donné** un ticket en prestation, terminé, annulé ou absent
- **Quand** une commande `reassign_ticket` est envoyée pour ce ticket
- **Alors** le message de l'erreur `queue.invalid_transition` s'affiche
- **Alors** le ticket ne change pas

### 8. Aucun numéro de téléphone (confidentialité)
- **Étant donné** le message qui demande l'accord du client
- **Quand** le gérant le lit
- **Alors** aucun numéro de téléphone du client n'est affiché

### 9. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** une commande `reassign_ticket` vise un ticket ou un coiffeur du salon B
- **Alors** la commande est refusée et le ticket ne change pas

### 10. Seul le gérant réaffecte
- **Étant donné** un coiffeur connecté
- **Quand** une commande `reassign_ticket` est envoyée depuis son compte
- **Alors** la commande est refusée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.ticketPanel.reassign` | « Changer de coiffeur » | Libellé indicatif (APP_FLOW F-M10) |
| `pro-manager.reassign.delayWarning` | « L'heure du client reculerait de {minutes} min : demandez-lui son accord » | APP_FLOW F-M10 ; variable en minutes |
| `pro-manager.reassign.clientAgreed` | « Le client est d'accord » | Libellé indicatif (APP_FLOW F-M10) |
| `notifications.estimate_changed.reason.reassigned` | — (à rédiger) | Raison montrée au client (push seulement) |
| `errors.queue.would_delay_client` | — (à rédiger) | — |
| `errors.queue.invalid_transition` | — (à rédiger) | Partagée avec S-02 et S-12 |

## Questions ouvertes
- **TRD / BACKEND_SCHEMA** : quelle colonne `reassign_ticket` modifie-t-il ? D'après ADR-015, un ticket sans préférence n'a pas de coiffeur fixé avant l'appel. Faut-il alors écrire `requested_member_id` (ce qui change la préférence du client), `estimated_member_id`, ou `assigned_member_id` ?
- **PRD / APP_FLOW** : quels statuts peuvent être réaffectés ? Seulement « en attente », ou aussi « appelé » ?
- **APP_FLOW** : la liste ne montre-t-elle que les coiffeurs présents qui maîtrisent la prestation (H1) ? Si on choisit un coiffeur absent ou qui ne la maîtrise pas, quel code d'erreur est renvoyé ?
- **PRD (H6)** : F-M10 demande au gérant d'obtenir l'accord du client. Mais le gérant n'a pas le numéro du client, et l'appel masqué n'arrive qu'en V1. Pour un client qui n'est pas au salon, comment obtenir cet accord ? Faut-il plutôt demander l'accord par notification, comme pour la transition 8 ?
- **BACKEND_SCHEMA** : où l'accord du client (`client_agreed`) est-il enregistré ? Dans `ticket_events.after`, ou dans un autre champ ?
- **TRD** : quel code d'erreur reçoit un compte non autorisé (coiffeur) qui envoie `reassign_ticket` ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
