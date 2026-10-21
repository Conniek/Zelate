# U-17 · Accepter ou refuser une réaffectation qui recule mon heure

**En tant que** client en attente, **je veux** accepter ou refuser quand le salon propose de me confier à un autre coiffeur qui me ferait passer plus tard, **afin de** ne jamais reculer sans mon accord.

- Priorité : S (PRD §5.3)
- Règles appliquées : H5 (aucune réorganisation libre), H6 (numéro jamais affiché au salon) (PRD §5.1) ; changer le coiffeur d'un client ne le fait jamais reculer sauf accord : demande « accepter / refuser », sans réponse en 10 min rien ne change (PRD §5.1 « Autres règles ») ; tout recul est expliqué (PRD §5.1) ; le gérant voit « refusé » ou « sans réponse » ; l'accord vaut tant que l'heure ne recule pas de 10 min de plus, sinon une nouvelle demande part ; les rendez-vous se réaffectent de la même façon (E27) ; une réaffectation acceptée modifie `requested_member_id`, ou `assigned_member_id` pour un rendez-vous (K39) ; notification « Demande de réaffectation » : push avec « accepter / refuser », pas de SMS, message indispensable envoyé sans la case « Me prévenir » (PRD §5.4, E17) ; décisions n° 8-11 et E9 (PRD §11) ; mise à jour en moins de 2 s, sinon toutes les 30 s (PRD §5.3 U-06, §6)
- Parcours : F-C5 (bandeau « Le salon propose un autre coiffeur ») et F-C10 (`/t/:shortCode`) ; déclenché par F-M10 (« Choix avec recul ») ; événement « Demande de réaffectation » (APP_FLOW §7)
- Commandes et données : `reassign_ticket` (`ticket_id`, `member_id`) · `respond_reassignment` (`ticket_id`, `choice` = `accept` | `refuse`) · `queue-tick` (fin des demandes sans réponse après 10 min) · tables `tickets` (`reassignment_member_id`, `reassignment_requested_at`, `reassignment_proposed_start_at`, `estimated_start_at`, `estimated_member_id`, `requested_member_id`, `assigned_member_id` pour un rendez-vous), `ticket_events` (`reassignment_requested`, `reassignment_resolved` avec `reason_code` = valeur de `reassignment_choice`, `reassigned`), `notifications` (`reassignment_request`), enum `reassignment_choice` (`accepted`, `refused`, `expired`) · RPC `get_salon_board` (dernier résultat de réaffectation de chaque ticket) · canaux `ticket:{ticket_id}`, `ticket-token:{token_key}`, `salon:{salon_id}` · composant `ReassignmentPrompt`

## Scénarios

### 1. Le salon propose un coiffeur plus tardif

- **Étant donné** que j'attends avec une heure de passage à 15h00 et que le gérant choisit Sam, chez qui je passerais à 15h20
- **Quand** il confirme le message « L'heure du client reculerait de 20 min : il recevra une demande »
- **Alors** mon ticket ne change pas : même coiffeur, même heure, même rang
- **Et** la demande est enregistrée sur mon ticket (`reassignment_member_id` = Sam, `reassignment_requested_at` = maintenant, `reassignment_proposed_start_at` = 15h20)
- **Et** un événement `reassignment_requested` est ajouté au journal
- **Et** je reçois une notification push avec « Accepter » et « Refuser »
- **Et** aucun SMS n'est envoyé pour cette demande
- **Et** le dashboard marque mon ticket « en attente de réponse »

### 2. Bandeau sur ma page de suivi

- **Étant donné** qu'une demande de réaffectation est en cours pour mon ticket
- **Quand** j'ouvre `/ticket`
- **Alors** le bandeau « Le salon propose un autre coiffeur » s'affiche
- **Et** il montre le prénom du nouveau coiffeur et ma nouvelle heure de passage (15h20)
- **Et** il montre le temps restant pour répondre
- **Et** il propose « Accepter » et « Refuser »

### 3. Accepter

- **Étant donné** que le bandeau de réaffectation est affiché
- **Quand** je touche « Accepter » et que mon heure chez Sam est toujours 15h20
- **Alors** mon ticket est confié à Sam : Sam devient mon coiffeur demandé (`requested_member_id`, K39)
- **Et** mon heure de passage est recalculée et affichée
- **Et** un événement `reassignment_resolved` est ajouté au journal avec le choix `accepted`
- **Et** les colonnes de la demande sont vidées
- **Et** le bandeau disparaît
- **Et** le dashboard ne marque plus mon ticket « en attente de réponse » et montre le résultat « accepté » (E27)

### 3 bis. Heure encore reculée au moment d'accepter : nouvelle demande (E27)

- **Étant donné** que la demande m'annonçait 15h20 chez Sam (`reassignment_proposed_start_at`)
- **Quand** je touche « Accepter » alors que je passerais maintenant à 15h30 chez Sam (10 min de plus)
- **Alors** mon ticket ne change pas de coiffeur
- **Et** une nouvelle demande m'est envoyée avec 15h30
- **Quand** je passerais à 15h29 (9 min de plus)
- **Alors** mon acceptation est appliquée comme au scénario 3

### 3 ter. Réaffectation d'un rendez-vous (E27, K39)

- **Étant donné** que j'ai un rendez-vous à 15h00 avec Léa et que le gérant propose Sam, chez qui je passerais plus tard
- **Quand** j'accepte la demande
- **Alors** mon rendez-vous est confié à Sam (`assigned_member_id` = Sam, K39)
- **Et** l'heure de mon rendez-vous ne change pas

### 4. Refuser

- **Étant donné** que le bandeau de réaffectation est affiché
- **Quand** je touche « Refuser »
- **Alors** mon ticket garde son coiffeur, son heure et son rang
- **Et** un événement `reassignment_resolved` est ajouté au journal avec le choix `refused`
- **Et** le bandeau disparaît
- **Et** le dashboard ne marque plus mon ticket « en attente de réponse » et montre « refusé » au gérant (E27)

### 5. Répondre depuis la notification

- **Étant donné** que j'ai reçu la notification push de demande de réaffectation
- **Quand** je touche « Accepter » ou « Refuser » dans la notification
- **Alors** ma réponse est enregistrée comme depuis le bandeau

### 6. Sans réponse en 10 min, rien ne change

- **Étant donné** qu'une demande de réaffectation m'a été envoyée et que je n'ai pas répondu
- **Quand** 10 min se sont écoulées depuis `reassignment_requested_at`
- **Alors** mon ticket garde son coiffeur, son heure et son rang
- **Et** la demande est effacée (`reassignment_member_id`, `reassignment_requested_at` et `reassignment_proposed_start_at` vides)
- **Et** un événement `reassignment_resolved` est ajouté au journal avec le choix `expired`
- **Et** le bandeau disparaît de ma page de suivi
- **Et** le dashboard ne marque plus mon ticket « en attente de réponse » et montre « sans réponse » au gérant (E27)
- **Et** l'échéance est tenue à ±60 s près (exécution de `queue-tick` chaque minute)

### 7. Réponse juste avant l'échéance

- **Étant donné** que la demande date de 9 min
- **Quand** je touche « Accepter »
- **Alors** ma réponse est enregistrée et mon ticket est confié à Sam
- **Et** l'expiration ne s'applique pas à ma demande

### 8. Erreur `queue.already_resolved` : réponse après l'échéance ou en double

- **Étant donné** que la demande a expiré, ou que j'ai déjà répondu (depuis la notification par exemple)
- **Quand** une commande `respond_reassignment` est envoyée pour mon ticket
- **Alors** elle est refusée avec `queue.already_resolved`
- **Et** mon ticket ne change pas
- **Et** le message d'erreur correspondant s'affiche

### 9. Erreur `queue.invalid_transition` : ticket qui n'attend plus

- **Étant donné** que mon ticket est appelé, en prestation, terminé, annulé ou absent
- **Quand** une commande `respond_reassignment` est envoyée
- **Alors** elle est refusée et le ticket ne change pas
- **Et** le message d'erreur `queue.invalid_transition` s'affiche

### 10. Réponse depuis le lien SMS

- **Étant donné** que je suis mon ticket par `/t/:shortCode`, sans session
- **Quand** je touche « Refuser » dans le bandeau
- **Alors** ma réponse est enregistrée comme depuis l'app, au titre du jeton de suivi

### 11. Sans push : bandeau à l'ouverture, sans SMS

- **Étant donné** que je n'ai pas de push actif (client inscrit à l'accueil, par exemple)
- **Quand** une demande de réaffectation est créée pour mon ticket
- **Alors** aucun SMS ne m'est envoyé
- **Et** le bandeau s'affiche si j'ouvre ma page de suivi avant l'échéance de 10 min

### 12. Sans consentement aux notifications de suivi (E17)

- **Étant donné** que je n'ai pas coché « Me prévenir » et que j'ai un push actif
- **Quand** une demande de réaffectation est créée pour mon ticket
- **Alors** la notification push part quand même : c'est un message indispensable
- **Et** elle n'est pas marquée `skipped` avec le motif `no_consent`

### 13. Apparition du bandeau en temps réel

- **Étant donné** que ma page de suivi est ouverte (`/ticket` ou `/t/:shortCode`)
- **Quand** le gérant crée la demande, ou quand elle expire
- **Alors** le bandeau apparaît, ou disparaît, en moins de 2 s
- **Et** sinon, au plus tard 30 s après, ou dès que je reviens sur la page

### 14. Une seule demande à la fois : `queue.reassignment_pending`

- **Étant donné** qu'une demande de réaffectation est en cours pour mon ticket
- **Quand** le gérant envoie une nouvelle commande `reassign_ticket` pour ce ticket
- **Alors** elle est refusée avec `queue.reassignment_pending`
- **Et** la demande en cours ne change pas

### 15. Coiffeur proposé indisponible : `queue.stylist_unavailable`

- **Étant donné** que Sam est absent ou en fin de journée
- **Quand** le gérant envoie `reassign_ticket` vers Sam pour mon ticket
- **Alors** la commande est refusée avec `queue.stylist_unavailable`
- **Et** aucune demande ne m'est envoyée

### 16. Réaffectation sans recul : aucune demande

- **Étant donné** que le gérant choisit un coiffeur chez qui je passerais à la même heure ou plus tôt
- **Quand** il envoie `reassign_ticket`
- **Alors** mon ticket est réaffecté directement
- **Et** aucune demande « accepter / refuser » ne m'est envoyée

### 17. Seul le client répond : `queue.forbidden`

- **Étant donné** qu'une demande de réaffectation est en cours pour mon ticket
- **Quand** une commande `respond_reassignment` est envoyée par le gérant, par un coiffeur, par un autre client ou avec un jeton qui n'est pas celui de mon ticket
- **Alors** elle est refusée avec `queue.forbidden`
- **Et** mon ticket ne change pas

### 18. Seul le gérant réaffecte

- **Étant donné** un coiffeur connecté
- **Quand** une commande `reassign_ticket` est envoyée depuis son compte
- **Alors** elle est refusée avec `queue.forbidden`
- **Et** aucune demande n'est créée

### 19. Double appui

- **Étant donné** que le bandeau est affiché
- **Quand** je touche deux fois de suite « Accepter »
- **Alors** le bouton affiche un état de chargement et se désactive dès le premier appui
- **Et** une seule réponse est enregistrée

### 20. Confidentialité côté salon

- **Étant donné** que mon ticket est marqué « en attente de réponse »
- **Quand** le gérant consulte le dashboard
- **Alors** il voit mon prénom et l'état « en attente de réponse »
- **Et** il ne voit pas mon numéro de téléphone, ni sur l'écran ni dans les données reçues
- **Et** les messages temps réel liés à la demande ne contiennent aucune donnée personnelle (ni prénom, ni téléphone, ni jeton)

## Textes à prévoir

| Clé (anglais)                                                         | Texte (français)                                                                                              | Contrainte                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ticket.reassignment.banner`                                   | « Le salon propose un autre coiffeur »                                                                        | APP_FLOW F-C5                                                                                                                                   |
| `client.ticket.reassignment.new_time`                                 | Avec {first_name} : passage prévu vers {time}                                                                 | Variables `first_name`, `time`                                                                                                                  |
| `client.ticket.reassignment.no_answer_hint`                           | Sans réponse de votre part, rien ne change.                                                                   | E9                                                                                                                                              |
| `client.ticket.reassignment.time_left`                                | {minutes, plural, =0 {Moins d'une minute pour répondre} other {Encore # min pour répondre}}                   | Temps restant sur 10 min (DESIGN_SYSTEM `ReassignmentPrompt`)                                                                                   |
| `client.ticket.reassignment.accept`                                   | « Accepter »                                                                                                  | —                                                                                                                                               |
| `client.ticket.reassignment.refuse`                                   | « Refuser »                                                                                                   | —                                                                                                                                               |
| `notifications.reassignment_request.push`                             | Voir `notifications.reassignment_request.push.*` dans le dictionnaire (2 textes)                              | Push seulement, deux actions `notifications.reassignment_request.actions.accept` et `.refuse` ; pas de modèle SMS ; message indispensable (E17) |
| `pro-manager.reassign.delay_warning`                                  | L'heure du client reculerait de {minutes} min : il recevra une demande.                                       | APP_FLOW F-M10                                                                                                                                  |
| `pro-manager.reassign.request_sent`                                   | Demande envoyée. Sans réponse du client en 10 min, rien ne change.                                            | Côté gérant                                                                                                                                     |
| `pro-manager.board.ticket.awaiting_client_answer`                     | En attente de réponse                                                                                         | Partagé avec U-12                                                                                                                               |
| _Résultat « accepté », « refusé », « sans réponse » sur le dashboard_ | _Absent du dictionnaire_                                                                                      | E27 ; voir questions ouvertes                                                                                                                   |
| `errors.queue.already_resolved`                                       | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran.                            | Même code pour `cancel_ticket`, `resolve_stylist_change`, `respond_end_of_day` (TRD §6.2)                                                       |
| `errors.queue.invalid_transition`                                     | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran.                                | Code commun                                                                                                                                     |
| `errors.queue.forbidden`                                              | Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. | Code commun                                                                                                                                     |
| `errors.queue.reassignment_pending`                                   | Une demande de changement de coiffeur attend déjà la réponse du client. Patientez 10 min au plus.             | Côté gérant                                                                                                                                     |
| `errors.queue.stylist_unavailable`                                    | Ce coiffeur n'est pas disponible pour le moment. Choisissez-en un autre, puis réessayez.                      | Côté gérant ; partagé avec U-04                                                                                                                 |

## Questions ouvertes

- **Résolu le 19/10** (K39) — À l'acceptation, `requested_member_id` devient Sam (et remplace Léa si je l'avais demandée) ; pour un rendez-vous, `assigned_member_id` ; voir scénarios 3 et 3 ter.
- **Résolu en partie le 19/10** (E27) — Heure encore reculée de 10 min ou plus à l'acceptation : une nouvelle demande part ; voir scénario 3 bis. Reste ouvert (TRD §6.2) : si Sam est devenu indisponible entre la demande et l'acceptation, que se passe-t-il et avec quel code (`stylist_unavailable` n'existe que pour `reassign_ticket`) ?
- **PRD §5.1 / §5.4** : « tout recul est expliqué ». Après une acceptation, une notification « Changement d'heure » (`estimate_changed`) part-elle, alors que j'ai déjà vu la nouvelle heure ? La dernière heure annoncée (`last_notified_start_at`) est-elle mise à jour à l'acceptation ?
- **Résolu le 19/10** (E17) — `reassignment_request` est un message indispensable, envoyé sans la case « Me prévenir » ; voir scénario 12.
- **Résolu le 19/10** (E27) — Le gérant voit « refusé » ou « sans réponse » (dernier résultat dans `get_salon_board`) ; voir scénarios 4 et 6. Reste ouvert (dictionnaire, APP_FLOW F-M6/F-M10) : aucun texte ni emplacement n'est encore prévu pour ce résultat sur le dashboard.
- **PRD §5.2** : que devient une demande en cours si mon ticket est appelé par mon coiffeur actuel, si j'annule, ou si mon coiffeur actuel devient indisponible (choix U-12) pendant les 10 min ? Deux bandeaux (U-12 et U-17) peuvent-ils coexister ?
- **Résolu le 19/10** (E27, E18) — Les rendez-vous se réaffectent de la même façon ; quand le coiffeur devient indisponible, le client avec rendez-vous choisit comme les autres (U-12, scénario 10 bis) ; voir scénario 3 ter.
- **TRD §6.2** : quel statut de ticket peut recevoir une demande : seulement `waiting`, ou aussi `called` ? Le scénario 9 suppose `waiting` seulement.
- **Résolu le 19/10** (BACKEND_SCHEMA v0.5 §3, constat 24) — `reassignment_choice` vit dans `ticket_events.reason_code` de l'événement `reassignment_resolved`.
- **Résolu le 18/10** (TRD §6.4 aligné sur BACKEND_SCHEMA §9) — `ticket_updated { version, status }` sur `ticket:{ticket_id}` ; `{ version }` seul sur `ticket-token:{token_key}` ; voir scénario 20.
- **Résolu** (S-13 réécrite le 18/10, constat 29) — S-13 ne décrit plus `client_agreed` ; la note périmée est retirée.
- **Résolu le 19/10** (dictionnaire `client.json`, `notifications.json`, `errors.json`) — Notification, bandeau, temps restant et erreurs rédigés, sauf le résultat montré au gérant (voir ci-dessus).
