# U-04 · Rejoindre la file d'un salon

**En tant que** client, **je veux** rejoindre la file d'un salon en choisissant ma prestation, mon coiffeur (ou le premier disponible) et mon heure d'arrivée, **afin d'**obtenir une place et une heure de passage sans attendre sur place.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1 (file unique, coiffeur demandé en option), H2 (attente simulée coiffeur par coiffeur), H4 (règle des 10 min rappelée au récapitulatif), H6 (numéro jamais affiché au salon), H8 (heure d'arrivée déclarée) (PRD §5.1) ; un seul ticket actif tous salons confondus ; spécialité facultative, « je ne sais pas encore » accepté par tous les coiffeurs (E12) ; case « Me prévenir » décochée par défaut, à chaque inscription ; elle ne règle que les messages d'anticipation (votre tour approche, préparez-vous, changement d'heure, risque de fin de journée) ; les messages indispensables partent toujours (E17, remplace K11 ; consentement porté par le ticket, K18) (PRD §5.1 « Autres règles ») ; profil créé au premier passage par `join_queue` (K30) ; contact privé pour chaque ticket dont le numéro est connu (K28) ; coiffeur attribué seulement à l'appel (K39) ; transition 1, calcul de l'heure de passage, distribution règles 1 à 4, états de la file (PRD §5.2) ; notification « Inscription » (PRD §5.4) ; SMS en 160 caractères GSM-7 : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (K5, TRD §9)
- Parcours : F-C2 → F-C3 (étapes 1 à 5) → F-C5 et F-C9 (APP_FLOW §3) ; garde « ticket actif » (APP_FLOW §2.3) ; événement « Ticket créé » (APP_FLOW §7)
- Commandes et données : `join_queue` (`salon_id`, `service_id` ou `unknown_service`, `requested_member_id?`, `declared_arrival_at?`, `channel` = `app`, `notifications_consent` faux par défaut, `first_name?` obligatoire si le compte n'a pas encore de profil) · codes `queue.queue_closed`, `queue.queue_paused`, `queue.queue_full`, `queue.already_has_active_ticket`, `queue.service_unavailable`, `queue.stylist_unavailable` et codes communs (TRD §6.2) · tables `tickets` (`short_code`, `tracking_token`, `tracking_short_code`, `queue_rank`, `requested_member_id`, `estimated_member_id`, `assigned_member_id` (vide jusqu'à l'appel), `notifications_consent_at`, `planned_duration_minutes`, `declared_arrival_at`, `estimated_start_at`, `initial_estimated_start_at`, `channel`, `status`), `ticket_events` (`created`), `notifications` (`ticket_created` ; `status` = `skipped`, `skip_reason` = `no_consent` pour les seuls messages d'anticipation), `profiles` (création au premier passage, `is_guest` ; `tracking_consent_at` pour information), `private.ticket_contacts` (numéro du compte Auth, empreinte `phone_hash`), `private.processed_commands`

## Scénarios

### 1. Rejoindre la file avec « Premier disponible » et « Dès que possible »
- **Étant donné** que je suis connecté, que je n'ai aucun ticket actif et que la file du salon est ouverte et non complète
- **Quand** je choisis une prestation, je garde « Premier disponible » et « Dès que possible », je coche « Me prévenir quand mon tour approche » et je touche « Confirmer ma place »
- **Alors** un ticket au statut « En attente » est créé avec le canal `app`
- **Et** le ticket a un code de 5 caractères, un rang, un coiffeur pressenti et une heure de passage estimée
- **Et** aucun coiffeur ne lui est encore attribué (`assigned_member_id` vide jusqu'à l'appel, K39)
- **Et** mon numéro est rangé dans le contact privé du ticket (`private.ticket_contacts`, K28), jamais dans `tickets`
- **Et** l'heure annoncée à l'inscription est enregistrée (`initial_estimated_start_at`)
- **Et** un événement `created` est ajouté au journal du ticket
- **Et** l'écran « Mon ticket » s'ouvre (F-C5), avec la proposition d'installer l'app (F-C9)
- **Et** une notification d'inscription m'est envoyée par push, ou par SMS (SMS 1) si je n'ai pas de push actif, avec mon rang, mon heure, mon code et le lien court de suivi `zelate.fr/t/xxxxxxxx` (8 caractères)
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
- **Et** tous les coiffeurs du salon sont éligibles pour ce ticket, quelle que soit leur spécialité (E12)

### 5. Heure estimée affichée pour chaque coiffeur
- **Étant donné** que je suis à l'étape 2 « Coiffeur »
- **Quand** la liste s'affiche
- **Alors** « Premier disponible » est présélectionné
- **Et** chaque option (« Premier disponible » et chaque coiffeur) affiche l'heure de passage estimée qui lui correspond

### 6. Demander un coiffeur précis
- **Étant donné** qu'un coiffeur travaille aujourd'hui dans ce salon
- **Quand** je le choisis à l'étape 2 et que je confirme ma place
- **Alors** le ticket est réservé à ce coiffeur (`requested_member_id`)
- **Et** `assigned_member_id` reste vide jusqu'à l'appel (K39)
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

### 9. Tour arrivé avant l'heure déclarée (H8 ; dernier « Alors » en attente de E34)
- **Étant donné** que j'ai déclaré arriver vers 15h00 et que mon rang me ferait passer avant 15h00
- **Quand** un coiffeur se libère avant mon arrivée
- **Alors** le ticket éligible suivant est appelé à ma place
- **Et** je garde mon rang d'inscription
- **Et** je reprends la tête de file « dès mon arrivée » (PRD H8) : arrivée physique ou heure déclarée, à trancher par Ely (E34)

### 10. Récapitulatif avec la règle des 10 min
- **Étant donné** que j'ai terminé les étapes 1 à 4
- **Quand** l'étape 5 « Récapitulatif » s'affiche
- **Alors** je vois le salon, la prestation, le coiffeur (ou « Premier disponible ») et l'heure estimée
- **Et** je vois la règle d'appel « une fois appelé, vous avez 10 min pour arriver ; rappel à 5 min »
- **Et** la case « Me prévenir quand mon tour approche » est **décochée** (K11, E17)
- **Et** une explication indique que, sans elle, je reçois seulement les messages indispensables et pas les messages d'anticipation (APP_FLOW F-C3, E17)

### 11. Consentement aux notifications enregistré
- **Étant donné** que j'ai coché la case « Me prévenir quand mon tour approche »
- **Quand** je confirme ma place
- **Alors** la commande `join_queue` part avec `notifications_consent` vrai
- **Et** la date et l'heure de mon consentement aux notifications de suivi sont enregistrées sur ce ticket (`tickets.notifications_consent_at`, K18)
- **Et** mon dernier choix est recopié sur mon profil pour information (`profiles.tracking_consent_at`), sans servir à l'envoi

### 11 ter. Case décochée à chaque inscription (K18)
- **Étant donné** que j'avais coché « Me prévenir » pour mon ticket précédent, aujourd'hui terminé
- **Quand** j'arrive au récapitulatif d'une nouvelle inscription
- **Alors** la case est de nouveau décochée
- **Quand** je la laisse décochée et que je confirme ma place
- **Alors** le nouveau ticket n'a pas de consentement (`notifications_consent_at` vide)
- **Et** le consentement de mon ticket précédent ne s'applique pas au nouveau

### 11 bis. Case laissée décochée : seulement les messages indispensables
- **Étant donné** que je n'ai jamais donné mon consentement et que je laisse la case « Me prévenir quand mon tour approche » décochée
- **Quand** je confirme ma place
- **Alors** le ticket est créé comme au scénario 1
- **Et** aucun consentement n'est enregistré (`tickets.notifications_consent_at` reste vide)
- **Et** la notification d'inscription (`ticket_created`) m'est envoyée
- **Et** plus tard, la notification « votre tour » (`your_turn`) m'est envoyée quand un coiffeur m'appelle
- **Et** les autres notifications de suivi de ce ticket (« votre tour approche », « préparez-vous », changement d'heure…) ne partent pas : elles sont enregistrées `skipped` avec le motif `no_consent`

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

### 17. Erreur `queue.queue_paused`
- **Étant donné** que le gérant a mis la file en pause pendant que je remplissais les étapes
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur `queue.queue_paused` s'affiche avec le bouton « Salons proches », qui ouvre F-C1

### 17 bis. Erreur `queue.service_unavailable`
- **Étant donné** que la prestation que j'ai choisie à l'étape 1 n'est plus proposée par le salon au moment où je confirme
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur `queue.service_unavailable` s'affiche (suite du parcours : voir questions ouvertes)

### 17 ter. Erreur `queue.stylist_unavailable`
- **Étant donné** que j'ai demandé un coiffeur à l'étape 2 et qu'il a été déclaré absent avant que je confirme
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur `queue.stylist_unavailable` s'affiche
- **Et** je peux choisir « Premier disponible » avant de confirmer de nouveau (PRD §5.2 distribution, règle 1)

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
- **Quand** il est rempli avec un rang, une heure, un code et le lien court `zelate.fr/t/xxxxxxxx`, un prénom de 30 caractères et un nom de salon de 80 caractères
- **Alors** le nom du salon est tronqué à 40 caractères
- **Et** les accents et les caractères hors GSM-7 sont translittérés avant l'envoi
- **Et** le texte fait 160 caractères GSM-7 au plus

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.join.progress` | « {step}/{total} » (exemple APP_FLOW : « 1/5 ») | — |
| `common.actions.next` | « Suivant » | — |
| `client.join.service.unknown` | « Je ne sais pas encore » | — |
| `client.join.stylist.first_available` | « Premier disponible » | Présélectionné |
| `client.join.stylist.estimated_time` | Passage vers {time} | Variable `time` |
| `client.join.stylist.absent_today` | {first_name} ne travaille pas aujourd'hui. Nous avons choisi « Premier disponible » pour vous. | Variable `firstName` |
| `client.join.arrival.asap` | « Dès que possible » | Présélectionné |
| `client.join.arrival.around` | « J'arrive vers… » | Pas de 5 min |
| `client.join.summary.call_rule` | « une fois appelé, vous avez 10 min pour arriver ; rappel à 5 min » | Chiffres fixés par H4 |
| `legal.consent.tracking_notifications.label` | « Me prévenir quand mon tour approche » | Case décochée par défaut (K11) |
| `legal.consent.tracking_notifications.explanation` | Nous vous prévenons 30 min et 10 min avant votre tour, si votre heure change ou si la fermeture approche. Sans cette case, vous recevez seulement les messages indispensables, comme « C'est votre tour ». (APP_FLOW F-C3, indicatif : « sans elle, vous recevez seulement l'inscription et « votre tour » ») | — |
| `client.join.confirm` | « Confirmer ma place » | — |
| `client.join.guard.already_has_ticket` | « Vous avez déjà une place » | — |
| `client.join.view_my_ticket` | « Voir ma place » | — |
| `client.nearby_salons.link` | « Salons proches » | Partagé avec U-02, U-11 |
| `errors.queue.already_has_active_ticket` | Ce numéro a déjà une place en cours. Une seule place à la fois est possible. | — |
| `errors.queue.queue_closed` | La file est fermée : aucune nouvelle inscription n'est possible pour le moment. | — |
| `errors.queue.queue_full` | La file est complète pour aujourd'hui : les prochaines prestations finiraient après la fermeture. | — |
| `errors.queue.queue_paused` | La file est en pause : aucune nouvelle inscription pour le moment. Réessayez à sa reprise. | Partagé avec U-05 |
| `errors.queue.service_unavailable` | Cette prestation n'est plus proposée pour le moment. Choisissez-en une autre, puis réessayez. | — |
| `errors.queue.stylist_unavailable` | Ce coiffeur n'est pas disponible pour le moment. Choisissez-en un autre, puis réessayez. | — |
| `errors.queue.rate_limited` | Trop de demandes en peu de temps. Patientez quelques minutes, puis réessayez. | Partagé avec P-03 |
| `notifications.ticket_created.push` | Voir `notifications.ticket_created.push.*` dans le dictionnaire (2 textes) | Variables : rang, heure, code ; message indispensable (part sans consentement, K11) |
| `notifications.ticket_created.sms` | {salon_name} : inscription confirmée. {count, plural, =0 {Personne avant vous} one {# client avant vous} other {# clients avant vous}}, passage vers {time}. Code {code}. Suivi : {link} | SMS : 160 caractères GSM-7 au plus, avec rang, heure, code et lien court `zelate.fr/t/xxxxxxxx` ; prénom ≤ 30, nom du salon tronqué à 40, accents translittérés (K5) |

## Questions ouvertes
- **Résolu le 18/10** (K11) — Case de consentement : décochée par défaut ; sans elle, seuls `ticket_created` et `your_turn` partent, les autres notifications passent en `skipped` (`no_consent`) ; voir scénarios 10, 11 et 11 bis.
- **BACKEND_SCHEMA §4.1 et §4.16 / TRD §6.2 / APP_FLOW F-C3** : le consentement est porté par le profil (`tickets.notifications_consent_at`, K18) alors que la case est présentée, décochée, à chaque inscription (`notifications_consent` dans `join_queue`). Un client qui a consenti pour un ticket précédent voit-il la case décochée au ticket suivant ? S'il la laisse décochée, son consentement est-il retiré, ou reste-t-il valable (et toutes les notifications partent) ?
- **PRD §5.4 / BACKEND_SCHEMA §4.16** : sans consentement, la notification « Annulation par le salon » (`cancelled_by_salon`) n'est pas dans les messages indispensables : un client retiré par le salon ou annulé en fin de journée ne serait donc prévenu ni par push ni par SMS. Est-ce voulu ? (même question dans U-11)
- **TRD §6.2** : que recouvre exactement `queue.service_unavailable` (prestation désactivée, aucun coiffeur présent qui la maîtrise, autre) ? Et après cette erreur ou `queue.stylist_unavailable`, le client revient-il à l'étape 1 ou 2 ? APP_FLOW F-C3 ne prévoit de suite que pour `already_has_active_ticket`, `queue_closed`, `queue_paused` et `queue_full`.
- **PRD §5.2 règle 1 / APP_FLOW F-C3** : le PRD dit que le client « est prévenu avant validation et peut choisir “premier disponible” » ; APP_FLOW repasse automatiquement sur « premier disponible ». Lequel des deux s'applique ?
- **PRD §5.2 / BACKEND_SCHEMA** : aucune table ne dit si un coiffeur « travaille ce jour-là » (pas de planning par coiffeur). La présence vaut `offline` en début de journée pour tout le monde. « Absent ce jour-là » veut-il dire seulement le statut `absent` déclaré par le gérant ?
- **PRD §5.2 règle 4** : la liste des coiffeurs de l'étape 2 est-elle filtrée selon la spécialité requise par la prestation (quand elle en a une, E12) ? Un client peut-il demander un coiffeur qui ne maîtrise pas cette prestation ?
- **Résolu le 18/10** (E12) — « Je ne sais pas encore » : accepté par tous les coiffeurs ; voir scénario 4.
- **BACKEND_SCHEMA §4.13 / TRD ADR-015 et §6.2** : le schéma remplit `assigned_member_id` dès la création si un coiffeur est demandé ; TRD et PRD (transition 2) fixent l'attribution à l'appel. Laquelle des deux règles tester ?
- **PRD §5.2 « Complète »** : la file complète se calcule-t-elle pour tout le salon ou pour le coiffeur demandé ? L'heure d'arrivée déclarée entre-t-elle dans le calcul ? Peut-on déclarer une arrivée dont la prestation finirait après la fermeture ?
- **Résolu le 18/10** (K1) — File en pause : code `queue.queue_paused` (TRD §6.2), même suite que `queue_closed` (« Salons proches ») ; voir scénario 17.
- **BACKEND_SCHEMA §5 / PRD P-03** : `private.rate_limits` prévoit un plafond de « création de tickets », absent du PRD. Quelle valeur, et sur quelle clé (compte, IP) ?
- **PRD H8 / APP_FLOW F-S5** : comment valide-t-on l'arrivée d'un client qui n'est pas encore appelé ? APP_FLOW ne place la saisie du code que dans la carte « Appel en cours ».
- **Résolu le 18/10** (K5) — Place du lien dans le SMS : lien court `zelate.fr/t/xxxxxxxx` (8 caractères) résolu par `ticket-public` ; prénom ≤ 30, nom du salon tronqué à 40, accents translittérés ; voir scénario 21.
- **Textes** : le message d'absence du coiffeur, l'explication du consentement (APP_FLOW n'en donne qu'un libellé indicatif), les messages des erreurs et les modèles push et SMS d'inscription ne figurent dans aucun document.
