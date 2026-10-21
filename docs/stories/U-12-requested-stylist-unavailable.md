# U-12 · Choisir quand mon coiffeur demandé devient indisponible

**En tant que** client qui a demandé un coiffeur, **je veux** choisir « attendre » ou « premier disponible » quand ce coiffeur devient indisponible, **afin de** garder la main sur mon heure de passage.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1 (coiffeur demandé en option) (PRD §5.1) ; changer le coiffeur d'un client ne le fait jamais reculer, sauf accord du client (demande « accepter / refuser », E9) ; coiffeur demandé absent toute la journée ou désactivé : plus de choix « attendre », seulement « premier disponible » ou annuler (E7) ; même règle quand le gérant coupe « Je coiffe » (E8) ; même règle pour un client avec rendez-vous, le gérant voyant les rendez-vous touchés pour les réaffecter s'il le souhaite (E18) ; une pause du coiffeur ne déclenche pas ce choix (E25) ; le choix de coiffeur est un message indispensable, envoyé sans la case « Me prévenir » (E17) ; le SMS « votre tour » part toujours, même plafond atteint (E1) (PRD §5.1 « Autres règles ») ; transition 8 et statuts du coiffeur « En retard », « Absent », « Fin de journée » (PRD §5.2) ; décision n° 15 (PRD §11) ; notifications « Choix de coiffeur » (push, SMS si pas de push dans la limite du plafond) et « Demande de réaffectation » (PRD §5.4)
- Parcours : F-C5 (bandeaux « Votre coiffeur n'est plus disponible » et « Le salon propose un autre coiffeur ») et F-C10 (APP_FLOW §3) ; déclenché par F-S3 (« Fin de journée »), F-M4 (« Désactiver »), F-M6 (« Je coiffe ») et F-M8 (absence, retard, départ anticipé) ; réaffectation F-M10 (U-17) ; événements « Choix demandé » et « Demande de réaffectation » (APP_FLOW §7)
- Commandes et données : `resolve_stylist_change` (`ticket_id`, `choice` = `wait` | `first_available` ; codes `queue.already_resolved`, `queue.wait_not_offered` et codes communs, TRD §6.2) · `cancel_ticket` (U-08) · `respond_reassignment` (U-17) · déclencheurs `set_presence` (`absent`, `late`, `off_duty`), `set_hairdressing` et Edge Function `deactivate-member` · `queue-tick` (délai de 10 min) · tables `tickets` (`requested_member_id`, `stylist_change_pending_since`, `estimated_start_at`, `queue_rank`), `stylist_presence` (`status`, `expected_back_at`, `shift_end_at`), `ticket_events` (`stylist_change_requested`, `stylist_change_resolved`), `notifications` (`stylist_change_required`, variante `no_wait` quand « attendre » n'est pas proposé) · RPC `preview_presence_change` (rendez-vous à réaffecter, côté gérant)

## Scénarios

### 1. Coiffeur demandé déclaré en retard

- **Étant donné** que mon ticket demande Léa et que le gérant la déclare en retard, avec une heure d'arrivée prévue
- **Quand** la déclaration est confirmée
- **Alors** je reçois une notification push « Choix de coiffeur »
- **Et** si je n'ai pas de push actif, je la reçois par SMS, dans la limite de 3 SMS par ticket
- **Et** ma page de suivi affiche le bandeau « Votre coiffeur n'est plus disponible » avec « Attendre Léa » et sa nouvelle heure, et « Premier disponible » et son heure
- **Et** le dashboard marque mon ticket « en attente de réponse »
- **Et** un événement `stylist_change_requested` est ajouté au journal

### 2. Choisir « Premier disponible »

- **Étant donné** que le bandeau de choix est affiché
- **Quand** je touche « Premier disponible »
- **Alors** mon ticket ne demande plus Léa et sera pris par le premier coiffeur qui se libère et maîtrise ma prestation
- **Et** mon rang d'inscription ne change pas
- **Et** ma nouvelle heure de passage est affichée
- **Et** un événement `stylist_change_resolved` est ajouté au journal
- **Et** le dashboard ne marque plus mon ticket « en attente de réponse »

### 3. Choisir « Attendre »

- **Étant donné** que le bandeau de choix est affiché et que Léa est en retard
- **Quand** je touche « Attendre Léa »
- **Alors** mon ticket demande toujours Léa
- **Et** mon heure de passage est calculée à partir de son heure d'arrivée prévue
- **Et** un événement `stylist_change_resolved` est ajouté au journal

### 3 bis. Coiffeur absent toute la journée : pas de choix « attendre » (E7)

- **Étant donné** que mon ticket demande Léa
- **Quand** le gérant déclare Léa absente pour la journée
- **Alors** je reçois la notification « Choix de coiffeur » dans sa variante sans « attendre » (`stylist_change_required.no_wait`)
- **Et** ma page de suivi affiche le bandeau « Votre coiffeur n'est plus disponible » avec seulement « Premier disponible » (et son heure) et « Annuler ma place »
- **Et** le bouton « Attendre Léa » n'est pas proposé
- **Quand** je touche « Annuler ma place »
- **Alors** la confirmation d'annulation de U-08 s'ouvre

### 4. Sans réponse en 10 min, coiffeur absent toute la journée

- **Étant donné** que Léa est déclarée absente pour la journée et que je n'ai pas répondu au choix
- **Quand** 10 min se sont écoulées depuis la demande de choix
- **Alors** mon ticket passe automatiquement en « Premier disponible »
- **Et** mon rang d'inscription ne change pas
- **Et** un événement `stylist_change_resolved` est ajouté au journal

### 5. Sans réponse en 10 min, coiffeur en retard ou partant plus tôt

- **Étant donné** que Léa est déclarée en retard (ou partant plus tôt) et que je n'ai pas répondu au choix
- **Quand** 10 min se sont écoulées depuis la demande de choix
- **Alors** mon ticket demande toujours Léa

### 6. Réponse juste avant l'échéance

- **Étant donné** que la demande de choix date de 9 min et que Léa est absente pour la journée
- **Quand** je touche « Annuler ma place » puis « Oui, annuler »
- **Alors** mon ticket passe au statut « Annulé » avec le motif `client_cancelled`
- **Et** le passage automatique en « Premier disponible » ne s'applique pas à mon ticket

### 6 bis. « Attendre » refusé quand il n'est pas proposé

- **Étant donné** que Léa est absente pour la journée et que la demande de choix est en cours
- **Quand** une commande `resolve_stylist_change` arrive avec `choice` = `wait` (page restée ouverte, appel direct)
- **Alors** la commande est refusée avec `queue.wait_not_offered` et mon ticket n'est pas modifié
- **Et** le message d'erreur `queue.wait_not_offered` s'affiche

### 7. Coiffeur qui part plus tôt

- **Étant donné** que Léa déclare sa fin de journée à 17h00 et que plusieurs tickets la demandent
- **Quand** la fin de journée est confirmée
- **Alors** seuls les tickets qui la demandent et dépasseraient 17h00 reçoivent le choix
- **Et** les tickets qui la demandent et seraient servis avant 17h00 ne reçoivent pas de choix

### 8. Coiffeur désactivé (E7)

- **Étant donné** que mon ticket demande Léa
- **Quand** le gérant désactive le compte de Léa (départ du salon, `deactivate-member`)
- **Alors** je reçois la notification « Choix de coiffeur », variante `no_wait`
- **Et** le bandeau ne propose que « Premier disponible » et « Annuler ma place »
- **Et** sans réponse en 10 min, mon ticket passe automatiquement en « Premier disponible », sans changer de rang

### 8 bis. Gérant qui coupe « Je coiffe » (E8)

- **Étant donné** que mon ticket demande le gérant, qui coiffe
- **Quand** le gérant coupe l'interrupteur « Je coiffe » (`set_hairdressing`)
- **Alors** je reçois la notification « Choix de coiffeur », variante `no_wait`
- **Et** le bandeau ne propose que « Premier disponible » et « Annuler ma place »
- **Et** sans réponse en 10 min, mon ticket passe automatiquement en « Premier disponible », sans changer de rang

### 9. Pause : pas de choix demandé (E25)

- **Étant donné** que mon ticket demande Léa
- **Quand** Léa se met en pause
- **Alors** aucun choix de coiffeur ne m'est demandé
- **Et** si mon heure bouge de 10 min ou plus, je reçois seulement la notification de changement d'heure (U-10)

### 10. Tickets sans préférence redistribués sans choix

- **Étant donné** un ticket « Premier disponible » dont le coiffeur pressenti est Léa
- **Quand** Léa est déclarée absente
- **Alors** le ticket est redistribué automatiquement
- **Et** aucun choix n'est demandé à ce client

### 10 bis. Client avec rendez-vous dont le coiffeur devient indisponible (E18)

- **Étant donné** que j'ai un rendez-vous confirmé à 15h00 avec Léa
- **Quand** le gérant déclare Léa absente pour la journée
- **Alors** je reçois la notification « Choix de coiffeur » sans « attendre », comme un client de la file (E7, E18)
- **Et** ma page de suivi propose seulement « Premier disponible » et « Annuler ma place »
- **Et** l'aperçu de l'impact montre au gérant mon rendez-vous parmi les rendez-vous à réaffecter, avant qu'il confirme (F-M8)
- **Et** le gérant peut réaffecter mon rendez-vous à un autre coiffeur (U-17, S-13)

### 10 ter. Client appelé dont le coiffeur devient indisponible (en attente de E36)

- **Étant donné** que Léa m'a appelé et que mon arrivée n'est pas validée
- **Quand** le gérant déclare Léa absente
- **Alors** aucun choix ne m'est demandé : je passe en tête et je serai pris par le premier coiffeur libre (PRD §5.1, E6)
- **Et** la forme exacte de ce retour en tête (transition, marqueur `priority_since`) attend la réponse d'Ely à E36 ; aucun autre résultat n'est à tester avant

### 11. Choix depuis le lien SMS

- **Étant donné** que je suis mon ticket par `/t/:shortCode`, sans session
- **Quand** je touche « Premier disponible » dans le bandeau
- **Alors** mon choix est enregistré comme depuis l'app

### 11 bis. Bandeau de réaffectation (renvoi vers U-17)

- **Étant donné** que le gérant veut réaffecter mon ticket à un coiffeur chez qui mon heure de passage reculerait
- **Quand** il confirme la réaffectation (`reassign_ticket`)
- **Alors** mon ticket ne change ni de coiffeur ni d'heure tant que je n'ai pas accepté
- **Et** je reçois la notification push « Demande de réaffectation », sans SMS
- **Et** ma page de suivi affiche le bandeau « Le salon propose un autre coiffeur » avec la nouvelle heure, « Accepter » et « Refuser » (`respond_reassignment`)
- **Et** sans réponse en 10 min, rien ne change

### 12. Erreur `queue.already_resolved`

- **Étant donné** que le choix de mon ticket a déjà été résolu (j'ai déjà répondu, ou l'échéance des 10 min est passée)
- **Quand** une commande `resolve_stylist_change` est envoyée
- **Alors** elle est refusée et le ticket n'est pas modifié
- **Et** le message d'erreur `queue.already_resolved` s'affiche

### 12 bis. Erreur `queue.invalid_transition`

- **Étant donné** que mon ticket est clos (« Terminé », « Annulé » ou « Absent »)
- **Quand** une commande `resolve_stylist_change` est envoyée
- **Alors** elle est refusée et le ticket n'est pas modifié
- **Et** le message d'erreur `queue.invalid_transition` s'affiche

### 13. Plafond SMS atteint sans push

- **Étant donné** que je n'ai pas de push actif et que 3 SMS ont déjà été envoyés pour mon ticket
- **Quand** le choix de coiffeur m'est demandé
- **Alors** aucun SMS n'est envoyé (marqué `skipped`, motif `sms_cap_reached`)
- **Et** le bandeau de choix s'affiche à l'ouverture de ma page de suivi

### 13 bis. Sans la case « Me prévenir » (E17)

- **Étant donné** que je n'ai pas coché « Me prévenir » et que mon ticket demande Léa
- **Quand** Léa est déclarée en retard
- **Alors** la notification « Choix de coiffeur » part quand même, par push, ou par SMS si je n'ai pas de push actif dans la limite du plafond (message indispensable, E17)
- **Et** elle n'est pas marquée `skipped` avec le motif `no_consent`
- **Et** le bandeau de choix s'affiche sur ma page de suivi

### 14. Confidentialité côté salon

- **Étant donné** que mon ticket est marqué « en attente de réponse »
- **Quand** le gérant consulte le dashboard
- **Alors** il voit mon prénom et l'état « en attente de réponse »
- **Et** il ne voit pas mon numéro de téléphone

### 15. Le SMS de choix tient en un seul SMS

- **Étant donné** le modèle de SMS « Choix de coiffeur »
- **Quand** il est rempli avec un prénom de coiffeur de 30 caractères, un nom de salon de 80 caractères et le lien court `zelate.fr/t/xxxxxxxx`
- **Alors** le nom du salon est tronqué à 40 caractères et les accents sont translittérés
- **Et** le texte fait 160 caractères GSM-7 au plus

## Textes à prévoir

| Clé (anglais)                                            | Texte (français)                                                                                           | Contrainte                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `client.ticket.stylist_change.banner`                    | « Votre coiffeur n'est plus disponible »                                                                   | —                                                                                                                                                                                                                              |
| `client.ticket.stylist_change.wait`                      | Attendre {first_name}                                                                                      | Nouvelle heure affichée à côté ; doublon : `client.ticket.stylist_unavailable.wait`                                                                                                                                            |
| `client.ticket.stylist_change.option_time`               | Passage vers {time}                                                                                        | Heure de chaque option                                                                                                                                                                                                         |
| `client.ticket.stylist_change.no_answer_wait`            | Sans réponse dans les 10 min, vous continuez d'attendre {first_name}.                                      | Coiffeur en retard ou partant plus tôt                                                                                                                                                                                         |
| `client.ticket.stylist_change.no_answer_first_available` | Sans réponse dans les 10 min, vous passerez avec le premier coiffeur disponible.                           | Coiffeur absent toute la journée, désactivé, gérant qui ne coiffe plus (E7, E8)                                                                                                                                                |
| `client.ticket.stylist_change.first_available`           | « Premier disponible »                                                                                     | Heure affichée à côté                                                                                                                                                                                                          |
| `client.ticket.actions.cancel`                           | « Annuler ma place »                                                                                       | Seconde option quand « attendre » n'est pas proposé (E7, E8) ; partagé avec U-06, U-08                                                                                                                                         |
| `client.ticket.reassignment.banner`                      | « Le salon propose un autre coiffeur »                                                                     | Nouvelle heure affichée ; partagé avec U-17                                                                                                                                                                                    |
| `client.ticket.reassignment.accept`                      | « Accepter »                                                                                               | Partagé avec U-17                                                                                                                                                                                                              |
| `client.ticket.reassignment.refuse`                      | « Refuser »                                                                                                | Partagé avec U-17                                                                                                                                                                                                              |
| `notifications.reassignment_request.push`                | Voir `notifications.reassignment_request.push.*` dans le dictionnaire (2 textes)                           | Push seulement, avec « accepter / refuser » ; message indispensable (E17) ; partagé avec U-17                                                                                                                                  |
| `errors.queue.wait_not_offered`                          | Votre coiffeur n'est pas disponible aujourd'hui : choisissez « Premier disponible » ou annulez.            | `wait` alors qu'il n'est pas proposé (E7, E8)                                                                                                                                                                                  |
| `errors.queue.already_resolved`                          | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran.                         | Partagé avec U-08, U-11                                                                                                                                                                                                        |
| `errors.queue.invalid_transition`                        | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran.                             | Partagé avec U-07, U-08, U-11                                                                                                                                                                                                  |
| `notifications.stylist_change_required.push`             | Voir `notifications.stylist_change_required.push.*` dans le dictionnaire (2 textes)                        | Choix « attendre » ou « premier disponible » ; message indispensable (E17)                                                                                                                                                     |
| `notifications.stylist_change_required.no_wait.push`     | Voir `notifications.stylist_change_required.no_wait.push.*` dans le dictionnaire (2 textes)                | Sans « attendre » (E7, E8, E18)                                                                                                                                                                                                |
| `notifications.stylist_change_required.no_wait.sms`      | {salon_name} : {stylist_first_name} ne coiffe plus aujourd'hui. Premier disponible ou annuler : {link}     | SMS : 160 caractères GSM-7 au plus (au plus 154 avec 40 + 30 caractères et le lien court) ; dans le plafond de 3 SMS                                                                                                           |
| `notifications.stylist_change_required.sms`              | {salon_name} : {stylist_first_name} a un empêchement. Attendre ou premier disponible ? Choisissez : {link} | SMS : 160 caractères GSM-7 au plus, lien court `zelate.fr/t/xxxxxxxx`, nom du salon tronqué à 40, accents translittérés (K5) ; au plus 158 caractères avec un nom de salon de 40 et un prénom de 30 ; dans le plafond de 3 SMS |
| `pro-manager.board.ticket.awaiting_client_answer`        | En attente de réponse                                                                                      | Dashboard                                                                                                                                                                                                                      |

## Questions ouvertes

- **Résolu le 18/10** (E7) — « Attendre » pour un coiffeur absent toute la journée ou désactivé : non proposé ; seulement « Premier disponible » ou annuler ; voir scénarios 3 bis et 8.
- **Résolu le 18/10** (E7, PRD §5.2 transition 8) — Coiffeur désactivé et règle des 10 min : même règle qu'un coiffeur absent toute la journée, « premier disponible » sans réponse ; voir scénario 8.
- **Résolu le 18/10** (E8) — Gérant qui coupe « Je coiffe » : même règle qu'un coiffeur absent ; voir scénario 8 bis.
- **Résolu le 18/10** (BACKEND_SCHEMA v0.3) — Statut de la règle des 10 min : `stylist_change_pending_since` la décrit désormais comme décidée.
- **Résolu le 19/10** (E25 ; APP_FLOW v0.6 F-C5 corrigé) — Une pause ne déclenche pas le choix ; voir scénario 9. Question d'origine : F-C5 déclenche le bandeau « Votre coiffeur n'est plus disponible » quand le coiffeur demandé est « en retard, en pause ou partant plus tôt ». Le PRD (transition 8) et APP_FLOW §7 (« Choix demandé ») disent « absent, en retard ou partant plus tôt », et la pause n'entraîne qu'une notification de changement d'heure (scénario 9). La pause déclenche-t-elle le choix ?
- **Résolu le 19/10** (TRD v0.5 §6.2, constat 28) — Code de `wait` non proposé : `queue.wait_not_offered` ; voir scénario 6 bis.
- **Résolu le 19/10** (E18) — Client avec rendez-vous : il choisit comme les autres ; le gérant voit les rendez-vous touchés et peut les réaffecter ; voir scénario 10 bis. **Contradiction restante** : APP_FLOW F-S3 et F-M4 et le texte `pro-stylist.presence.end_of_day_appointments` (« Le gérant le réaffectera ») ne parlent que de la réaffectation par le gérant, sans le choix du client.
- **Rattachée à E36** (en attente d'Ely) — Client appelé dont le coiffeur devient indisponible : transition et marqueur de retour en tête (`priority_since`) ; voir scénario 10 ter.
- **PRD §5.1 / APP_FLOW F-C5** : un client qui a déjà une demande de choix en cours peut-il recevoir en même temps une demande de réaffectation (U-17) ? Lequel des deux bandeaux s'affiche ?
- **PRD §5.2** : si je choisis « Premier disponible » et qu'aucun autre coiffeur présent ne maîtrise ma prestation, que se passe-t-il (file complète pour moi, retour au choix) ?
- **PRD §5.2** : si j'ai choisi « Attendre » un coiffeur en retard et qu'il est ensuite déclaré absent pour la journée, un nouveau choix m'est-il demandé ?
- **PRD §5.2 / APP_FLOW F-C5** : faut-il afficher sur le bandeau le temps restant avant l'échéance des 10 min ? Le dictionnaire rappelle seulement la règle (`no_answer_wait`, `no_answer_first_available`), sans décompte.
- **Résolu le 19/10** (dictionnaire `client.json`, `notifications.json`) — Notification et SMS « Choix de coiffeur » rédigés, avec la variante `no_wait`.
