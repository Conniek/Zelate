# S-13 · Réaffecter un ticket à un autre coiffeur

**En tant que** gérant, **je veux** réaffecter un ticket à un autre coiffeur, seulement si l'heure du client ne recule pas (sinon avec son accord), **afin de** mieux répartir la charge sans jamais pénaliser un client à son insu.

- Priorité : S (PRD §5.3)
- Règles appliquées : changer le coiffeur d'un client ne le fait jamais reculer, sauf accord du client : il reçoit une demande « accepter / refuser » ; sans réponse en 10 min, rien ne change ; le gérant voit « refusé » ou « sans réponse » ; l'accord vaut tant que l'heure ne recule pas de 10 min de plus, sinon une nouvelle demande part ; les rendez-vous se réaffectent de la même façon (PRD §5.1, §11 n° 8-11, E9 et E27) ; la demande de réaffectation est un message indispensable (E17) ; H5 (aucune réorganisation libre) ; toute variation d'heure de 10 min ou plus par rapport à la dernière heure annoncée, écarts cumulés, est expliquée (PRD §5.1, E11) ; PRD §5.4 « Demande de réaffectation » (push seulement) ; H6
- Parcours : F-M10 ; F-M6 (clic sur un ticket) ; côté client F-C5 bandeau « Le salon propose un autre coiffeur » (story U-17)
- Commandes et données : `reassign_ticket` (`ticket_id`, `member_id`) · `respond_reassignment` (réponse du client, U-17) · `queue-tick` (fin des demandes sans réponse) · tables `tickets` (`requested_member_id`, `estimated_member_id`, `assigned_member_id`, `estimated_start_at`, `last_notified_start_at`, `reassignment_member_id`, `reassignment_requested_at`, `reassignment_proposed_start_at` ; une réaffectation modifie `requested_member_id`, ou `assigned_member_id` pour un rendez-vous, K39), `ticket_events` (`reassigned`, `reassignment_requested`, `reassignment_resolved`, `before`, `after`), `notifications` (`estimate_changed`, `reassignment_request`)

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
- **Alors** le ticket est rattaché à Léa, sans demande au client : `requested_member_id` passe à Léa (K39)
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
- **Alors** le coiffeur proposé, l'heure de la demande et l'heure proposée sont enregistrés (`reassignment_member_id`, `reassignment_requested_at`, `reassignment_proposed_start_at`)
- **Alors** le client reçoit une notification push « accepter / refuser » avec sa nouvelle heure (`reassignment_request`), sans SMS (PRD §5.4), qu'il ait coché « Me prévenir » ou non (E17)
- **Alors** sa page de suivi affiche le bandeau « Le salon propose un autre coiffeur » (F-C5)
- **Alors** le ticket est marqué « en attente de réponse » sur le dashboard
- **Alors** l'événement `reassignment_requested` est inscrit au journal du ticket

### 5. Le client accepte
- **Étant donné** une demande de réaffectation vers Sam en cours
- **Quand** le client clique sur « Accepter » (`respond_reassignment`, `accept`)
- **Alors** le ticket est rattaché à Sam et les heures sont recalculées
- **Alors** le marquage « en attente de réponse » disparaît du dashboard
- **Alors** l'événement `reassignment_resolved` est inscrit au journal du ticket, avec le choix `accepted`

### 5 bis. Le client accepte, mais l'heure a encore reculé
- **Étant donné** une demande vers Sam qui annonçait 15:20 (`reassignment_proposed_start_at`)
- **Quand** le client accepte alors que la nouvelle heure chez Sam est devenue 15:30, soit 10 min de plus
- **Alors** le ticket n'est pas réaffecté
- **Alors** une nouvelle demande part au client avec l'heure de 15:30 (PRD §5.1, E27 ; TRD §6.2 `respond_reassignment`)
- **Quand** la nouvelle heure n'a reculé que de 5 min (15:25)
- **Alors** l'acceptation vaut et le ticket est rattaché à Sam

### 6. Le client refuse
- **Étant donné** une demande de réaffectation vers Sam en cours
- **Quand** le client clique sur « Refuser » (`respond_reassignment`, `refuse`)
- **Alors** le ticket garde son coiffeur et son heure
- **Alors** le marquage « en attente de réponse » disparaît du dashboard
- **Alors** l'événement `reassignment_resolved` est inscrit au journal du ticket, avec le choix `refused`
- **Alors** le gérant voit le résultat « refusé » sur ce ticket (E27, `get_salon_board`)

### 6 bis. Pas de réponse en 10 min
- **Étant donné** une demande de réaffectation envoyée à 14:00
- **Quand** il est 14:10 sans réponse du client (tolérance des tests ±60 s, TRD §10.1, K7)
- **Alors** `queue-tick` efface la demande (`expired`)
- **Alors** l'événement `reassignment_resolved` est inscrit au journal du ticket, avec le choix `expired`
- **Alors** le ticket garde son coiffeur et son heure (E9)
- **Alors** le marquage « en attente de réponse » disparaît du dashboard
- **Alors** le gérant voit le résultat « sans réponse » sur ce ticket (E27)

### 6 ter. Client sans push ou sans consentement
- **Étant donné** un client sans push actif, ou qui n'a pas coché « Me prévenir »
- **Quand** le gérant demande une réaffectation qui recule son heure
- **Alors** aucun SMS n'est envoyé (PRD §5.4 : push seulement)
- **Alors** sans consentement, la notification push part quand même s'il a un push actif : c'est un message indispensable (PRD §5.1, E17)
- **Alors** la demande reste visible sur la page de suivi du client pendant 10 min (F-C5)

### 6 sexies. Réaffecter un rendez-vous
- **Étant donné** le rendez-vous de Léa à 15:00 chez Inès
- **Quand** le gérant le réaffecte à Karim par « Changer de coiffeur »
- **Alors** la même règle s'applique : réaffectation immédiate si l'heure de Léa ne recule pas, sinon demande à Léa (PRD §5.1, E27)
- **Alors** une fois la réaffectation faite, `assigned_member_id` passe à Karim (K39)

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
- **Quand** une commande `reassign_ticket` vise un ticket du salon B
- **Alors** la commande est refusée avec l'erreur `queue.ticket_other_salon` (TRD v0.5 §6.2) et le ticket ne change pas

### 10. Seul le gérant réaffecte
- **Étant donné** un coiffeur connecté
- **Quand** une commande `reassign_ticket` est envoyée depuis son compte
- **Alors** la commande est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.ticket_panel.reassign` | « Changer de coiffeur » | Libellé indicatif (APP_FLOW F-M10) |
| `pro-manager.reassign.delay_warning` | « L'heure du client reculerait de {minutes} min : il recevra une demande. » | APP_FLOW F-M10 ; variable en minutes ; partagée avec U-17 |
| `pro-manager.reassign.new_time` | « Passage estimé à {time} » | Nouvelle heure dans la liste des coiffeurs |
| `pro-manager.reassign.send_request` | « Envoyer la demande » | — |
| `pro-manager.reassign.request_sent` | « Demande envoyée. Sans réponse du client en 10 min, rien ne change. » | E9 |
| Résultat « refusé » / « sans réponse » | _À rédiger_ (aucune clé dans le dictionnaire) | Libellés du PRD §5.1 (E27) ; partagée avec S-09 |
| `errors.queue.ticket_other_salon` | « Aucun ticket de votre salon ne correspond. Vérifiez le code ou le client concerné. » | TRD v0.5 §6.2 |
| `pro-manager.board.ticket.awaiting_client_answer` | « En attente de réponse » | Partagée avec S-09 et U-12 |
| `common.change_reason.reassigned` | « Le salon vous a confié à un autre coiffeur. » | Raison montrée au client (push seulement) |
| `notifications.reassignment_request.push` | Voir `notifications.reassignment_request.push.*` dans le dictionnaire (2 textes) | Partagée avec U-17 ; push seulement, « Accepter » et « Refuser » ; pas de modèle SMS |
| `errors.queue.reassignment_pending` | « Une demande de changement de coiffeur attend déjà la réponse du client. Patientez 10 min au plus. » | TRD §6.2 |
| `errors.queue.stylist_unavailable` | « Ce coiffeur n'est pas disponible pour le moment. Choisissez-en un autre, puis réessayez. » | TRD §6.2 ; partagée avec U-04 et U-17 |
| `errors.queue.invalid_transition` | « Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. » | Partagée avec S-02 et S-12 |
| `errors.queue.forbidden` | « Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. » | Code commun (TRD §6.2) |

## Questions ouvertes
- **Résolu le 18/10** (E9, PRD §5.1 ; TRD §6.2) : un recul crée une demande au client (`reassignment_request`), réponse par `respond_reassignment` (U-17) ; sans réponse en 10 min, rien ne change. `reassign_ticket` n'a plus de paramètre `client_agreed`, et la case « Le client est d'accord » disparaît.
- **Résolu le 18/10** (K1, TRD §6.2) : `reassign_ticket` renvoie `queue.stylist_unavailable`, `queue.reassignment_pending`, et les codes communs (`queue.forbidden` pour un coiffeur).
- **Résolu le 19/10** (K39, TRD ADR-015 et §6.2) : `reassign_ticket` modifie `requested_member_id` pour un ticket de file, `assigned_member_id` pour un rendez-vous.
- **Résolu le 19/10** (E27, PRD §5.1 ; TRD §6.2, §6.3) : le gérant voit « refusé » ou « sans réponse » (`reassignment_resolved` lu par `get_salon_board`) ; l'accord vaut si l'heure ne recule pas de 10 min de plus que l'heure proposée, sinon nouvelle demande. Le texte des deux libellés manque dans le dictionnaire.
- **PRD / APP_FLOW** : quels statuts peuvent être réaffectés ? Seulement « en attente », ou aussi « appelé » ?
- **APP_FLOW / TRD** : la liste ne montre-t-elle que les coiffeurs présents qui maîtrisent la prestation (H1) ? Choisir un coiffeur qui ne maîtrise pas la prestation renvoie-t-il aussi `stylist_unavailable` ?
- **Résolu en partie le 19/10** (TRD v0.5 §6.2) : `reassign_ticket` renvoie `ticket_other_salon` pour un ticket d'un autre salon. **Reste ouvert (TRD)** : quel code pour un coiffeur cible d'un autre salon (`stylist_unavailable` ou `forbidden`) ?
- **Résolu le 19/10** (E17, PRD §5.1) : `reassignment_request` est un message indispensable ; il part sans « Me prévenir ».
- **Résolu en partie le 19/10** (E27, K39) : un rendez-vous se réaffecte par `reassign_ticket`, avec la règle de non-recul. **Reste ouvert (TRD / APP_FLOW, nouveau)** : `update_appointment` garde un `member_id?` (F-M13 « Modifier ») qui change le coiffeur sans cette règle ni l'accord du client. Les deux chemins doivent-ils coexister ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
