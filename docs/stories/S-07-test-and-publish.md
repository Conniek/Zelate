# S-07 · Tester le parcours et publier le salon

**En tant que** gérant, **je veux** tester le parcours complet avec un client fictif, puis publier mon salon une fois validé par la plateforme, **afin d'**ouvrir ma file aux clients en étant sûr que mon équipe et ma configuration fonctionnent.

- Priorité : I (PRD §5.3)
- Règles appliquées : H7 (arrivée validée par le code du ticket, utilisée pendant le test) ; validation à la main par la plateforme au pilote (PRD §11 n° 20) ; les tickets de test sont exclus des statistiques (BACKEND_SCHEMA §4.13)
- Parcours : F-M3 ; étapes F-M2 ; pendant le test, F-S4 à F-S7 (espace coiffeur) ou F-M6 (dashboard)
- Commandes et données : `create_test_ticket` (ignore l'état de la file, K24) · `call_ticket` · `confirm_arrival` · `start_service` · `complete_service` (écrit `setup_test_passed_at` pour un ticket `is_test`, K35) · `publish_salon` (K35) · tables `tickets` (`is_test`), `salons` (`status`, `setup_test_passed_at`, `published_at`), `salon_verifications` (`decision`), `salon_events` (`published`)

## Scénarios

### 1. Lancer un test

- **Étant donné** un gérant dont le salon n'est pas publié
- **Quand** il clique sur « Lancer un test »
- **Alors** la commande `create_test_ticket` est envoyée
- **Alors** un ticket fictif au prénom « Test », marqué `is_test`, apparaît chez le gérant
- **Alors** ce ticket apparaît aussi dans l'espace coiffeur
- **Alors** le ticket est créé alors que la file du salon non publié est fermée : `create_test_ticket` ignore l'état de la file (TRD §6.2, K24)

### 2. Dérouler le test jusqu'au bout

- **Étant donné** un ticket de test en attente
- **Quand** le gérant ou un coiffeur l'appelle, saisit son code de 5 caractères, commence puis termine la prestation
- **Alors** le ticket de test passe au statut `completed`
- **Alors** `setup_test_passed_at` est renseigné par `complete_service`, parce que le ticket terminé est `is_test` (TRD §6.2, K35)
- **Alors** la case « Test réussi » se coche toute seule dans la liste de contrôle

### 3. Le ticket de test est tenu à l'écart

- **Étant donné** un ticket de test, en cours ou terminé
- **Quand** les indicateurs du salon sont calculés
- **Alors** le ticket de test n'est pas compté
- **Alors** il ne bloque pas la règle « un seul ticket actif par client »

### 4. Publication impossible tant qu'une condition manque

- **Étant donné** un salon auquel il manque au moins un de ces points : dossier validé par la plateforme, test réussi, horaires renseignés, 1 coiffeur actif, 1 prestation
- **Quand** le gérant regarde le bouton « Publier mon salon »
- **Alors** le bouton est inactif
- **Alors** la liste de contrôle montre ce qui manque

### 4 bis. Publication demandée alors qu'une condition manque

- **Étant donné** un salon validé, avec des horaires, 1 coiffeur actif et 1 prestation active, mais sans test réussi
- **Quand** une commande `publish_salon` est envoyée
- **Alors** elle est refusée avec l'erreur `queue.salon_not_ready`, avec la liste des conditions manquantes dans `details.missing` (ici `setup_test`) (TRD §6.2, K35)
- **Alors** le message affiché nomme chaque condition manquante (`errors.queue.salon_not_ready_condition.<code>`)
- **Alors** le salon reste au statut `approved`

### 5. Dossier en attente de validation

- **Étant donné** un salon au statut `pending_review`, avec le test réussi et la configuration complète
- **Quand** le gérant regarde le bouton « Publier mon salon »
- **Alors** le bouton est inactif
- **Alors** la liste de contrôle affiche que le dossier est en cours de validation
- **Quand** une commande `publish_salon` est envoyée quand même
- **Alors** elle est refusée avec `queue.salon_not_ready`, `details.missing` contenant `verification`

### 6. Publier le salon

- **Étant donné** un salon validé par la plateforme, avec le test réussi, des horaires, au moins 1 coiffeur actif et au moins 1 prestation active
- **Quand** le gérant clique sur « Publier mon salon »
- **Alors** la commande `publish_salon` est envoyée (TRD §6.2, K35)
- **Alors** le salon passe au statut `published`
- **Alors** `published_at` est renseigné
- **Alors** l'événement `published` est inscrit au journal du salon
- **Alors** le salon devient visible des clients (liste, carte, fiche)
- **Alors** le gérant arrive sur `/dashboard`

### 7. Test demandé après la publication

- **Étant donné** un salon publié
- **Quand** une commande `create_test_ticket` est envoyée pour ce salon
- **Alors** la commande est refusée avec l'erreur `queue.salon_already_published` (TRD §6.2)
- **Alors** aucun ticket n'est créé

### 7 ter. Publier un salon déjà publié

- **Étant donné** un salon publié
- **Quand** une commande `publish_salon` est envoyée
- **Alors** elle est refusée avec l'erreur `queue.salon_already_published` (TRD §6.2, K35)
- **Alors** `published_at` ne change pas et aucun nouvel événement `published` n'est inscrit

### 7 quater. Seul le gérant publie

- **Étant donné** un coiffeur connecté d'un salon prêt à publier
- **Quand** une commande `publish_salon` est envoyée depuis son compte
- **Alors** elle est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)
- **Alors** le salon n'est pas publié

### 7 bis. Seul le gérant lance un test

- **Étant donné** un coiffeur connecté d'un salon non publié
- **Quand** une commande `create_test_ticket` est envoyée depuis son compte
- **Alors** la commande est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)
- **Alors** aucun ticket n'est créé

### 8. Double clic sur « Publier mon salon » ou « Lancer un test »

- **Étant donné** un salon prêt à publier
- **Quand** le gérant clique deux fois rapidement sur « Lancer un test »
- **Alors** un seul ticket de test est créé
- **Quand** il clique deux fois rapidement sur « Publier mon salon »
- **Alors** un seul événement `published` est inscrit au journal (même `command_id`, ADR-004)

## Textes à prévoir

| Clé (anglais)                                     | Texte (français)                                                                                                  | Contrainte                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pro-manager.setup.test.start`                    | « Lancer un test »                                                                                                | Libellé indicatif (APP_FLOW F-M3)                                                                                                                                                     |
| `pro-manager.setup.test.passed`                   | « Test réussi »                                                                                                   | Libellé indicatif (APP_FLOW F-M3)                                                                                                                                                     |
| `pro-manager.setup.test.ticket_name`              | « Test »                                                                                                          | Prénom du client fictif (APP_FLOW F-M3)                                                                                                                                               |
| `pro-manager.setup.publish`                       | « Publier mon salon »                                                                                             | Libellé indicatif (APP_FLOW F-M3)                                                                                                                                                     |
| `pro-manager.setup.checklist.<item>`              | Voir `pro-manager.setup.checklist.*` dans le dictionnaire (8 textes)                                              | Un libellé par condition : dossier validé, test réussi, horaires, 1 coiffeur actif, 1 prestation                                                                                      |
| `errors.queue.salon_already_published`            | « Votre salon est déjà publié : les tickets de test ne sont plus possibles. »                                     | Refus de `create_test_ticket` sur un salon publié (TRD §6.2) ; aussi renvoyé par `publish_salon` (K35), alors que le texte ne parle que des tickets de test (voir questions ouvertes) |
| `errors.queue.salon_not_ready`                    | « Votre salon n'est pas encore prêt à être publié : {missing}. »                                                  | Refus de `publish_salon` (K35) ; `{missing}` = liste des conditions de `details.missing`                                                                                              |
| `errors.queue.salon_not_ready_condition.<code>`   | Voir `errors.queue.salon_not_ready_condition.*` dans le dictionnaire (5 textes)                                   | Un texte par condition : `verification`, `setup_test`, `opening_hours`, `active_stylist`, `active_service`                                                                            |
| `pro-manager.setup.checklist.pending_review_hint` | « Votre dossier est en cours de validation : vous pourrez publier dès qu'il sera validé. »                        | Scénario 5                                                                                                                                                                            |
| `errors.queue.forbidden`                          | « Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. » | Code commun (TRD §6.2)                                                                                                                                                                |

## Questions ouvertes

- **APP_FLOW** : d'après F-M3, le ticket de test « apparaît sur le dashboard ». Mais les gardes de §2.3 renvoient un salon validé et non publié vers `/dashboard/setup`, et `/dashboard` demande un salon validé. Où le gérant voit-il et traite-t-il le ticket de test ? Peut-il tester avant que la plateforme ait validé le dossier ?
- **Résolu le 19/10** (K24, TRD §6.2) : `create_test_ticket` ignore l'état de la file ; le ticket de test est créé file fermée. **Reste ouvert (PRD / TRD)** : le coiffeur doit-il être « disponible » pour appeler le ticket de test (condition de la transition 2) ?
- **Résolu le 19/10** (K35, TRD §6.2) : la publication passe par la commande `publish_salon` (gérant), qui vérifie dossier validé, `setup_test_passed_at`, horaires, 1 coiffeur actif et 1 prestation active, et renvoie `salon_not_ready` (avec `details.missing`) ou `salon_already_published` ; `setup_test_passed_at` est écrit par `complete_service` sur un ticket `is_test`.
- **Résolu le 19/10** (K35, BACKEND_SCHEMA §4.7) : la condition « horaires » est la condition `opening_hours`, soit au moins un jour ouvert pour publier.
- **Dictionnaire (nouveau)** : `errors.queue.salon_already_published` dit « les tickets de test ne sont plus possibles », alors que `publish_salon` renvoie aussi ce code (K35). Faut-il un texte qui couvre les deux cas, ou un code distinct ?
- **PRD** : le test envoie-t-il des notifications (push, SMS) ? À qui ?
- **APP_FLOW** : que se passe-t-il si un test est abandonné en route ? Peut-on annuler un ticket de test ou en lancer plusieurs ?
- **APP_FLOW** : pour la condition « 1 coiffeur actif », le gérant qui a activé « Je coiffe » compte-t-il ?
- **Résolu le 18/10** (K1, TRD §6.2) : `create_test_ticket` sur un salon publié renvoie `queue.salon_already_published`.
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
