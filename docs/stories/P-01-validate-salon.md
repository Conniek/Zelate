# P-01 · Valider ou refuser un salon

**En tant qu'**administrateur de la plateforme, **je veux** valider ou refuser à la main chaque dossier de salon en voyant le résultat de la vérification SIRET, **afin que** seuls des salons légitimes soient publiés.

- Priorité : I (PRD §5.3)
- Règles appliquées : décision n° 20 « validation à la main au pilote, automatique en V1 » (PRD §11) ; SIRET vérifié en ligne, code NAF 96.02A ou B, sinon dossier « à vérifier » (PRD §5.3 S-01) ; un SIRET introuvable ou inactif n'empêche pas l'envoi du dossier : il part « à vérifier » et l'équipe Zelaté décide (E14, PRD §5.1) ; persona « Admin plateforme » : valider les salons légitimes (PRD §3)
- Parcours : F-A1 (`/admin/salons`, `/admin/salons/:id`) (APP_FLOW §6) ; accès `/admin` par e-mail, mot de passe et MFA (APP_FLOW §1) ; garde « sans droit admin » (APP_FLOW §2.3) ; côté gérant `/signup/pending` puis `/dashboard/setup` (APP_FLOW §2.3)
- Commandes et données : Edge Functions `admin-decide-salon` (`approved` | `rejected`, motif ; codes `validation.reject_reason_required`, `admin.salon_already_decided`, TRD §6.2), `verify-siret`, `publish_salon` (côté gérant, K35) · tables `salon_verifications` (`siret_check_result`, `siret_check_payload`, `decision`, `decision_reason`, `decided_by`, `decided_at`), `salons` (`status`), `salon_events` (`approved`, `rejected`), `notifications` (`salon_decision`, canal `email`), `platform_admins`

## Scénarios

### 1. Liste des dossiers à traiter
- **Étant donné** que je suis connecté comme administrateur et que des salons ont envoyé leur dossier
- **Quand** j'ouvre `/admin/salons` avec le filtre « à traiter »
- **Alors** je vois les dossiers en attente de décision
- **Et** chaque dossier affiche le nom du salon, la ville, la date d'envoi et le résultat SIRET (✓, ⚠ ou ✗)
- **Et** les dossiers déjà validés ou refusés n'apparaissent pas avec ce filtre

### 2. Détail d'un dossier
- **Étant donné** que la liste des dossiers est affichée
- **Quand** je clique sur un dossier
- **Alors** je vois les données saisies par le gérant
- **Et** je vois le résultat de la vérification Recherche d'entreprises
- **Et** je vois la position du salon sur une carte

### 2 bis. Dossier avec un SIRET introuvable ou inactif (E14)
- **Étant donné** qu'un gérant a envoyé son dossier alors que la vérification de son SIRET a donné `not_found` (introuvable) ou `inactive` (inactif)
- **Quand** j'ouvre `/admin/salons` avec le filtre « à traiter »
- **Alors** ce dossier figure dans la liste, « à vérifier »
- **Et** son détail affiche le résultat de la vérification
- **Et** je peux le valider ou le refuser comme tout autre dossier

### 3. Valider un dossier
- **Étant donné** que le détail d'un dossier en attente est affiché
- **Quand** je clique sur « Valider »
- **Alors** la décision `approved` est enregistrée avec mon identité et l'heure
- **Et** le salon passe au statut `approved`
- **Et** un événement `approved` est ajouté au journal du salon
- **Et** un e-mail est envoyé au gérant pour lui annoncer la validation

### 4. Un salon validé n'est pas encore visible des clients
- **Étant donné** que je viens de valider un salon
- **Quand** un client cherche des salons dans la zone de ce salon
- **Alors** ce salon n'apparaît pas tant que le gérant ne l'a pas publié (`publish_salon`, S-07, K35)
- **Et** le gérant qui se connecte arrive sur `/dashboard/setup`

### 5. Refuser sans motif : impossible
- **Étant donné** que le détail d'un dossier en attente est affiché
- **Quand** je clique sur « Refuser » sans saisir de motif
- **Alors** le refus n'est pas envoyé
- **Et** le champ motif est signalé comme obligatoire avec « Indiquez le motif du refus. »
- **Et** une demande `admin-decide-salon` (`rejected`) envoyée sans motif est refusée avec `validation.reject_reason_required`

### 6. Refuser avec motif
- **Étant donné** que le détail d'un dossier en attente est affiché
- **Quand** je clique sur « Refuser », que je saisis un motif et que je confirme
- **Alors** la décision `rejected` et le motif sont enregistrés avec mon identité et l'heure
- **Et** le salon passe au statut `rejected`
- **Et** un événement `rejected` est ajouté au journal du salon
- **Et** un e-mail contenant le motif est envoyé au gérant

### 7. Double clic sur « Valider »
- **Étant donné** que le détail d'un dossier en attente est affiché
- **Quand** je clique deux fois de suite sur « Valider »
- **Alors** le bouton affiche un état de chargement et se désactive dès le premier clic
- **Et** une seule décision est enregistrée
- **Et** un seul e-mail est envoyé au gérant

### 7 bis. Dossier déjà tranché par un autre administrateur
- **Étant donné** deux administrateurs qui ont ouvert le même dossier en attente, et le premier qui vient de le valider
- **Quand** le second clique sur « Refuser » et envoie un motif
- **Alors** la demande est refusée avec `admin.salon_already_decided`
- **Et** le message « Ce dossier a déjà été traité. » s'affiche
- **Et** la décision `approved` du premier administrateur est conservée
- **Et** aucun second e-mail n'est envoyé au gérant

### 8. Accès réservé aux administrateurs
- **Étant donné** que je suis connecté avec un compte qui n'est pas administrateur de la plateforme (gérant, coiffeur, client)
- **Quand** j'ouvre `/admin/salons`
- **Alors** je suis redirigé vers `/signin`
- **Et** aucun dossier ne m'est montré

### 9. Connexion administrateur avec MFA
- **Étant donné** un compte administrateur
- **Quand** je me connecte avec e-mail et mot de passe
- **Alors** un second facteur (MFA) m'est demandé avant d'accéder à `/admin`

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.admin.salons.title` | Dossiers des salons | Titre de `/admin/salons` |
| `pro-manager.admin.salons.filters.to_review` / `.all` | À traiter / Tous les dossiers | Filtres |
| `pro-manager.admin.salons.columns.*` | Salon · Ville · Envoyé le · SIRET | Colonnes de la liste |
| `pro-manager.admin.salons.siret.valid` | SIRET vérifié | Le symbole seul ne suffit pas (RGAA AA) |
| `pro-manager.admin.salons.siret.to_check` | SIRET à vérifier | Idem |
| `pro-manager.admin.salons.siret.invalid` | SIRET non valide | Idem ; valeurs concernées : voir questions |
| `pro-manager.admin.salons.empty` | Aucun dossier à traiter. | État vide |
| `pro-manager.admin.salon.sections.*` | Données saisies · Recherche d'entreprises · Position du salon | Sections du détail (F-A1) |
| `pro-manager.admin.salon.siret_result.<result>` | `valid` : Établissement actif, code NAF de coiffure (96.02A ou 96.02B) · `naf_mismatch` : Établissement actif, code NAF hors coiffure · `inactive` : Établissement inactif · `not_found` : SIRET introuvable · `error` : Vérification impossible : service indisponible | Une clé par valeur de `siret_check_result` |
| `pro-manager.admin.salon.approve` | Valider | — |
| `pro-manager.admin.salon.reject` | Refuser | — |
| `pro-manager.admin.salon.reject_reason.label` | Motif du refus | Obligatoire |
| `pro-manager.admin.salon.reject_reason.hint` | Le gérant reçoit ce motif par e-mail. | — |
| `pro-manager.admin.salon.reject_submit` | Envoyer le refus | — |
| `errors.validation.reject_reason_required` | Indiquez le motif du refus. | Code de `admin-decide-salon` (TRD §6.2) |
| `errors.admin.salon_already_decided` | Ce dossier a déjà été traité. | Code de `admin-decide-salon` (TRD §6.2) |
| `notifications.salon_decision.approved.email.subject` / `.body` | Objet : Votre salon est validé sur Zelaté<br>Corps : « Bonjour {first_name}, Bonne nouvelle : votre salon {salon_name} est validé. […] Continuer la configuration : {link} » (texte complet au dictionnaire) | E-mail ; rappelle que le salon n'est visible qu'une fois publié |
| `notifications.salon_decision.rejected.email.subject` / `.body` | Objet : Votre inscription sur Zelaté n'est pas validée<br>Corps : « Bonjour {first_name}, Nous n'avons pas pu valider l'inscription de {salon_name} sur Zelaté, pour la raison suivante : {reason} […] » (texte complet au dictionnaire) | E-mail ; contient le motif |

## Questions ouvertes
- **Résolu le 18/10** (E14) — SIRET introuvable ou inactif : le dossier est envoyé « à vérifier », l'admin décide ; voir scénario 2 bis.
- **APP_FLOW F-A1 / F-M1 / BACKEND_SCHEMA §3** : E14 ne règle pas l'affichage. F-M1 n'utilise que ✓ (actif et NAF 96.02A/B) et ⚠ (« à vérifier » sinon) ; F-A1 ajoute ✗. Quelles valeurs de `siret_check_result` (`valid`, `naf_mismatch`, `inactive`, `not_found`, `error`) s'affichent ✗, puisque `not_found` et `inactive` sont « à vérifier » ?
- **APP_FLOW §2.3 / F-A1** : après un refus, que voit le gérant (aucune garde pour le statut `rejected`) ? Peut-il corriger et renvoyer son dossier ?
- **APP_FLOW F-A1 / TRD §6.1** : `verify-siret` peut être appelée par l'admin, mais aucun bouton ne relance la vérification dans F-A1. Faut-il un bouton (par exemple après un résultat `error`) ? Un admin peut-il revenir sur une décision ?
- **BACKEND_SCHEMA §3** : le statut `suspended` (abus) existe, mais aucun parcours ni commande ne permet de suspendre un salon.
- **Résolu le 19/10 (TRD §6.2 v0.5, constat 22)** : `admin-decide-salon` renvoie `validation.reject_reason_required` (refus sans motif) et `admin.salon_already_decided` (dossier déjà tranché) ; voir scénarios 5 et 7 bis. Question d'origine : aucun code d'erreur pour `admin-decide-salon`.
- **BACKEND_SCHEMA §4.18** : le motif de refus est-il un texte libre ou une liste ? Quelle longueur maximale (`decision_reason` n'en a pas) ?
- **PRD §8** : le délai de validation visé est de moins de 24 h (48 h au maximum). Dans quel ordre trier la liste « à traiter » ? Faut-il signaler un dossier qui approche des 48 h ?
- **Résolu le 19/10 (dictionnaire `pro-manager.json`, `errors.json`, `notifications.json`)** : libellé et erreur du motif, alternatives textuelles des symboles, résultats SIRET et les deux e-mails ont leur texte. Question d'origine : textes absents des documents.
