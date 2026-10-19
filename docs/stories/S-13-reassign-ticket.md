# S-13 · Réaffecter un ticket à un autre coiffeur

**En tant que** gérant, **je veux** réaffecter un ticket à un autre coiffeur, seulement si l'heure du client ne recule pas (sinon avec son accord), **afin de** mieux répartir la charge sans jamais pénaliser un client à son insu.

- Priorité : S (PRD §5.3)
- Règles appliquées : changer le coiffeur d'un client ne le fait jamais reculer, sauf accord du client : il reçoit une demande « accepter / refuser » ; sans réponse en 10 min, rien ne change (PRD §5.1, §11 n° 8-11 et E9) ; H5 (aucune réorganisation libre) ; toute variation d'heure de 10 min ou plus par rapport à la dernière heure annoncée, écarts cumulés, est expliquée (PRD §5.1, E11) ; PRD §5.4 « Demande de réaffectation » (push seulement) ; H6
- Parcours : F-M10 ; F-M6 (clic sur un ticket) ; côté client F-C5 bandeau « Le salon propose un autre coiffeur » (story U-17)
- Commandes et données : `reassign_ticket` (`ticket_id`, `member_id`) · `respond_reassignment` (réponse du client, U-17) · `queue-tick` (fin des demandes sans réponse) · tables `tickets` (`requested_member_id`, `estimated_member_id`, `assigned_member_id`, `estimated_start_at`, `last_notified_start_at`, `reassignment_member_id`, `reassignment_requested_at`), `ticket_events` (`reassigned`, `reassignment_requested`, `reassignment_resolved`, `before`, `after`), `notifications` (`estimate_changed`, `reassignment_request`)

## Scénarios

### 1. Voir les coiffeurs et la nouvelle heure
- **Étant donné** un ticket en attente, et le gérant qui a ouvert son panneau détail
- **Quand** il clique sur « Changer de coiffeur »
- **Alors** la liste des coiffeurs s'affiche
- **Alors** chaque coiffeur est accompagné de la nouvelle heure de passage estimée du client

### 2. Réaffecter sans recul, variation de 10 min ou plus
- **Étant donné** la liste des coiffeurs affichée, avec Léa qui ferait passer le client 15 min plus tôt
- **Quand** le gérant choisit Léa
- **Alors** la commande `reassign_ticket` est envoyée
- **Alors** le ticket est rattaché à Léa, sans demande au client
- **Alors** le client reçoit une notification push avec sa nouvelle heure et la raison
- **Alors** l'événement `reassigned` est inscrit au journal du ticket, avec le coiffeur d'avant et le coiffeur d'après

### 3. Réaffecter sans recul, variation de moins de 10 min
- **Étant donné** un coiffeur qui ferait passer le client moins de 10 min plus tôt que la dernière heure qui lui a été annoncée, écarts précédents compris (E11), ou à la même heure
- **Quand** le gérant le choisit
- **Alors** le ticket est rattaché à ce coiffeur
- **Alors** aucune notification n'est envoyée au client

### 4. Choix qui ferait reculer l'heure du client : demande au client
- **Étant donné** la liste des coiffeurs affichée, avec Sam qui ferait passer le client 20 min plus tard
- **Quand** le gérant choisit Sam
- **Alors** le message « L'heure du client reculerait de 20 min : il recevra une demande » s'affiche (F-M10)
- **Quand** le gérant confirme
- **Alors** la commande `reassign_ticket` est envoyée
- **Alors** le ticket garde son coiffeur et son heure tant que le client n'a pas accepté (E9)
- **Alors** le coiffeur proposé et l'heure de la demande sont enregistrés (`reassignment_member_id`, `reassignment_requested_at`)
- **Alors** le client reçoit une notification push « accepter / refuser » avec sa nouvelle heure (`reassignment_request`), sans SMS (PRD §5.4)
- **Alors** sa page de suivi affiche le bandeau « Le salon propose un autre coiffeur » (F-C5)
- **Alors** le ticket est marqué « en attente de réponse » sur le dashboard
- **Alors** l'événement `reassignment_requested` est inscrit au journal du ticket

### 5. Le client accepte
- **Étant donné** une demande de réaffectation vers Sam en cours
- **Quand** le client clique sur « Accepter » (`respond_reassignment`, `accept`)
- **Alors** le ticket est rattaché à Sam et les heures sont recalculées
- **Alors** le marquage « en attente de réponse » disparaît du dashboard
- **Alors** l'événement `reassignment_resolved` est inscrit au journal du ticket, avec le choix `accepted`

### 6. Le client refuse
- **Étant donné** une demande de réaffectation vers Sam en cours
- **Quand** le client clique sur « Refuser » (`respond_reassignment`, `refuse`)
- **Alors** le ticket garde son coiffeur et son heure
- **Alors** le marquage « en attente de réponse » disparaît du dashboard
- **Alors** l'événement `reassignment_resolved` est inscrit au journal du ticket, avec le choix `refused`

### 6 bis. Pas de réponse en 10 min
- **Étant donné** une demande de réaffectation envoyée à 14:00
- **Quand** il est 14:10 sans réponse du client (tolérance des tests ±60 s, TRD §10.1, K7)
- **Alors** `queue-tick` efface la demande (`expired`)
- **Alors** l'événement `reassignment_resolved` est inscrit au journal du ticket, avec le choix `expired`
- **Alors** le ticket garde son coiffeur et son heure (E9)
- **Alors** le marquage « en attente de réponse » disparaît du dashboard

### 6 ter. Client sans push ou sans consentement
- **Étant donné** un client sans push actif, ou qui n'a pas coché « Me prévenir »
- **Quand** le gérant demande une réaffectation qui recule son heure
- **Alors** aucun SMS n'est envoyé (PRD §5.4 : push seulement)
- **Alors** sans consentement, la notification push est marquée `skipped` (`no_consent`, BACKEND_SCHEMA §4.16, K11)
- **Alors** la demande reste visible sur la page de suivi du client pendant 10 min (F-C5)

### 6 quater. Seconde demande pendant qu'une demande attend
- **Étant donné** une demande de réaffectation en attente de la réponse du client
- **Quand** le gérant envoie une nouvelle commande `reassign_ticket` pour ce ticket
- **Alors** le message de l'erreur `queue.reassignment_pending` s'affiche (TRD §6.2)
- **Alors** la demande en cours ne change pas

### 6 quinquies. Coiffeur indisponible
- **Étant donné** un coiffeur absent ou désactivé
- **Quand** une commande `reassign_ticket` vise ce coiffeur
- **Alors** le message de l'erreur `queue.stylist_unavailable` s'affiche (TRD §6.2)
- **Alors** le ticket ne change pas

### 7. Ticket qui ne peut plus être réaffecté
- **Étant donné** un ticket en prestation, terminé, annulé ou absent
- **Quand** une commande `reassign_ticket` est envoyée pour ce ticket
- **Alors** le message de l'erreur `queue.invalid_transition` s'affiche
- **Alors** le ticket ne change pas

### 8. Aucun numéro de téléphone (confidentialité)
- **Étant donné** le message qui annonce la demande au client
- **Quand** le gérant le lit
- **Alors** aucun numéro de téléphone du client n'est affiché
- **Alors** la demande part de la plateforme, jamais du gérant (H6)

### 9. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** une commande `reassign_ticket` vise un ticket ou un coiffeur du salon B
- **Alors** la commande est refusée et le ticket ne change pas

### 10. Seul le gérant réaffecte
- **Étant donné** un coiffeur connecté
- **Quand** une commande `reassign_ticket` est envoyée depuis son compte
- **Alors** la commande est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.ticket_panel.reassign` | « Changer de coiffeur » | Libellé indicatif (APP_FLOW F-M10) |
| `pro-manager.reassign.delay_warning` | « L'heure du client reculerait de {minutes} min : il recevra une demande » | APP_FLOW F-M10 ; variable en minutes ; partagée avec U-17 |
| `pro-manager.board.ticket.awaiting_client_answer` | « en attente de réponse » | Partagée avec S-09 et U-12 |
| `notifications.estimate_changed.reason.reassigned` | « Le salon vous a confié à un autre coiffeur. » | Raison montrée au client (push seulement) |
| `notifications.reassignment_request.push` | Voir `notifications.reassignment_request.push.*` dans le dictionnaire (2 textes) | Partagée avec U-17 ; push seulement, « Accepter » et « Refuser » ; pas de modèle SMS |
| `errors.queue.reassignment_pending` | « Une demande de changement de coiffeur attend déjà la réponse du client. Patientez 10 min au plus. » | TRD §6.2 |
| `errors.queue.stylist_unavailable` | « Ce coiffeur n'est pas disponible pour le moment. Choisissez-en un autre, puis réessayez. » | TRD §6.2 ; partagée avec U-04 et U-17 |
| `errors.queue.invalid_transition` | « Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. » | Partagée avec S-02 et S-12 |
| `errors.queue.forbidden` | « Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. » | Code commun (TRD §6.2) |

## Questions ouvertes
- **Résolu le 18/10** (E9, PRD §5.1 ; TRD §6.2) : un recul crée une demande au client (`reassignment_request`), réponse par `respond_reassignment` (U-17) ; sans réponse en 10 min, rien ne change. `reassign_ticket` n'a plus de paramètre `client_agreed`, et la case « Le client est d'accord » disparaît.
- **Résolu le 18/10** (K1, TRD §6.2) : `reassign_ticket` renvoie `queue.stylist_unavailable`, `queue.reassignment_pending`, et les codes communs (`queue.forbidden` pour un coiffeur).
- **TRD / BACKEND_SCHEMA** : quelle colonne `reassign_ticket` modifie-t-il ? D'après ADR-015, un ticket sans préférence n'a pas de coiffeur fixé avant l'appel. Faut-il alors écrire `requested_member_id` (ce qui change la préférence du client), `estimated_member_id`, ou `assigned_member_id` ?
- **PRD / APP_FLOW** : quels statuts peuvent être réaffectés ? Seulement « en attente », ou aussi « appelé » ?
- **APP_FLOW / TRD** : la liste ne montre-t-elle que les coiffeurs présents qui maîtrisent la prestation (H1) ? Choisir un coiffeur qui ne maîtrise pas la prestation renvoie-t-il aussi `stylist_unavailable` ?
- **TRD** : `remove_ticket` a le code `ticket_other_salon`, mais pas `reassign_ticket`. Quel code reçoit un gérant qui vise un ticket ou un coiffeur d'un autre salon : `forbidden` ?
- **PRD (consentement, K11)** : `reassignment_request` ne part pas sans la case « Me prévenir » ; la demande expire alors presque toujours (même question dans U-17). Est-ce voulu ?
- **PRD / TRD (rendez-vous)** : un rendez-vous (`kind` = `appointment`) se réaffecte-t-il par `reassign_ticket` (avec la règle de non-recul) ou par `update_appointment` (`member_id?`) ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
