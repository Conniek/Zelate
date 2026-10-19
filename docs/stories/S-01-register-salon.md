# S-01 · Inscrire son salon

**En tant que** gérant d'un salon de coiffure, **je veux** créer mon compte, décrire mon salon (nom, adresse, téléphone, SIRET) et envoyer mon dossier, **afin de** le faire valider par la plateforme puis de le publier sur Zelaté.

- Priorité : I (PRD §5.3)
- Règles appliquées : aucune règle H ; validation des salons à la main au pilote (PRD §4, §11 n° 20) ; un SIRET introuvable ou inactif n'empêche pas l'envoi du dossier, qui part « à vérifier » (PRD §5.1, §11 E14) ; brouillon sauvegardé en continu et conservé 7 jours (PRD §5.3 S-01)
- Parcours : F-M1 (APP_FLOW §5) ; gardes de navigation (APP_FLOW §2.3)
- Commandes et données : `salon-signup` · `verify-siret` · tables `profiles`, `salons` (`name`, `phone`, `address_line`, `postal_code`, `city`, `city_code`, `location`, `siret`, `naf_code`, `status`, `draft_expires_at`), `salon_members` (`role` = `manager`), `salon_verifications` (`siret_check_result`, `decision`), `salon_events` (`submitted`)

## Scénarios

### 1. Création du compte gérant (étape 1)
- **Étant donné** un visiteur sur `/signup`
- **Quand** il saisit son e-mail, un mot de passe, son prénom et son nom, puis valide l'étape
- **Alors** un compte gérant est créé
- **Alors** un e-mail de confirmation est envoyé à l'adresse saisie
- **Alors** l'étape 2 « Salon » s'affiche, avec l'indicateur de progression

### 2. Adresse suggérée et position enregistrée (étape 2)
- **Étant donné** le gérant à l'étape 2
- **Quand** il saisit l'adresse de son salon
- **Alors** des adresses lui sont suggérées par l'autocomplétion de la Géoplateforme
- **Quand** il choisit une suggestion
- **Alors** l'adresse (`address_line`, `postal_code`, `city`, `city_code`) est enregistrée
- **Alors** la position du salon (`location`) est enregistrée

### 3. SIRET actif avec un code NAF de coiffure
- **Étant donné** le gérant à l'étape 2, avec le nom et le téléphone public du salon saisis
- **Quand** il saisit un SIRET de 14 chiffres d'un établissement actif dont le code NAF est 96.02A ou 96.02B, puis quitte le champ
- **Alors** la vérification `verify-siret` est lancée
- **Alors** un indicateur ✓ s'affiche à côté du champ
- **Alors** le code NAF renvoyé est enregistré dans `naf_code`

### 4. SIRET actif avec un autre code NAF : dossier « à vérifier »
- **Étant donné** le gérant à l'étape 2
- **Quand** il saisit le SIRET d'un établissement actif dont le code NAF n'est ni 96.02A ni 96.02B, puis quitte le champ
- **Alors** l'indicateur ⚠ « à vérifier » s'affiche
- **Alors** le gérant peut passer à l'étape 3
- **Alors** le résultat `naf_mismatch` est conservé pour le dossier de validation

### 5. SIRET introuvable ou inactif : dossier « à vérifier »
- **Étant donné** le gérant à l'étape 2
- **Quand** la vérification renvoie un établissement introuvable ou inactif
- **Alors** l'indicateur ⚠ « à vérifier » s'affiche (APP_FLOW F-M1 : « ⚠ à vérifier sinon »)
- **Alors** le gérant peut passer à l'étape 3 et envoyer son dossier (PRD §5.1, E14)
- **Alors** le résultat (`not_found` ou `inactive`) est conservé pour le dossier de validation, et l'équipe Zelaté décide (P-01)

### 5 bis. Service de vérification indisponible
- **Étant donné** le gérant à l'étape 2
- **Quand** la vérification renvoie une erreur du service
- **Alors** l'indicateur ⚠ « à vérifier » s'affiche (APP_FLOW F-M1 : « ⚠ à vérifier sinon »)
- **Alors** le résultat `error` est conservé pour le dossier de validation
- Le droit d'envoyer le dossier dans ce cas reste une question ouverte (E14 ne parle que d'un SIRET introuvable ou inactif).

### 6. Format du SIRET invalide
- **Étant donné** le gérant à l'étape 2
- **Quand** il saisit un SIRET qui ne fait pas exactement 14 chiffres
- **Alors** un message d'erreur de format s'affiche sous le champ
- **Alors** aucune vérification `verify-siret` n'est lancée

### 7. Brouillon sauvegardé en continu
- **Étant donné** un gérant connecté dont le salon est en brouillon (`draft`)
- **Quand** il remplit un champ puis ferme la page sans valider l'étape
- **Alors** la valeur saisie est enregistrée sans autre action de sa part
- **Quand** il revient sur l'app Pro et se connecte
- **Alors** il est redirigé vers `/signup` à l'étape enregistrée, avec ses saisies

### 8. Reprise du brouillon par e-mail pendant 7 jours
- **Étant donné** un brouillon commencé il y a moins de 7 jours
- **Quand** le gérant ouvre le lien de reprise reçu par e-mail
- **Alors** il retrouve `/signup` à l'étape enregistrée, avec ses saisies

### 9. Brouillon expiré après 7 jours
- **Étant donné** un brouillon dont la date `draft_expires_at` (7 jours) est dépassée
- **Quand** la tâche quotidienne de maintenance s'exécute
- **Alors** le brouillon est supprimé
- **Alors** le lien de reprise ne permet plus de retrouver les saisies

### 10. Choix « Je coiffe aussi » (étape 3)
- **Étant donné** le gérant à l'étape 3 « Vous et la coiffure »
- **Quand** il active ou laisse coupé l'interrupteur « Je coiffe aussi »
- **Alors** son choix est enregistré dans `is_hairdressing` (comportement détaillé dans S-02)

### 11. Envoi du dossier (étape 4)
- **Étant donné** le gérant à l'étape 4, avec le récapitulatif de ses saisies affiché
- **Quand** il clique sur « Envoyer mon dossier »
- **Alors** le bouton affiche un état de chargement et se désactive pendant l'envoi
- **Alors** le salon passe au statut `pending_review`
- **Alors** un dossier de validation est créé avec le résultat SIRET et la décision `pending`
- **Alors** l'événement `submitted` est inscrit au journal du salon
- **Alors** le gérant arrive sur `/signup/pending`
- **Alors** le wizard de configuration `/dashboard/setup` lui reste accessible

### 12. Double clic sur « Envoyer mon dossier »
- **Étant donné** le gérant à l'étape 4
- **Quand** il clique deux fois rapidement sur « Envoyer mon dossier »
- **Alors** un seul dossier de validation est créé

### 13. Garde de navigation pendant la validation
- **Étant donné** un gérant dont le salon est au statut `pending_review`
- **Quand** il ouvre `/dashboard`
- **Alors** il est redirigé vers `/signup/pending`

### 14. Salon invisible des clients avant publication
- **Étant donné** un salon au statut `draft` ou `pending_review`
- **Quand** un client cherche des salons autour de l'adresse de ce salon
- **Alors** ce salon n'apparaît ni dans la liste ni sur la carte

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.signup.account.title` | « Votre compte » | Étape 1 « Compte » |
| `pro-manager.signup.salon.title` | « Salon » | Libellé indicatif (APP_FLOW F-M1) |
| `pro-manager.signup.salon.siret_valid` | « SIRET vérifié : établissement actif, activité de coiffure » | Accessible au lecteur d'écran (RGAA AA) |
| `pro-manager.signup.salon.siret_to_verify` | « à vérifier » | Libellé indicatif (APP_FLOW F-M1), avec ⚠ |
| `pro-manager.signup.hairdressing.title` | « Vous et la coiffure » | Libellé indicatif (APP_FLOW F-M1) |
| `pro-manager.signup.hairdressing.label` | « Je coiffe aussi » | Libellé indicatif (APP_FLOW F-M1) |
| `pro-manager.signup.submit` | « Envoyer mon dossier » | Libellé indicatif (APP_FLOW F-M1) |
| `pro-manager.signup.pending.title` | « Dossier envoyé » | Écran `/signup/pending` |
| `errors.validation.siret_format` | « Le SIRET compte 14 chiffres. Vérifiez votre saisie. » | SIRET de 14 chiffres |
| `notifications.signup_resume.email` | Voir `notifications.signup_resume.email.*` dans le dictionnaire (2 textes) | E-mail de reprise du brouillon, lien valable 7 jours |

## Questions ouvertes
- **Résolu le 18/10** (E14, PRD §5.1) : un SIRET introuvable ou inactif n'empêche pas l'envoi ; le dossier part « à vérifier » et l'équipe Zelaté décide.
- **PRD** : E14 ne couvre pas le cas où le service Recherche d'entreprises est indisponible (`siret_check_result` = `error`). Le dossier part-il aussi « à vérifier », ou le gérant doit-il réessayer plus tard ?
- **APP_FLOW** : quel e-mail contient le lien de reprise du brouillon ? Est-ce l'e-mail de confirmation de l'étape 1 ou un autre ? Les 7 jours se comptent-ils depuis la création du brouillon ou depuis la dernière saisie ? Les saisies de l'étape 1 sont-elles gardées avant que le compte soit créé ?
- **APP_FLOW** : que voit le gérant qui ouvre un lien de reprise après 7 jours ?
- **BACKEND_SCHEMA** : l'e-mail de confirmation et l'e-mail de reprise n'ont pas de modèle dans `notification_template`. Sont-ils envoyés par Supabase Auth, par Brevo, ou faut-il ajouter des modèles ?
- **TRD** : d'après APP_FLOW F-M1, `verify-siret` est appelé quand le gérant quitte le champ, mais TRD §6.1 dit que seuls `salon-signup` et l'admin l'appellent. Qui l'appelle à la saisie ?
- **TRD** : la longueur minimale du mot de passe gérant (12 caractères) se trouve au TRD §7, qui n'est pas dans les sources de cette story. Faut-il l'ajouter comme scénario limite ?
- **APP_FLOW / BACKEND_SCHEMA** : au MVP, un gérant ne gère qu'un salon (index unique sur `salon_members.profile_id`). Que voit un gérant déjà inscrit qui commence une deuxième inscription ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
