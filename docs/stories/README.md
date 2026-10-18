# User stories — Zelaté MVP

41 stories, une par exigence du [PRD v1.0](../PRD.md) §5.3, écrites le 18/10/2026 par l'agent `product-analyst` (lot REQ-2). Les rendez-vous du salon (règle H10) n'y figurent pas : ils attendent les réponses d'Ely et le PRD v1.1.

**État : brouillon.** Les scénarios sont prêts à relire ; les questions ci-dessous bloquent leur version définitive (porte 2).

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
| U-01 | [Découvrir les salons autour de soi](U-01-discover-salons.md) | I |
| U-02 | [Consulter la fiche d'un salon](U-02-salon-page.md) | I |
| U-03 | [S'identifier par numéro de téléphone](U-03-phone-sign-in.md) | I |
| U-04 | [Rejoindre la file d'un salon](U-04-join-queue.md) | I |
| U-05 | [Rejoindre la file en scannant le QR code du salon](U-05-join-queue-by-qr.md) | I |
| U-06 | [Suivre ma position et mon heure de passage](U-06-track-ticket.md) | I |
| U-07 | [Répondre à « votre tour approche »](U-07-answer-turn-approaching.md) | I |
| U-08 | [Annuler ma place](U-08-cancel-ticket.md) | I |
| U-09 | [Installer l'app et activer les notifications](U-09-install-app-and-enable-notifications.md) | I |
| U-10 | [Savoir pourquoi mon heure de passage change](U-10-explain-estimate-change.md) | S |
| U-11 | [Être prévenu du risque de ne pas être pris avant la fermeture](U-11-end-of-day-risk.md) | I |
| U-12 | [Choisir quand mon coiffeur demandé devient indisponible](U-12-requested-stylist-unavailable.md) | I |
| P-01 | [Valider ou refuser un salon](P-01-validate-salon.md) | I |
| P-02 | [Consulter le journal d'audit](P-02-audit-log.md) | I |
| P-03 | [Limiter les abus](P-03-abuse-limits.md) | S |

## Corrections déjà faites dans les documents (18/10)

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

## Questions à trancher

### Par Ely (règles métier)

| # | Question | Proposition | Stories |
| --- | --- | --- | --- |
| E1 | Le SMS « votre tour » part-il si le plafond de 3 SMS est déjà atteint ? | Oui, hors plafond, comme les annulations par le salon | C-04, U-06, U-11, U-12 |
| E2 | Un retard déclaré fait-il reculer le client dès sa réponse (F-C6) ou seulement quand le coiffeur choisit « Prendre le suivant » (transition 3) ? Un client appelé qui a annoncé 20 min de retard est-il libéré à 10 min ? | Recul seulement par « Prendre le suivant » ; un retard déclaré suspend la libération à 10 min jusqu'à l'heure annoncée | C-09, U-07 |
| E3 | Annuler une fois appelé : absence comptée, ou annulation libre ? | Annulation libre, sans absence comptée | U-08 |
| E4 | File en pause : les coiffeurs peuvent-ils encore appeler les inscrits ? | Oui : la pause bloque seulement les nouvelles inscriptions | S-08, C-04 |
| E5 | Fin de journée : fin de la plage en cours ou de la dernière ? À la fermeture, qui le gérant voit-il (tous les restants ou ceux qui ont dit « Je reste ») ? Que devient un client « servi » qui n'est pas pris avant minuit ? | Dernière plage ; tous les restants ; annulé avec excuses à la fin de la journée | S-15, U-11 |
| E6 | Client appelé ou en prestation quand son coiffeur est déclaré absent, désactivé ou coupé | Le client en prestation est terminé par le gérant ; le client appelé est repris en tête par le premier coiffeur libre | S-11, S-16 |
| E7 | « Attendre » est-il proposé quand le coiffeur demandé est absent toute la journée ou désactivé ? | Non : seulement « premier disponible » ou annuler | C-02, U-12 |
| E8 | « Je coiffe » coupé : que deviennent les clients qui demandaient le gérant ? | Même règle qu'un coiffeur absent (choix du client) | S-02 |
| E9 | Réaffectation qui recule l'heure : comment recueillir l'accord du client sans son numéro ? | Une notification « accepter / refuser » ; sans réponse en 10 min, pas de réaffectation | S-13 |
| E10 | Absences : avertissement à la 5e ou à la 6e ? Comptées par salon ou tous salons ? Par quel canal ? | À la 5e, tous salons, par notification | C-09, P-03 |
| E11 | Le seuil de 10 min d'écart se mesure par rapport à quelle heure ? Les petits écarts s'additionnent-ils ? | Par rapport à la dernière heure notifiée au client ; oui, ils s'additionnent | U-10, C-07 |
| E12 | Prestation obligatoire pour un walk-in ? Spécialité obligatoire pour une prestation ? « Je ne sais pas encore » éligible à tous les coiffeurs ? | Facultative (30 min par défaut) ; facultative ; oui | S-05, S-10, U-04, C-03 |
| E13 | « Position » affichée au client : rang dans tout le salon ou chez son coiffeur ? | Nombre de clients avant lui chez son coiffeur (pressenti ou demandé) | U-06 |
| E14 | SIRET introuvable ou inactif : dossier envoyé « à vérifier » ou bloqué ? | Envoyé « à vérifier », décision par l'admin | S-01, P-01 |
| E15 | « Terminer » oublié : le gérant peut-il clore une prestation depuis le dashboard ? | Oui, avec mention dans le journal | C-08 |
| E16 | Changement d'horaires ou de prestations le jour même : effet sur les tickets déjà en file ? | Les tickets existants gardent leur prestation ; les nouveaux horaires s'appliquent au calcul de fin de journée | S-03, S-05 |

### Par Koni (choix techniques)

| # | Question | Proposition | Stories |
| --- | --- | --- | --- |
| K1 | Rattacher chaque code d'erreur à ses commandes, et ajouter les codes manquants : file en pause, second appel en cours, droit insuffisant, retard hors 5-30 min, plafond de codes SMS, salon déjà publié | Tableau commande → codes dans TRD §6.2 | toutes |
| K2 | Aperçu de l'impact avant de déclarer une absence | RPC `preview_presence_change` qui exécute le moteur sans écrire | S-11 |
| K3 | Commandes absentes : régénérer le QR et produire le PDF, désactiver un coiffeur | `regenerate-qr` (Edge Function) et `deactivate-member` | S-06, S-16 |
| K4 | Délai maximal entre la révocation et la perte d'accès | Jetons d'accès de 15 min + refus côté serveur dès la révocation | S-16 |
| K5 | SMS en 160 caractères : longueurs maximales (prénom, nom du salon, adresse), caractères hors GSM-7, longueur du lien de suivi | Prénom ≤ 30, nom de salon ≤ 40 dans les SMS, translittération des accents, lien court `zelate.fr/t/xxxxxxxx` | C-04, U-04, U-06, S-10 |
| K6 | Temps réel pour les visiteurs sans ticket (fiche salon) et pour `/t/:token` | Canal public `salon-public:{id}` sans donnée personnelle ; `/t/:token` abonné à son ticket via le jeton | U-02, U-06, S-08 |
| K7 | Tolérance des tests sur les délais de `queue-tick` (exécuté chaque minute) | ±60 s | C-09 |
| K8 | Compteur d'absences : où le stocker, et comment compter les walk-ins dont le contact est effacé à 24 h ? | Table `private.no_show_counts` par `phone_hash` sur 30 jours glissants | C-09, P-03 |
| K9 | `get_salon_board` lisible par les coiffeurs : voulu ? | Non : réservé au gérant | S-09 |
| K10 | Anonymisation à 12 mois et journal inaltérable | Anonymiser hors du journal (le journal ne contient ni prénom ni texte libre) | P-02 |
| K11 | Case de consentement pré-cochée (RGPD) | Case décochée, le service reste utilisable par SMS | U-04 |
| K12 | Écrans sans exigence : compte client (F-C11) et journal du salon (`/dashboard/audit`) | Ajouter U-13 et S-17 au PRD | — |

### Textes à rédiger (REQ-3)

Tous les modèles push, SMS et e-mail, tous les messages `errors.*`, l'explication avant la demande de géolocalisation, le texte du consentement, les raisons d'un changement d'heure, les écrans de fin et les textes alternatifs des images. Les clés sont déjà listées dans chaque story.
