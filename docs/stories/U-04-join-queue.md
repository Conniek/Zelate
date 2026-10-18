# U-04 · Rejoindre la file d'un salon

**En tant que** client, **je veux** rejoindre la file d'un salon en choisissant ma prestation, mon coiffeur (ou le premier disponible) et mon heure d'arrivée, **afin d'**obtenir une place et une heure de passage sans attendre sur place.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1 (file unique, coiffeur demandé en option), H2 (attente simulée coiffeur par coiffeur), H4 (règle des 10 min rappelée au récapitulatif), H6 (numéro jamais affiché au salon), H8 (heure d'arrivée déclarée) (PRD §5.1) ; un seul ticket actif tous salons confondus (PRD §5.1 « Autres règles ») ; transition 1, calcul de l'heure de passage, distribution règles 1 à 4, états de la file (PRD §5.2) ; notification « Inscription » (PRD §5.4)
- Parcours : F-C2 → F-C3 (étapes 1 à 5) → F-C5 et F-C9 (APP_FLOW §3) ; garde « ticket actif » (APP_FLOW §2.3) ; événement « Ticket créé » (APP_FLOW §7)
- Commandes et données : `join_queue` (`salon_id`, `service_id` ou `unknown_service`, `requested_member_id?`, `declared_arrival_at?`, `channel` = `app`, `notifications_consent`) · tables `tickets` (`short_code`, `tracking_token`, `queue_rank`, `requested_member_id`, `estimated_member_id`, `planned_duration_minutes`, `declared_arrival_at`, `estimated_start_at`, `initial_estimated_start_at`, `channel`, `status`), `ticket_events` (`created`), `notifications` (`ticket_created`), `profiles` (`tracking_consent_at`), `private.ticket_contacts`, `private.processed_commands`

## Scénarios

### 1. Rejoindre la file avec « Premier disponible » et « Dès que possible »
- **Étant donné** que je suis connecté, que je n'ai aucun ticket actif et que la file du salon est ouverte et non complète
- **Quand** je choisis une prestation, je garde « Premier disponible » et « Dès que possible », je laisse cochée « Me prévenir quand mon tour approche » et je touche « Confirmer ma place »
- **Alors** un ticket au statut « En attente » est créé avec le canal `app`
- **Et** le ticket a un code de 5 caractères, un rang, un coiffeur pressenti et une heure de passage estimée
- **Et** l'heure annoncée à l'inscription est enregistrée (`initial_estimated_start_at`)
- **Et** un événement `created` est ajouté au journal du ticket
- **Et** l'écran « Mon ticket » s'ouvre (F-C5), avec la proposition d'installer l'app (F-C9)
- **Et** une notification d'inscription m'est envoyée par push, ou par SMS (SMS 1) si je n'ai pas de push actif, avec mon rang, mon heure, mon code et le lien de suivi
- **Et** le ticket apparaît dans la liste « Ensuite » du coiffeur pressenti et sur le dashboard du salon

### 2. Indicateur de progression et retour arrière
- **Étant donné** que je suis à l'étape 3 « Heure d'arrivée » après avoir choisi une prestation et un coiffeur
- **Quand** je reviens à l'étape 1 puis que j'avance de nouveau
- **Alors** l'indicateur de progression affiche l'étape en cours (exemple « 1/5 »)
- **Et** la prestation et le coiffeur choisis sont toujours sélectionnés

### 3. Prestation obligatoire pour avancer
- **Étant donné** que je suis à l'étape 1 « Prestation »
- **Quand** je n'ai encore rien sélectionné
- **Alors** « Suivant » est inactif
- **Quand** je sélectionne une prestation ou « Je ne sais pas encore »
- **Alors** « Suivant » s'active

### 4. « Je ne sais pas encore » : 30 min pour le calcul
- **Étant donné** que je choisis « Je ne sais pas encore » à l'étape 1
- **Quand** je confirme ma place
- **Alors** le ticket est créé sans prestation
- **Et** sa durée prévue pour le calcul est de 30 min

### 5. Heure estimée affichée pour chaque coiffeur
- **Étant donné** que je suis à l'étape 2 « Coiffeur »
- **Quand** la liste s'affiche
- **Alors** « Premier disponible » est présélectionné
- **Et** chaque option (« Premier disponible » et chaque coiffeur) affiche l'heure de passage estimée qui lui correspond

### 6. Demander un coiffeur précis
- **Étant donné** qu'un coiffeur travaille aujourd'hui dans ce salon
- **Quand** je le choisis à l'étape 2 et que je confirme ma place
- **Alors** le ticket est réservé à ce coiffeur (`requested_member_id`)
- **Et** mon ticket affiche le prénom de ce coiffeur
- **Et** dans l'espace de ce coiffeur, le ticket porte la mention « vous a demandé »

### 7. Coiffeur demandé absent ce jour-là
- **Étant donné** qu'un coiffeur du salon est absent aujourd'hui
- **Quand** je le choisis à l'étape 2
- **Alors** un message m'indique qu'il est absent aujourd'hui
- **Et** la sélection revient sur « Premier disponible »

### 8. Heure d'arrivée déclarée
- **Étant donné** que je suis à l'étape 3 « Heure d'arrivée »
- **Quand** je choisis « J'arrive vers… » puis 15h00 dans le sélecteur
- **Alors** le sélecteur ne propose que des heures par pas de 5 min, comprises dans la journée d'ouverture du salon
- **Et** l'heure déclarée est enregistrée sur le ticket (`declared_arrival_at`)
- **Et** l'attente affichée est calculée à partir de l'heure la plus tardive entre mon heure de passage simulée et 15h00, arrondie aux 5 min supérieures

### 9. Tour arrivé avant l'heure déclarée (H8)
- **Étant donné** que j'ai déclaré arriver vers 15h00 et que mon rang me ferait passer avant 15h00
- **Quand** un coiffeur se libère avant mon arrivée
- **Alors** le ticket éligible suivant est appelé à ma place
- **Et** je garde mon rang d'inscription
- **Et** je redeviens le premier ticket éligible dès que mon arrivée est validée par le code de mon ticket

### 10. Récapitulatif avec la règle des 10 min
- **Étant donné** que j'ai terminé les étapes 1 à 4
- **Quand** l'étape 5 « Récapitulatif » s'affiche
- **Alors** je vois le salon, la prestation, le coiffeur (ou « Premier disponible ») et l'heure estimée
- **Et** je vois la règle d'appel « une fois appelé, vous avez 10 min pour arriver ; rappel à 5 min »
- **Et** la case « Me prévenir quand mon tour approche » est cochée, avec une explication

### 11. Consentement aux notifications enregistré
- **Étant donné** que la case « Me prévenir quand mon tour approche » est cochée
- **Quand** je confirme ma place
- **Alors** la date et l'heure de mon consentement aux notifications de suivi sont enregistrées (`profiles.tracking_consent_at`)

### 12. Étape d'identification sautée si je suis déjà connecté
- **Étant donné** que je suis déjà connecté
- **Quand** je passe l'étape 3
- **Alors** l'étape 4 « Identification » n'est pas affichée et j'arrive directement au récapitulatif

### 13. Erreur `queue.already_has_active_ticket`
- **Étant donné** que j'ai déjà un ticket actif dans un autre salon, créé depuis l'app ou par une inscription à l'accueil avec mon numéro
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun second ticket n'est créé
- **Et** un message d'erreur s'affiche avec le bouton « Voir ma place »
- **Quand** je touche « Voir ma place »
- **Alors** mon ticket actif s'ouvre (F-C5)

### 14. Garde de navigation : ticket déjà actif
- **Étant donné** que je suis connecté avec un ticket actif
- **Quand** j'ouvre `/salons/:slug/join`
- **Alors** je suis redirigé vers `/ticket`
- **Et** le message « Vous avez déjà une place » s'affiche

### 15. Erreur `queue.queue_closed`
- **Étant donné** que le gérant a fermé la file pendant que je remplissais les étapes
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun ticket n'est créé
- **Et** un message d'erreur s'affiche avec le bouton « Salons proches », qui ouvre F-C1

### 16. Erreur `queue.queue_full`
- **Étant donné** que la file est devenue complète (la prochaine prestation finirait après la fermeture)
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun ticket n'est créé
- **Et** un message d'erreur s'affiche avec le bouton « Salons proches », qui ouvre F-C1

### 17. File mise en pause pendant l'inscription
- **Étant donné** que le gérant a mis la file en pause pendant que je remplissais les étapes
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun ticket n'est créé
- **Et** un message d'erreur s'affiche (code à préciser, voir questions ouvertes)

### 18. Erreur `queue.rate_limited`
- **Étant donné** que le plafond de création de tickets est atteint
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun ticket n'est créé
- **Et** un message m'indique de réessayer plus tard

### 19. Double appui sur « Confirmer ma place »
- **Étant donné** que je suis au récapitulatif
- **Quand** je touche deux fois de suite « Confirmer ma place »
- **Alors** le bouton affiche un état de chargement et se désactive dès le premier appui
- **Et** un seul ticket est créé

### 20. Confidentialité : le numéro n'est jamais montré au salon
- **Étant donné** que mon ticket vient d'être créé
- **Quand** le coiffeur pressenti consulte sa file et que le gérant consulte le dashboard
- **Alors** ils voient mon prénom et ma prestation
- **Et** ni l'un ni l'autre ne voit mon numéro de téléphone, ni sur l'écran ni dans les données reçues

### 21. Le SMS d'inscription tient en un seul SMS
- **Étant donné** le modèle de SMS « Inscription » (SMS 1)
- **Quand** il est rempli avec un rang, une heure, un code et le lien de suivi aux longueurs maximales
- **Alors** le texte fait 160 caractères GSM-7 au plus

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.join.progress` | « {step}/{total} » (exemple APP_FLOW : « 1/5 ») | — |
| `common.actions.next` | « Suivant » | — |
| `client.join.service.unknown` | « Je ne sais pas encore » | — |
| `client.join.stylist.first_available` | « Premier disponible » | Présélectionné |
| `client.join.stylist.estimated_time` | _À rédiger (absent des docs)_ | Variable `time` |
| `client.join.stylist.absent_today` | _À rédiger (absent des docs)_ | Variable `firstName` |
| `client.join.arrival.asap` | « Dès que possible » | Présélectionné |
| `client.join.arrival.around` | « J'arrive vers… » | Pas de 5 min |
| `client.join.summary.call_rule` | « une fois appelé, vous avez 10 min pour arriver ; rappel à 5 min » | Chiffres fixés par H4 |
| `legal.consent.tracking_notifications.label` | « Me prévenir quand mon tour approche » | Case cochée par défaut (voir questions) |
| `legal.consent.tracking_notifications.explanation` | _À rédiger (absent des docs)_ | — |
| `client.join.confirm` | « Confirmer ma place » | — |
| `client.join.guard.already_has_ticket` | « Vous avez déjà une place » | — |
| `client.join.view_my_ticket` | « Voir ma place » | — |
| `client.nearby_salons.link` | « Salons proches » | Partagé avec U-02, U-11 |
| `errors.queue.already_has_active_ticket` | _À rédiger (absent des docs)_ | — |
| `errors.queue.queue_closed` | _À rédiger (absent des docs)_ | — |
| `errors.queue.queue_full` | _À rédiger (absent des docs)_ | — |
| `errors.queue.rate_limited` | _À rédiger (absent des docs)_ | Partagé avec U-03, P-03 |
| `notifications.ticket_created.push` | _À rédiger (absent des docs)_ | Variables : rang, heure, code |
| `notifications.ticket_created.sms` | _À rédiger (absent des docs)_ | SMS : 160 caractères GSM-7 au plus, avec rang, heure, code et lien `/t/:shortCode` |

## Questions ouvertes
- **PRD §5.4 / TRD §8 / legal** : la case de consentement est **cochée par défaut** (APP_FLOW F-C3). Une case pré-cochée vaut-elle consentement au sens du RGPD, alors que TRD §8 parle d'un traitement « nécessaire au service » ? Si le client décoche la case, quelles notifications partent encore ? `notification_status` = `skipped` avec `no_consent` laisse penser qu'aucune ne part, pas même le SMS « votre tour ».
- **PRD §5.2 règle 1 / APP_FLOW F-C3** : le PRD dit que le client « est prévenu avant validation et peut choisir “premier disponible” » ; APP_FLOW repasse automatiquement sur « premier disponible ». Lequel des deux s'applique ?
- **PRD §5.2 / BACKEND_SCHEMA** : aucune table ne dit si un coiffeur « travaille ce jour-là » (pas de planning par coiffeur). La présence vaut `offline` en début de journée pour tout le monde. « Absent ce jour-là » veut-il dire seulement le statut `absent` déclaré par le gérant ?
- **PRD §5.2 règle 4** : la liste des coiffeurs de l'étape 2 est-elle filtrée selon la spécialité requise par la prestation ? Un client peut-il demander un coiffeur qui ne maîtrise pas cette prestation ?
- **PRD §5.2** : avec « Je ne sais pas encore », quels coiffeurs sont éligibles, puisque aucune spécialité n'est requise ?
- **BACKEND_SCHEMA §4.13 / TRD ADR-015 et §6.2** : le schéma remplit `assigned_member_id` dès la création si un coiffeur est demandé ; TRD et PRD (transition 2) fixent l'attribution à l'appel. Laquelle des deux règles tester ?
- **PRD §5.2 « Complète »** : la file complète se calcule-t-elle pour tout le salon ou pour le coiffeur demandé ? L'heure d'arrivée déclarée entre-t-elle dans le calcul ? Peut-on déclarer une arrivée dont la prestation finirait après la fermeture ?
- **TRD §6.2** : aucun code d'erreur ne correspond à une file en pause (`queue_paused` n'existe pas). Faut-il renvoyer `queue.queue_closed` ?
- **BACKEND_SCHEMA §5 / PRD P-03** : `private.rate_limits` prévoit un plafond de « création de tickets », absent du PRD. Quelle valeur, et sur quelle clé (compte, IP) ?
- **PRD H8 / APP_FLOW F-S5** : comment valide-t-on l'arrivée d'un client qui n'est pas encore appelé ? APP_FLOW ne place la saisie du code que dans la carte « Appel en cours ».
- **Textes** : le message d'absence du coiffeur, l'explication du consentement, les messages des quatre erreurs et les modèles push et SMS d'inscription ne figurent dans aucun document. Le lien de suivi (jeton de 32 octets en base64url, soit 43 caractères) réduit beaucoup la place disponible dans les 160 caractères.
