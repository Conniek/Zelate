# P-01 · Valider ou refuser un salon

**En tant qu'**administrateur de la plateforme, **je veux** valider ou refuser à la main chaque dossier de salon en voyant le résultat de la vérification SIRET, **afin que** seuls des salons légitimes soient publiés.

- Priorité : I (PRD §5.3)
- Règles appliquées : décision n° 20 « validation à la main au pilote, automatique en V1 » (PRD §11) ; SIRET vérifié en ligne, code NAF 96.02A ou B, sinon dossier « à vérifier » (PRD §5.3 S-01) ; persona « Admin plateforme » : valider les salons légitimes (PRD §3)
- Parcours : F-A1 (`/admin/salons`, `/admin/salons/:id`) (APP_FLOW §6) ; accès `/admin` par e-mail, mot de passe et MFA (APP_FLOW §1) ; garde « sans droit admin » (APP_FLOW §2.3) ; côté gérant `/signup/pending` puis `/dashboard/setup` (APP_FLOW §2.3)
- Commandes et données : Edge Functions `admin-decide-salon` (`approved` | `rejected`, motif), `verify-siret` · tables `salon_verifications` (`siret_check_result`, `siret_check_payload`, `decision`, `decision_reason`, `decided_by`, `decided_at`), `salons` (`status`), `salon_events` (`approved`, `rejected`), `notifications` (`salon_decision`, canal `email`), `platform_admins`

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
- **Alors** ce salon n'apparaît pas tant que le gérant ne l'a pas publié (S-07)
- **Et** le gérant qui se connecte arrive sur `/dashboard/setup`

### 5. Refuser sans motif : impossible
- **Étant donné** que le détail d'un dossier en attente est affiché
- **Quand** je clique sur « Refuser » sans saisir de motif
- **Alors** le refus n'est pas envoyé
- **Et** le champ motif est signalé comme obligatoire

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
| `pro-manager.admin.salons.filters.to_review` | « à traiter » | — |
| `pro-manager.admin.salons.siret.valid` | « ✓ » + _alternative textuelle à rédiger_ | Le symbole seul ne suffit pas (RGAA AA) |
| `pro-manager.admin.salons.siret.to_check` | « ⚠ » + _alternative textuelle à rédiger_ | Idem |
| `pro-manager.admin.salons.siret.invalid` | « ✗ » + _alternative textuelle à rédiger_ | Idem |
| `pro-manager.admin.salon.approve` | « Valider » | — |
| `pro-manager.admin.salon.reject` | « Refuser » | — |
| `pro-manager.admin.salon.reject_reason.label` | _À rédiger (absent des docs)_ | Obligatoire |
| `errors.validation.reject_reason_required` | _À rédiger (absent des docs)_ | — |
| `notifications.salon_decision.approved.email` | _À rédiger (absent des docs)_ | E-mail ; objet et corps |
| `notifications.salon_decision.rejected.email` | _À rédiger (absent des docs)_ | E-mail ; contient le motif |

## Questions ouvertes
- **APP_FLOW F-A1 / BACKEND_SCHEMA §3** : comment les cinq valeurs de `siret_check_result` (`valid`, `naf_mismatch`, `inactive`, `not_found`, `error`) se répartissent-elles entre ✓, ⚠ et ✗ ? F-M1 n'utilise que ✓ et ⚠.
- **APP_FLOW §2.3 / F-A1** : après un refus, que voit le gérant (aucune garde pour le statut `rejected`) ? Peut-il corriger et renvoyer son dossier ?
- **APP_FLOW F-A1 / TRD §6.1** : `verify-siret` peut être appelée par l'admin, mais aucun bouton ne relance la vérification dans F-A1. Faut-il un bouton (par exemple après un résultat `error`) ? Un admin peut-il revenir sur une décision ?
- **BACKEND_SCHEMA §3** : le statut `suspended` (abus) existe, mais aucun parcours ni commande ne permet de suspendre un salon.
- **TRD §6.1** : aucun code d'erreur n'est prévu pour `admin-decide-salon` (dossier déjà décidé, deux admins qui décident en même temps).
- **BACKEND_SCHEMA §4.18** : le motif de refus est-il un texte libre ou une liste ? Quelle longueur maximale (`decision_reason` n'en a pas) ?
- **PRD §8** : le délai de validation visé est de moins de 24 h (48 h au maximum). Dans quel ordre trier la liste « à traiter » ? Faut-il signaler un dossier qui approche des 48 h ?
- **Textes** : le libellé et l'erreur du motif, les alternatives textuelles des symboles et les deux e-mails ne figurent dans aucun document.
