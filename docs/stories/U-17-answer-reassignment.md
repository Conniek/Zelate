# U-17 · Accepter ou refuser une réaffectation qui recule mon heure

**En tant que** client en attente, **je veux** accepter ou refuser quand le salon propose de me confier à un autre coiffeur qui me ferait passer plus tard, **afin de** ne jamais reculer sans mon accord.

- Priorité : S (PRD §5.3)
- Règles appliquées : H5 (aucune réorganisation libre), H6 (numéro jamais affiché au salon) (PRD §5.1) ; changer le coiffeur d'un client ne le fait jamais reculer sauf accord : demande « accepter / refuser », sans réponse en 10 min rien ne change (PRD §5.1 « Autres règles ») ; tout recul est expliqué (PRD §5.1) ; notification « Demande de réaffectation » : push avec « accepter / refuser », pas de SMS (PRD §5.4) ; décisions n° 8-11 et E9 (PRD §11) ; mise à jour en moins de 2 s, sinon toutes les 30 s (PRD §5.3 U-06, §6)
- Parcours : F-C5 (bandeau « Le salon propose un autre coiffeur ») et F-C10 (`/t/:shortCode`) ; déclenché par F-M10 (« Choix avec recul ») ; événement « Demande de réaffectation » (APP_FLOW §7)
- Commandes et données : `reassign_ticket` (`ticket_id`, `member_id`) · `respond_reassignment` (`ticket_id`, `choice` = `accept` | `refuse`) · `queue-tick` (fin des demandes sans réponse après 10 min) · tables `tickets` (`reassignment_member_id`, `reassignment_requested_at`, `estimated_start_at`, `estimated_member_id`, `requested_member_id`), `ticket_events` (`reassignment_requested`, `reassignment_resolved`, `reassigned`), `notifications` (`reassignment_request`, `skip_reason`), enum `reassignment_choice` (`accepted`, `refused`, `expired`) · canaux `ticket:{ticket_id}`, `ticket-token:{token_key}`, `salon:{salon_id}` · composant `ReassignmentPrompt`

## Scénarios

### 1. Le salon propose un coiffeur plus tardif
- **Étant donné** que j'attends avec une heure de passage à 15h00 et que le gérant choisit Sam, chez qui je passerais à 15h20
- **Quand** il confirme le message « L'heure du client reculerait de 20 min : il recevra une demande »
- **Alors** mon ticket ne change pas : même coiffeur, même heure, même rang
- **Et** la demande est enregistrée sur mon ticket (`reassignment_member_id` = Sam, `reassignment_requested_at` = maintenant)
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
- **Quand** je touche « Accepter »
- **Alors** mon ticket est confié à Sam
- **Et** mon heure de passage est recalculée et affichée
- **Et** un événement `reassignment_resolved` est ajouté au journal avec le choix `accepted`
- **Et** le bandeau disparaît
- **Et** le dashboard ne marque plus mon ticket « en attente de réponse »

### 4. Refuser
- **Étant donné** que le bandeau de réaffectation est affiché
- **Quand** je touche « Refuser »
- **Alors** mon ticket garde son coiffeur, son heure et son rang
- **Et** un événement `reassignment_resolved` est ajouté au journal avec le choix `refused`
- **Et** le bandeau disparaît
- **Et** le dashboard ne marque plus mon ticket « en attente de réponse »

### 5. Répondre depuis la notification
- **Étant donné** que j'ai reçu la notification push de demande de réaffectation
- **Quand** je touche « Accepter » ou « Refuser » dans la notification
- **Alors** ma réponse est enregistrée comme depuis le bandeau

### 6. Sans réponse en 10 min, rien ne change
- **Étant donné** qu'une demande de réaffectation m'a été envoyée et que je n'ai pas répondu
- **Quand** 10 min se sont écoulées depuis `reassignment_requested_at`
- **Alors** mon ticket garde son coiffeur, son heure et son rang
- **Et** la demande est effacée (`reassignment_member_id` et `reassignment_requested_at` vides)
- **Et** un événement `reassignment_resolved` est ajouté au journal avec le choix `expired`
- **Et** le bandeau disparaît de ma page de suivi
- **Et** le dashboard ne marque plus mon ticket « en attente de réponse »
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

### 12. Sans consentement aux notifications de suivi
- **Étant donné** que je n'ai pas coché « Me prévenir »
- **Quand** une demande de réaffectation est créée pour mon ticket
- **Alors** la notification push n'est pas envoyée (marquée `skipped`, motif `no_consent`)
- **Et** le bandeau s'affiche si j'ouvre ma page de suivi avant l'échéance

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
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.ticket.reassignment.banner` | « Le salon propose un autre coiffeur » | APP_FLOW F-C5 |
| `client.ticket.reassignment.new_time` | _À rédiger (absent des docs)_ | Variables `firstName`, `time` |
| `client.ticket.reassignment.time_left` | _À rédiger (absent des docs)_ | Temps restant sur 10 min (DESIGN_SYSTEM `ReassignmentPrompt`) |
| `client.ticket.reassignment.accept` | « Accepter » | — |
| `client.ticket.reassignment.refuse` | « Refuser » | — |
| `notifications.reassignment_request.push` | _À rédiger (absent des docs)_ | Push seulement, deux actions « Accepter » et « Refuser » ; pas de modèle SMS |
| `pro-manager.reassign.delay_warning` | « L'heure du client reculerait de {minutes} min : il recevra une demande » | APP_FLOW F-M10 ; remplace le texte de S-13 |
| `pro-manager.board.ticket.awaiting_client_answer` | « en attente de réponse » | Partagé avec U-12 |
| `errors.queue.already_resolved` | _À rédiger (absent des docs)_ | Même code pour `cancel_ticket`, `resolve_stylist_change`, `respond_end_of_day` (TRD §6.2) |
| `errors.queue.invalid_transition` | _À rédiger (absent des docs)_ | Code commun |
| `errors.queue.forbidden` | _À rédiger (absent des docs)_ | Code commun |
| `errors.queue.reassignment_pending` | _À rédiger (absent des docs)_ | Côté gérant |
| `errors.queue.stylist_unavailable` | _À rédiger (absent des docs)_ | Côté gérant ; partagé avec U-04 |

## Questions ouvertes
- **BACKEND_SCHEMA §4.13 / TRD ADR-015** : à l'acceptation, quelle colonne fixe le nouveau coiffeur ? `requested_member_id` (ma préférence devient Sam), `estimated_member_id` (recalculé à chaque événement, donc la réaffectation ne tiendrait pas) ou `assigned_member_id` (réservé à l'appel) ? Si j'avais demandé Léa, l'acceptation remplace-t-elle ma demande ? (Question déjà posée dans S-13.)
- **PRD §5.1 / TRD §6.2** : l'heure proposée au moment de la demande peut avoir changé quand j'accepte. Si, à l'acceptation, Sam me ferait passer encore plus tard, ou s'il est devenu indisponible, que se passe-t-il ? Aucun code propre à `respond_reassignment` ne couvre ce cas (`stylist_unavailable` n'existe que pour `reassign_ticket`).
- **PRD §5.1 / §5.4** : « tout recul est expliqué ». Après une acceptation, une notification « Changement d'heure » (`estimate_changed`) part-elle, alors que j'ai déjà vu la nouvelle heure ? La dernière heure annoncée (`last_notified_start_at`) est-elle mise à jour à l'acceptation ?
- **PRD §5.4 / BACKEND_SCHEMA §4.16** : `reassignment_request` n'est pas un message indispensable ; sans la case « Me prévenir », la demande n'est pas poussée (scénario 12) et expire presque toujours. Est-ce voulu ? Faut-il en faire un message indispensable, ou au moins une exception au consentement comme pour l'inscription et « votre tour » ?
- **PRD §5.4 / APP_FLOW F-M10** : le gérant est-il informé du refus ou de l'expiration (autrement que par la fin de la mention « en attente de réponse ») ? Le dashboard doit-il distinguer « refusé » et « sans réponse » ?
- **PRD §5.2** : que devient une demande en cours si mon ticket est appelé par mon coiffeur actuel, si j'annule, ou si mon coiffeur actuel devient indisponible (choix U-12) pendant les 10 min ? Deux bandeaux (U-12 et U-17) peuvent-ils coexister ?
- **APP_FLOW F-M10 / S-13** : la réaffectation vaut-elle pour un rendez-vous (`kind = 'appointment'`) ? Quand un coiffeur part ou est désactivé, « ses rendez-vous restants sont à réaffecter par le gérant » (F-S3, F-M4) : si la nouvelle heure recule et que le client refuse ou ne répond pas, le rendez-vous reste-t-il chez un coiffeur absent ?
- **TRD §6.2** : quel statut de ticket peut recevoir une demande : seulement `waiting`, ou aussi `called` ? Le scénario 9 suppose `waiting` seulement.
- **TRD §6.2 / BACKEND_SCHEMA §4.13** : l'enum `reassignment_choice` (`accepted`, `refused`, `expired`) n'est rangé dans aucune colonne de `tickets` ; il ne figure que dans le journal (`ticket_events`, champs `after` ou `reason_code` ?). À préciser.
- **TRD §6.4 / BACKEND_SCHEMA §9** : la charge du message `ticket_updated` sur `ticket:{ticket_id}` est `{ version }` dans le TRD et `{ version, status }` dans le schéma. Laquelle tester (scénario 20) ?
- **S-13** : la story S-13 décrit encore l'ancien fonctionnement (`client_agreed`, case « Le client est d'accord », code `would_delay_client`), remplacé par E9 et `respond_reassignment`. Elle doit être réécrite.
- **Textes** : la notification push, la ligne « nouveau coiffeur, nouvelle heure » du bandeau, le temps restant et les messages d'erreur ne figurent dans aucun document.
