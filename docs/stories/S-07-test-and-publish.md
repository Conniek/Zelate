# S-07 · Tester le parcours et publier le salon

**En tant que** gérant, **je veux** tester le parcours complet avec un client fictif, puis publier mon salon une fois validé par la plateforme, **afin d'**ouvrir ma file aux clients en étant sûr que mon équipe et ma configuration fonctionnent.

- Priorité : I (PRD §5.3)
- Règles appliquées : H7 (arrivée validée par le code du ticket, utilisée pendant le test) ; validation à la main par la plateforme au pilote (PRD §11 n° 20) ; les tickets de test sont exclus des statistiques (BACKEND_SCHEMA §4.13)
- Parcours : F-M3 ; étapes F-M2 ; pendant le test, F-S4 à F-S7 (espace coiffeur) ou F-M6 (dashboard)
- Commandes et données : `create_test_ticket` · `call_ticket` · `confirm_arrival` · `start_service` · `complete_service` · tables `tickets` (`is_test`), `salons` (`status`, `setup_test_passed_at`, `published_at`), `salon_verifications` (`decision`), `salon_events` (`published`)

## Scénarios

### 1. Lancer un test
- **Étant donné** un gérant dont le salon n'est pas publié
- **Quand** il clique sur « Lancer un test »
- **Alors** la commande `create_test_ticket` est envoyée
- **Alors** un ticket fictif au prénom « Test », marqué `is_test`, apparaît chez le gérant
- **Alors** ce ticket apparaît aussi dans l'espace coiffeur

### 2. Dérouler le test jusqu'au bout
- **Étant donné** un ticket de test en attente
- **Quand** le gérant ou un coiffeur l'appelle, saisit son code de 5 caractères, commence puis termine la prestation
- **Alors** le ticket de test passe au statut `completed`
- **Alors** `setup_test_passed_at` est renseigné
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

### 5. Dossier en attente de validation
- **Étant donné** un salon au statut `pending_review`, avec le test réussi et la configuration complète
- **Quand** le gérant regarde le bouton « Publier mon salon »
- **Alors** le bouton est inactif

### 6. Publier le salon
- **Étant donné** un salon validé par la plateforme, avec le test réussi, des horaires, au moins 1 coiffeur actif et au moins 1 prestation
- **Quand** le gérant clique sur « Publier mon salon »
- **Alors** le salon passe au statut `published`
- **Alors** `published_at` est renseigné
- **Alors** l'événement `published` est inscrit au journal du salon
- **Alors** le salon devient visible des clients (liste, carte, fiche)
- **Alors** le gérant arrive sur `/dashboard`

### 7. Test demandé après la publication
- **Étant donné** un salon publié
- **Quand** une commande `create_test_ticket` est envoyée pour ce salon
- **Alors** la commande est refusée (contexte autorisé : « salon non publié », TRD §6.2)
- **Alors** aucun ticket n'est créé

### 8. Double clic sur « Publier mon salon » ou « Lancer un test »
- **Étant donné** un salon prêt à publier
- **Quand** le gérant clique deux fois rapidement sur « Lancer un test »
- **Alors** un seul ticket de test est créé

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.setup.test.start` | « Lancer un test » | Libellé indicatif (APP_FLOW F-M3) |
| `pro-manager.setup.test.passed` | « Test réussi » | Libellé indicatif (APP_FLOW F-M3) |
| `pro-manager.setup.test.ticketName` | « Test » | Prénom du client fictif (APP_FLOW F-M3) |
| `pro-manager.setup.publish` | « Publier mon salon » | Libellé indicatif (APP_FLOW F-M3) |
| `pro-manager.setup.checklist.<item>` | — (à rédiger) | Un libellé par condition : dossier validé, test réussi, horaires, 1 coiffeur actif, 1 prestation |
| `errors.queue.<code>` | — (à rédiger) | Refus de `create_test_ticket` sur un salon publié (code à définir) |

## Questions ouvertes
- **APP_FLOW** : d'après F-M3, le ticket de test « apparaît sur le dashboard ». Mais les gardes de §2.3 renvoient un salon validé et non publié vers `/dashboard/setup`, et `/dashboard` demande un salon validé. Où le gérant voit-il et traite-t-il le ticket de test ? Peut-il tester avant que la plateforme ait validé le dossier ?
- **PRD / TRD** : pour être créé, un ticket demande une « file ouverte et non complète » (transition 1), et un appel demande un coiffeur disponible. Pendant le test, faut-il que la file soit ouverte et le coiffeur « disponible » ? Peut-on ouvrir la file d'un salon non publié ?
- **PRD** : le test envoie-t-il des notifications (push, SMS) ? À qui ?
- **APP_FLOW** : que se passe-t-il si un test est abandonné en route ? Peut-on annuler un ticket de test ou en lancer plusieurs ?
- **APP_FLOW** : pour la condition « 1 coiffeur actif », le gérant qui a activé « Je coiffe » compte-t-il ?
- **TRD** : quel code d'erreur renvoie `create_test_ticket` sur un salon déjà publié ? TRD §6.2 ne dit pas quels codes chaque commande peut renvoyer.
- **BACKEND_SCHEMA** : la condition « horaires » (F-M3) veut-elle dire « au moins un jour ouvert » (BACKEND_SCHEMA §4.7) ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
