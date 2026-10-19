# User stories — Zelaté MVP

50 stories, une par exigence du [PRD v1.1](../PRD.md) §5.3, écrites le 18/10/2026 par l'agent `product-analyst` (lot REQ-2), puis mises à jour le même jour avec le PRD v1.1 (rendez-vous du salon, règle H10) et les réponses E1 à E16 et K1 à K12.

**État : définitif (19/10/2026).** Les questions E32 à E39 et K42 à K45 sont closes par leurs propositions, devenues décisions par défaut (Ely peut encore en réviser une). Ce qui reste noté « ouvert » dans une story est un détail réglé au fil du développement par le choix le plus simple, noté dans la PR.

~~Ancien état : brouillon.~~ Les scénarios sont prêts à relire ; les questions E32 à E39 (Ely) et K42 à K45 (Koni) restent à trancher ; le reste est du détail (porte 2).

## Conventions

- Une story par fichier, `<ID>-<slug-anglais>.md`, rédigée en français ; commandes, tables et clés en anglais.
- Un texte absent des documents est marqué « _À rédiger_ » ; il sera écrit en REQ-3, jamais inventé dans une story.
- Clés de texte : segments en `snake_case` ; notifications en `notifications.<template>.<push|sms|email>[.<title|body|subject>]` ; erreurs en `errors.queue.<code>` (TRD §9).
- Une question tranchée est marquée **Résolu le JJ/MM** dans la story concernée.

## Index

| ID | Story | Prio. |
| --- | --- | --- |
| S-01 | [Inscrire son salon](S-01-register-salon.md) | I |
| S-02 | [Interrupteur « Je coiffe »](S-02-hairdressing-toggle.md) | I |
| S-03 | [Horaires d'ouverture et fermetures exceptionnelles](S-03-opening-hours.md) | I |
| S-04 | [Ajouter ses coiffeurs](S-04-invite-stylists.md) | I |
| S-05 | [Définir ses prestations](S-05-define-services.md) | I |
| S-06 | [QR code de l'affiche du salon](S-06-qr-poster.md) | I |
| S-07 | [Tester le parcours et publier le salon](S-07-test-and-publish.md) | I |
| S-08 | [Ouvrir, mettre en pause et fermer la file](S-08-open-pause-close-queue.md) | I |
| S-09 | [Vue temps réel de la file et de l'équipe](S-09-live-board.md) | I |
| S-10 | [Inscrire un client présent au salon (walk-in)](S-10-walk-in-registration.md) | I |
| S-11 | [Déclarer un coiffeur absent, en retard ou partant plus tôt](S-11-stylist-absence.md) | I |
| S-12 | [Retirer un ticket de la file](S-12-remove-ticket.md) | I |
| S-13 | [Réaffecter un ticket à un autre coiffeur](S-13-reassign-ticket.md) | S |
| S-14 | [Récapitulatif de fin de journée](S-14-daily-summary.md) | S |
| S-15 | [Gérer la fin de journée](S-15-end-of-day.md) | I |
| S-16 | [Déconnecter à distance le compte d'un coiffeur](S-16-revoke-stylist-access.md) | I |
| S-17 | [Consulter le journal de son salon](S-17-salon-audit-log.md) | I |
| S-18 | [Saisir, modifier et annuler les rendez-vous du jour](S-18-manage-appointments.md) | I |
| S-19 | [Confirmer ou refuser un rendez-vous signalé par un client](S-19-confirm-checked-in-appointment.md) | I |
| C-01 | [Activer son compte et se connecter](C-01-activate-account.md) | I |
| C-02 | [Changer mon statut : disponible, pause, fin de journée](C-02-set-presence.md) | I |
| C-03 | [Voir ma file](C-03-view-my-queue.md) | I |
| C-04 | [Appeler le prochain client](C-04-call-next-client.md) | I |
| C-05 | [Valider l'arrivée par le code du ticket](C-05-confirm-arrival.md) | I |
| C-06 | [Commencer la prestation](C-06-start-service.md) | I |
| C-07 | [Ajuster la durée de la prestation en cours](C-07-adjust-duration.md) | I |
| C-08 | [Terminer la prestation](C-08-complete-service.md) | I |
| C-09 | [Gérer un client appelé qui n'arrive pas](C-09-called-client-no-show.md) | I |
| C-10 | [Voir mon bilan du jour](C-10-daily-summary.md) | S |
| C-11 | [Saisir ses rendez-vous et confirmer ceux qui se signalent pour lui](C-11-stylist-appointments.md) | I |
| U-01 | [Découvrir les salons autour de soi](U-01-discover-salons.md) | I |
| U-02 | [Consulter la fiche d'un salon](U-02-salon-page.md) | I |
| U-03 | [S'identifier par numéro de téléphone](U-03-phone-sign-in.md) | I |
| U-04 | [Rejoindre la file d'un salon](U-04-join-queue.md) | I |
| U-05 | [Rejoindre la file en scannant le QR code du salon](U-05-join-queue-by-qr.md) | I |
| U-06 | [Suivre ma position et mon heure de passage](U-06-track-ticket.md) | I |
| U-07 | [Répondre à « votre tour approche »](U-07-answer-turn-approaching.md) | I |
| U-08 | [Annuler ma place](U-08-cancel-ticket.md) | I |
| U-09 | [Installer l'app et activer les notifications](U-09-install-app-and-enable-notifications.md) | I |
| U-10 | [Savoir pourquoi mon heure de passage change](U-10-explain-estimate-change.md) | I |
| U-11 | [Être prévenu du risque de ne pas être pris avant la fermeture](U-11-end-of-day-risk.md) | I |
| U-12 | [Choisir quand mon coiffeur demandé devient indisponible](U-12-requested-stylist-unavailable.md) | I |
| U-13 | [Gérer son compte](U-13-client-account.md) | I |
| U-14 | [Se signaler à son arrivée pour un rendez-vous](U-14-check-in-appointment.md) | I |
| U-15 | [Être prévenu avant de partir quand le salon a du retard](U-15-appointment-delay-warning.md) | I |
| U-16 | [Voir le prochain créneau libre](U-16-next-free-slot.md) | I |
| U-17 | [Accepter ou refuser une réaffectation qui recule mon heure](U-17-answer-reassignment.md) | S |
| P-01 | [Valider ou refuser un salon](P-01-validate-salon.md) | I |
| P-02 | [Consulter le journal d'audit](P-02-audit-log.md) | I |
| P-03 | [Limiter les abus](P-03-abuse-limits.md) | I |

## Corrections faites dans les documents (18/10)

Ces contradictions venaient des documents eux-mêmes ; elles sont corrigées dans la même branche.

| Correction | Document | Stories concernées |
| --- | --- | --- |
| « Fermer la file » n'annule aucun ticket ; seule la fin de journée (H9) annule ; motif `queue_closed` retiré | PRD §5.2, §5.4 · BACKEND_SCHEMA `cancel_reason` | S-08, S-15, U-11 |
| Statut d'approche : confirmé à T-30, en retard de X min, sans réponse, arrivé (« pas parti » et « en route » demandaient un GPS) | APP_FLOW F-S4 | C-03, S-09 |
| Deux messages distincts : compte désactivé, ou simple déconnexion à distance | APP_FLOW §2.3, F-S2 | C-01, S-16 |
| Choix du client : « attendre » ou « premier disponible » | APP_FLOW F-M8 | S-11, U-12 |
| La règle des 10 min sans réponse est notée comme décidée (n° 15) | BACKEND_SCHEMA `stylist_change_pending_since` | C-02, U-12, S-11 |
| « Votre tour » peut repartir après « Prendre le suivant » (`dedupe_key` numéroté) | BACKEND_SCHEMA `notifications` | C-09 |
| Fenêtre de 2 h : valeur par défaut, réglable par salon après le pilote | PRD H9 | S-15, U-11 |
| Convention des clés de texte | TRD §9 | toutes |
| Libération d'un client qui a déclaré un retard : à l'heure annoncée si elle est plus tardive que les 10 min (E2), et non 10 min après | PRD §5.1, transition 7 | C-09, U-07 |
| File en pause : les coiffeurs continuent d'appeler (E4), aussi dans le tableau des états | PRD §5.2 | S-08, C-04 |
| Seuil « 10 min ou plus » partout (et non « au-delà de 10 min » ou « ±10 min ») | APP_FLOW F-S7, F-M10 · TRD §6.2 | C-07, S-13 |
| Pas de motif en texte libre pour une absence de coiffeur (K10) | APP_FLOW F-M8 | S-11 |
| `search_salons(…, query?)` renvoie `next_free_slots` ; `get_audit_log` a `type?` et `member_id?` ; `update_appointment` a `phone?` ; `appointment_pending` sur le canal du salon ; `ticket_updated { version, status }` | TRD §6.2 à §6.4 · BACKEND_SCHEMA §8.1, §9 | U-01, U-16, S-17, S-18, S-09 |

## Questions tranchées le 18/10

E1 à E16 (Ely) et K1 à K12 (Koni) : toutes les propositions ont été acceptées. Elles sont intégrées au [PRD v1.1](../PRD.md) (§5.1, §5.2, §11), au [TRD v0.3](../TRD.md), au [schéma v0.3](../BACKEND_SCHEMA.md) et à l'[APP_FLOW v0.3](../APP_FLOW.md), et marquées **Résolu le 18/10** dans chaque story.

## Questions ouvertes après la v1.1

Relevées par les agents en mettant les stories à jour. Chaque proposition est une piste, rien n'est décidé.

### Par Ely (règles métier)

| # | Question | Proposition | Stories |
| --- | --- | --- | --- |
| E17 | **Consentement** : sans la case « Me prévenir », seuls l'inscription et « votre tour » partent (K11). Le client ne serait donc prévenu ni d'une annulation par le salon (le PRD dit qu'elle part « toujours »), ni du rappel à 5 min, ni de sa place libérée, ni d'un choix de coiffeur à faire, ni d'une réaffectation, ni de la confirmation de son rendez-vous. Un walk-in ou un rendez-vous saisi par le salon n'a jamais vu la case (PRD §9 n° 9). | Messages indispensables = tout ce qui concerne le ticket en cours et demande une action ou annonce une fin (votre tour, rappel, place libérée, annulation, choix de coiffeur, réaffectation, rendez-vous confirmé ou refusé, retard sur rendez-vous). « Me prévenir » ne règle que les messages d'anticipation (votre tour approche, préparez-vous, changement d'heure, fin de journée). Walk-in et rendez-vous saisi : messages indispensables seulement, avec un lien pour activer « Me prévenir ». À faire valider par un avis RGPD. | U-04, U-06, U-11, U-12, U-15, U-17, S-10, S-11, S-12, S-15, S-18, C-09, P-03 |
| E18 | **Rendez-vous d'un coiffeur qui devient indisponible** (absent, désactivé, fin de journée) : le client reçoit-il le choix « attendre / premier disponible », ou le gérant réaffecte-t-il le rendez-vous ? | Même règle que les autres clients (choix du client, E7) ; le gérant voit les rendez-vous touchés et peut réaffecter | S-11, S-16, C-02, U-12 |
| E19 | **Rendez-vous « à confirmer » que personne ne traite** : combien de temps, et à la fermeture ? Le client peut-il l'annuler ? | Le client peut annuler ; rappel au gérant et au coiffeur après 10 min ; annulé avec excuses à la fermeture | U-14, S-19, S-15 |
| E20 | **Priorité d'un rendez-vous signalé** : les 10 min de R2 se comptent-elles depuis l'heure du rendez-vous, même si le salon confirme tard ? Une fois appelé, un client avec rendez-vous est-il libéré à 10 min comme les autres (H4) ? | Depuis l'heure du rendez-vous, une confirmation tardive ne le pénalise pas ; une fois appelé, H4 s'applique | U-14, C-03, C-09 |
| E21 | **Arrivée d'un client avec rendez-vous** : donne-t-il le code de son ticket comme les autres (H7) ? | Oui, à l'appel, y compris après confirmation d'un rendez-vous signalé | U-06, U-14, C-05 |
| E22 | **Prochain créneau libre** : qu'est-ce qu'un trou (temps libre après le dernier client, pauses, fin de journée du coiffeur) ? Quel créneau afficher sur la liste (le plus tôt, avec le nom de la prestation ?) ? Affiché quand la file est en pause, complète ou fermée ? | Un trou = temps libre d'un coiffeur présent, dans ses horaires, hors pauses, y compris après son dernier client ; sur la liste, le créneau le plus tôt avec sa prestation ; affiché seulement file ouverte ; ce n'est pas une réservation | U-01, U-02, U-16 |
| E23 | **Alertes de retard sur rendez-vous** : un saut de 5 à 25 min de retard donne-t-il une ou deux alertes ? Prévient-on si le salon rattrape son retard ? Les alertes s'arrêtent-elles à l'arrivée ? Texte « venez à » ou « venez vers » ? | Une seule alerte avec le retard actuel ; pas d'alerte de rattrapage ; arrêt à l'arrivée ou à l'appel ; « venez vers 14h20 » | U-15, C-07 |
| E24 | **Fin de journée** : à quelle heure est annulé un client « servi » non pris ? Que deviennent les rendez-vous restants à la fermeture ? Un ticket du matin est-il servi pendant la coupure de midi ? | Annulé à minuit (heure de Paris) avec excuses ; rendez-vous traités comme les autres clients restants ; la coupure n'annule rien, la file reprend à la plage suivante | S-15, U-11 |
| E25 | **Pause d'un coiffeur** : déclenche-t-elle le choix « attendre / premier disponible » (APP_FLOW F-C5 le dit, le PRD transition 8 non) ? | Non : seulement absent, en retard, part plus tôt ; F-C5 à corriger | U-12, C-02 |
| E26 | **Saisir un rendez-vous** pour un coiffeur absent, en pause ou hors de ses horaires, ou un autre jour que le jour même ? | Jour même seulement ; refusé hors des horaires du salon ; accepté pour un coiffeur en pause, avec un avertissement s'il est absent | S-18, C-11 |
| E27 | **Réaffectation** : le gérant voit-il un refus ou une expiration ? Que faire si l'heure a encore changé au moment où le client accepte ? Les rendez-vous se réaffectent-ils aussi ? | Le gérant voit « refusé » ou « sans réponse » ; l'acceptation vaut si l'heure ne recule pas de 10 min de plus, sinon nouvelle demande ; oui pour les rendez-vous | S-13, U-17 |
| E28 | **Avertissement d'absences** : renvoyé à chaque absence après la 5e ? Compte-t-il dans le plafond de SMS ? Le dashboard montre-t-il les absences d'un client faites dans d'autres salons ? | Une fois par période de 30 jours, hors plafond ; le dashboard ne montre aucun compteur d'absences du client (confidentialité) | P-03, C-09, S-09 |
| E29 | **Annuler ou refuser un rendez-vous** côté salon : motif obligatoire, comme un retrait ? | Oui, motif dans une liste ; le client reçoit le motif | S-12, S-18, S-19 |
| E30 | **« En retard de X min »** sur un rendez-vous : retard du salon ou du client ? À partir de combien ? | Retard du salon sur l'heure du rendez-vous, affiché dès 10 min | S-18, C-03, U-15 |
| E31 | **Position sur la fiche salon**, pour qui n'a pas encore de coiffeur (E13 vise le ticket) | Nombre de clients en attente au salon, et attente pour « premier disponible » | U-02 |

### Par Koni (choix techniques)

**Tranchées le 19/10** : K13 à K25 acceptées telles que proposées, plus K26 (raisons d'un changement d'heure : enum `estimate_change_reason`, textes uniques `common.change_reason.*`) et K27 (ligne `@zelate.fr #code` dans le SMS de connexion). Elles sont intégrées au [TRD v0.4](../TRD.md), au [schéma v0.4](../BACKEND_SCHEMA.md) et à l'[APP_FLOW v0.4](../APP_FLOW.md). Les stories seront relues avec les réponses d'Ely (E17 à E31), pour marquer ces questions résolues scénario par scénario.

### Tranchées le 19/10

- **Ely, E17 à E31** : toutes les propositions acceptées, intégrées au [PRD v1.2](../PRD.md) (§5.1, §5.2, §5.4, §11).
- **Koni, K28 à K41** (issues de la [revue d'architecture](../reviews/2026-10-19-architect-review.md)) : toutes acceptées, intégrées au TRD v0.5 et au schéma v0.5.
- **Encore ouvertes, pour Ely : E32 à E36** (partie E du doc « Questions à trancher ») : ouverture automatique de la file et fin de pause, rappel après un retard déclaré, heure déclarée (H8), signalement pendant une pause, client appelé repris en tête.

### Passe finale des stories (19/10)

Les 50 stories sont alignées sur le PRD v1.2, le TRD v0.5, le schéma v0.5 et l'APP_FLOW v0.7 : 212 questions marquées **Résolu le 19/10**. Ce qui reste ouvert dans les stories est surtout du détail d'écran ou de texte, à régler pendant les maquettes (DES-2) ou au développement. Les questions qui comptent encore :

**Pour Ely**
| # | Question | Proposition |
| --- | --- | --- |
| E32-E36 | Partie E du doc « Questions à trancher » | — |
| E37 | Le salon déplace un rendez-vous : le client sans « Me prévenir » doit-il être prévenu ? (le changement d'heure est un message d'anticipation) | Oui : un changement d'heure de **son** rendez-vous par le salon est un message indispensable |
| E38 | Motifs pour annuler ou refuser un rendez-vous : même liste que le retrait, ou liste dédiée ? | Liste dédiée : rendez-vous introuvable, coiffeur indisponible, demande du client, en double, autre |
| E39 | « Votre tour » dit « 10 min pour arriver » à un client qui a annoncé un retard plus long | Le message donne l'heure limite (« avant 14h50 ») au lieu de « 10 min » |

**Pour Koni**
| # | Question | Proposition |
| --- | --- | --- |
| K42 | Aucun écran ne permet au coiffeur d'activer le push de Zelaté Pro, alors qu'il reçoit `appointment_checked_in` | Proposition d'activation à la fin de F-S1 et dans le menu de l'espace coiffeur, via `push-subscribe` |
| K43 | Base de K13 pour un retard déclaré avant T-30 | `estimated_start_at` au moment de la déclaration + le retard |
| K44 | Fenêtre des plafonds (`rate_limits`) | Fenêtres fixes d'une heure ; plafond de création de tickets : 3 par heure et par numéro, 60 par heure et par salon pour l'accueil |
| K45 | Durée de session d'un client | Session Supabase de 30 jours glissants, comme le coiffeur |

### Textes à rédiger (REQ-3)

Tous les modèles push, SMS et e-mail (dont `appointment_confirmed`, `appointment_rejected`, `appointment_delay`, `reassignment_request`, `no_show_warning`), tous les messages `errors.*`, l'explication avant la demande de géolocalisation, le texte du consentement, les raisons d'un changement d'heure, les écrans de fin, la suppression du compte et les textes alternatifs des images. Les clés sont déjà listées dans chaque story.
