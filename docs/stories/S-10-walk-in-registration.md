# S-10 · Inscrire un client présent au salon (walk-in)

**En tant que** gérant, **je veux** inscrire en 10 s un client présent au salon (prénom, téléphone, prestation, coiffeur optionnel), **afin que** le client sans app ait sa place dans la file et reçoive par SMS une confirmation avec un lien de suivi.

- Priorité : I (PRD §5.3)
- Règles appliquées : seul le gérant inscrit un client présent au salon (PRD §5.1, §11 n° 16) ; un seul ticket actif par client, tous salons confondus (PRD §5.1) ; H6 (numéro jamais affiché) ; H3 et PRD §5.4 (3 SMS maximum par ticket, SMS d'inscription si pas de push) ; PRD §5.2 transition 1 ; métrique « temps d'inscription walk-in » médiane ≤ 10 s (PRD §8)
- Parcours : F-M7 ; F-M6 (bouton « + Client à l'accueil », raccourci `N`) ; suivi côté client F-C10 (lien SMS)
- Commandes et données : `register_walk_in` · tables `tickets` (`channel` = `front_desk`, `display_name`, `service_id`, `planned_duration_minutes`, `requested_member_id`, `created_by_member_id`, `tracking_token`), `private.ticket_contacts` (`phone_e164`, `phone_hash`, `is_active`), `notifications` (`ticket_created`, canal `sms`), `ticket_events` (`created`)

## Scénarios

### 1. Inscription nominale
- **Étant donné** une file ouverte et non complète, le gérant sur `/dashboard`
- **Quand** il clique sur « + Client à l'accueil »
- **Alors** la boîte « Client à l'accueil » s'ouvre avec le curseur dans le champ « Prénom »
- **Quand** il saisit le prénom et le téléphone, choisit une prestation, laisse « premier disponible » et appuie sur Entrée
- **Alors** la commande `register_walk_in` est envoyée
- **Alors** un ticket au canal `front_desk` est ajouté à la file du dashboard
- **Alors** le client reçoit un SMS avec son rang, son heure, son code de ticket et le lien de suivi
- **Alors** le gérant qui a inscrit le client est enregistré dans `created_by_member_id`
- **Alors** l'événement `created` est inscrit au journal du ticket

### 2. Inscription en 10 s au clavier
- **Étant donné** le dashboard ouvert
- **Quand** le gérant appuie sur `N`, tape le prénom, le téléphone, puis appuie sur Entrée
- **Alors** le ticket est créé sans que le gérant touche la souris
- **Alors** le temps entre l'ouverture de la boîte et la création du ticket est mesuré pour la métrique (médiane ≤ 10 s)

### 3. Numéro masqué dès l'enregistrement (confidentialité)
- **Étant donné** un ticket walk-in qui vient d'être créé
- **Quand** le gérant ou un coiffeur consulte la file, le ticket ou son panneau détail
- **Alors** le numéro du client n'est affiché nulle part
- **Alors** le numéro n'est enregistré que dans `private.ticket_contacts`, que l'API ne lit pas

### 4. Coiffeur demandé
- **Étant donné** la boîte « Client à l'accueil » ouverte
- **Quand** le gérant choisit le coiffeur Léa puis inscrit le client
- **Alors** le ticket demande Léa (`requested_member_id`)
- **Alors** le ticket apparaît dans la colonne de Léa et dans sa file sur son téléphone

### 5. Sans prestation choisie
- **Étant donné** la boîte « Client à l'accueil » ouverte
- **Quand** le gérant inscrit le client sans choisir de prestation
- **Alors** le ticket est créé avec une durée de calcul de 30 min (PRD §5.2, calcul de l'heure)

### 6. Numéro qui a déjà un ticket actif
- **Étant donné** un numéro qui a déjà un ticket actif, dans ce salon ou dans un autre
- **Quand** le gérant essaie d'inscrire un client avec ce numéro
- **Alors** le message de l'erreur `queue.already_has_active_ticket` s'affiche
- **Alors** aucun ticket n'est créé et aucun SMS n'est envoyé
- **Alors** le message ne nomme pas l'autre salon (isolation par salon)

### 7. File fermée ou en pause
- **Étant donné** une file fermée ou en pause
- **Quand** le gérant essaie d'inscrire un client
- **Alors** le message de l'erreur `queue.queue_closed` s'affiche
- **Alors** aucun ticket n'est créé

### 8. File complète
- **Étant donné** une file dont la prochaine prestation finirait après la fermeture
- **Quand** le gérant essaie d'inscrire un client
- **Alors** le message de l'erreur `queue.queue_full` s'affiche
- **Alors** aucun ticket n'est créé

### 9. Trop d'inscriptions en peu de temps
- **Étant donné** que le plafond de création de tickets est atteint
- **Quand** le gérant essaie d'inscrire un client
- **Alors** le message de l'erreur `queue.rate_limited` s'affiche
- **Alors** aucun ticket n'est créé

### 10. Numéro invalide ou non français
- **Étant donné** la boîte « Client à l'accueil » ouverte
- **Quand** le gérant saisit un numéro mal formé ou qui n'est pas un numéro +33
- **Alors** l'inscription est refusée avec un message sous le champ « Téléphone »
- **Alors** aucun SMS n'est envoyé

### 11. Prénom manquant ou trop long
- **Étant donné** la boîte « Client à l'accueil » ouverte
- **Quand** le prénom est vide ou fait plus de 30 caractères
- **Alors** l'inscription est refusée avec un message sous le champ « Prénom »

### 12. Le SMS d'inscription compte dans le plafond
- **Étant donné** un ticket walk-in créé, dont le client n'a pas de push actif
- **Quand** les SMS suivants du ticket partent (« préparez-vous », « votre tour »)
- **Alors** le SMS d'inscription compte comme le SMS 1 sur 3
- **Alors** aucun SMS au-delà du 3e n'est envoyé, sauf l'annulation par le salon (PRD §5.4)

### 13. Suivi par le lien du SMS
- **Étant donné** le client qui a reçu le SMS d'inscription
- **Quand** il ouvre le lien de suivi
- **Alors** il voit son ticket sans se connecter (F-C10)

### 14. Double appui sur Entrée
- **Étant donné** la boîte remplie
- **Quand** le gérant appuie deux fois rapidement sur Entrée
- **Alors** un seul ticket est créé et un seul SMS est envoyé

### 15. Un coiffeur ne peut pas inscrire un client
- **Étant donné** un coiffeur connecté sur son téléphone
- **Quand** il regarde son espace coiffeur
- **Alors** aucune action d'inscription à l'accueil ne lui est proposée
- **Quand** une commande `register_walk_in` est envoyée depuis son compte
- **Alors** la commande est refusée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.walk_in.open` | « + Client à l'accueil » | Libellé indicatif (APP_FLOW F-M6) ; raccourci `N` indiqué |
| `pro-manager.walk_in.title` | « Client à l'accueil » | Libellé indicatif (APP_FLOW F-M7) |
| `pro-manager.walk_in.first_name` | « Prénom » | 30 caractères maximum |
| `pro-manager.walk_in.phone` | « Téléphone » | +33 |
| `pro-manager.walk_in.service` | « Prestation » | — |
| `pro-manager.walk_in.stylist` | « Coiffeur » | — |
| `common.first_available` | « Premier disponible » | Partagée avec l'app client (F-C3) |
| `pro-manager.walk_in.submit` | « Inscrire » | Libellé indicatif (APP_FLOW F-M7) |
| `notifications.ticket_created.sms` | — (à rédiger) | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues ; contient rang, heure, code du ticket, lien de suivi (APP_FLOW §7) |
| `errors.queue.already_has_active_ticket` | — (à rédiger) | Ne nomme pas l'autre salon |
| `errors.queue.queue_closed` | — (à rédiger) | Partagée avec S-08 |
| `errors.queue.queue_full` | — (à rédiger) | Partagée avec S-08 |
| `errors.queue.rate_limited` | — (à rédiger) | — |
| `errors.validation.phone` | — (à rédiger) | Numéro +33 |
| `errors.validation.first_name` | — (à rédiger) | 1 à 30 caractères |

## Questions ouvertes
- **PRD / APP_FLOW** : le PRD liste « prénom, téléphone, prestation, coiffeur optionnel », alors qu'APP_FLOW F-M7 donne la prestation comme facultative. La prestation est-elle obligatoire pour un walk-in ?
- **PRD** : `join_queue` porte un consentement aux notifications, mais `register_walk_in` n'en porte pas. Or les consentements doivent être tracés (PRD §6). Comment le consentement d'un client inscrit à l'accueil est-il recueilli et enregistré ?
- **APP_FLOW** : la boîte propose-t-elle les coiffeurs absents ce jour-là ? Que se passe-t-il si le gérant en choisit un ? Pour un client, F-C3 le prévient et le renvoie vers « premier disponible ».
- **APP_FLOW / TRD** : le SMS d'inscription doit contenir rang, heure, code et lien. Le lien seul fait déjà au moins 56 caractères (domaine + `/t/` + jeton de 32 octets en base64url, soit 43 caractères). Tout cela tient-il en 160 caractères GSM-7, nom du salon compris ? Le nom du salon fait-il partie du SMS ?
- **TRD** : le plafond de création de tickets (`rate_limits`) n'a pas de valeur chiffrée. Quel seuil s'applique pour `queue.rate_limited` ?
- **TRD** : si le client a déjà un compte client avec ce numéro, le ticket walk-in est-il rattaché à son compte (`client_id` est vide pour un walk-in) ? Le client le voit-il dans `/ticket` après s'être connecté par code SMS ?
- **TRD** : quel code d'erreur reçoit un compte non autorisé (coiffeur) qui envoie `register_walk_in` ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
