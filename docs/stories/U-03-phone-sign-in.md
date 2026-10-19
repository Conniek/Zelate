# U-03 · S'identifier par numéro de téléphone

**En tant que** client, **je veux** m'identifier avec mon numéro de téléphone et un code reçu par SMS, **afin de** rejoindre une file sans créer de mot de passe.

- Priorité : I (PRD §5.3)
- Règles appliquées : code à 6 chiffres, valable 5 min, 3 essais, renvoi après 30 s (PRD §5.3 U-03) ; numéros +33 uniquement (PRD §6, PRD §9 « Fraude au trafic SMS ») ; plafonds de codes SMS : 5 par heure et par numéro, 20 par heure et par IP (PRD §5.3 P-03, TRD §7)
- Parcours : F-C3 étape 4 (APP_FLOW §3) ; écran `/signin` (APP_FLOW §2.1) ; garde `/signin?next=/ticket` (APP_FLOW §2.3) ; lien « Créer mon compte » de F-C10
- Commandes et données : `signInWithOtp` (Supabase Auth) · Edge Function `auth-send-sms` (erreur `auth.otp_rate_limited`, TRD §6.2) · `join_queue` ou `check_in_appointment` avec `first_name?` (obligatoire si le compte n'a pas encore de profil, sinon `queue.invalid_payload`) : le profil naît de l'action qui demande le prénom, pas de l'inscription Auth (K30, TRD ADR-005) · tables `profiles` (`first_name`, `is_guest`), `private.rate_limits` · numéro dans `auth.users.phone`

## Scénarios

### 1. Recevoir et saisir le code
- **Étant donné** que je ne suis pas connecté et que j'arrive à l'étape 4 « Identification » de F-C3
- **Quand** je saisis un numéro de mobile français valide (le préfixe +33 est fixé) et que je touche « Recevoir le code »
- **Alors** un SMS contenant un code à 6 chiffres est envoyé à ce numéro
- **Et** le champ de saisie du code (6 cases) s'affiche
- **Et** un minuteur de renvoi de 30 s démarre

### 2. Validation à la sixième saisie
- **Étant donné** que j'ai reçu un code valide il y a moins de 5 min
- **Quand** je saisis le 6e chiffre, ou que je colle les 6 chiffres, ou que le système remplit le code depuis le SMS
- **Alors** le code est vérifié sans autre action de ma part
- **Et** je suis connecté et je passe à l'étape 5 « Récapitulatif »

### 3. Premier passage : prénom obligatoire
- **Étant donné** que mon numéro n'a jamais été utilisé sur Zelaté
- **Quand** mon code est validé
- **Alors** le champ prénom est demandé et je ne peux pas continuer sans le remplir
- **Et** le prénom est limité à 30 caractères
- **Et** aucun profil n'existe encore pour mon compte à ce stade (K30)
- **Quand** je confirme ensuite ma place (`join_queue`) ou mon signalement (`check_in_appointment`)
- **Alors** mon profil est créé avec ce prénom, comme compte invité (`profiles.is_guest = true`, K30)

### 3 bis. Prénom manquant au premier passage : `queue.invalid_payload`
- **Étant donné** que mon compte Auth n'a pas encore de profil
- **Quand** une commande `join_queue` ou `check_in_appointment` arrive sans `first_name`
- **Alors** elle est refusée avec `queue.invalid_payload`
- **Et** aucun profil ni aucun ticket n'est créé

### 4. Client connu : pas de prénom demandé
- **Étant donné** que mon numéro a déjà un compte avec un prénom
- **Quand** mon code est validé
- **Alors** le prénom ne m'est pas redemandé

### 5. Format de numéro invalide
- **Étant donné** que je suis à l'étape « Identification »
- **Quand** je saisis un numéro au format invalide
- **Alors** un message d'erreur de format s'affiche pendant la saisie
- **Et** aucun code n'est envoyé

### 6. Numéro hors +33 refusé
- **Étant donné** que je suis à l'étape « Identification »
- **Quand** j'essaie d'utiliser un numéro qui n'est pas un numéro +33
- **Alors** le numéro est refusé
- **Et** aucun SMS n'est envoyé

### 7. Code erroné
- **Étant donné** que j'ai reçu un code valide
- **Quand** je saisis un code à 6 chiffres différent
- **Alors** un message indique que le code est incorrect
- **Et** je reste non connecté

### 8. Troisième essai erroné
- **Étant donné** que j'ai déjà saisi 2 codes erronés pour le même code reçu
- **Quand** je saisis un 3e code erroné
- **Alors** le code n'est plus accepté, même s'il est ensuite saisi correctement
- **Et** un message m'indique d'attendre 5 min (APP_FLOW F-C3 : « au 3e échec : attendre 5 min ») — voir questions ouvertes

### 9. Code expiré après 5 min
- **Étant donné** que j'ai reçu un code il y a plus de 5 min
- **Quand** je le saisis correctement
- **Alors** le code est refusé comme expiré
- **Et** je reste non connecté

### 10. Renvoi du code après 30 s
- **Étant donné** que j'ai demandé un code il y a moins de 30 s
- **Quand** je regarde l'écran
- **Alors** « Renvoyer le code » est indisponible et le minuteur indique le temps restant
- **Quand** les 30 s sont écoulées et que je touche « Renvoyer le code »
- **Alors** un nouveau SMS avec un code est envoyé

### 11. Plafond de 5 codes par heure et par numéro
- **Étant donné** que 5 codes ont été envoyés à mon numéro dans l'heure
- **Quand** je touche « Recevoir le code » ou « Renvoyer le code » pour la 6e fois
- **Alors** aucun SMS n'est envoyé
- **Et** l'erreur `auth.otp_rate_limited` est renvoyée
- **Et** le message `errors.auth.otp_rate_limited` m'indique de réessayer plus tard
- **Quand** seuls 4 codes ont été envoyés à mon numéro dans l'heure
- **Alors** le 5e code est envoyé

### 11 bis. Plafond de 20 codes par heure et par IP
- **Étant donné** que 20 codes ont été demandés depuis mon adresse IP dans l'heure, pour des numéros différents
- **Quand** je demande un code pour un autre numéro depuis cette adresse IP
- **Alors** aucun SMS n'est envoyé
- **Et** l'erreur `auth.otp_rate_limited` est renvoyée

### 12. Retour à la page demandée après connexion
- **Étant donné** que je ne suis pas connecté et que j'ouvre `/ticket`
- **Quand** l'app me redirige vers `/signin?next=/ticket` et que je valide mon code
- **Alors** j'arrive sur `/ticket`

### 13. Créer son compte depuis le lien de suivi
- **Étant donné** que je suis mon ticket par le lien SMS `/t/:shortCode`, sans session
- **Quand** je touche « Créer mon compte »
- **Alors** l'écran `/signin` s'ouvre avec le numéro du ticket à confirmer

### 14. Le SMS de code tient en un seul SMS
- **Étant donné** le modèle de SMS du code de connexion
- **Quand** il est rempli avec un code à 6 chiffres
- **Alors** le texte fait 160 caractères GSM-7 au plus, dernière ligne `@zelate.fr #123456` comprise (K27, TRD §7)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.signin.phone.label` | Numéro de téléphone mobile | — |
| `client.signin.title` | Recevez un code par SMS | — |
| `client.signin.phone.hint` | Le salon ne voit jamais votre numéro. | H6 |
| `client.signin.first_name.hint` | Le salon voit seulement votre prénom. | H6 |
| `errors.queue.invalid_payload` | Certaines informations sont incomplètes ou incorrectes. Vérifiez-les, puis réessayez. | Prénom absent au premier passage (K30) |
| `client.signin.phone.prefix` | « +33 » | Fixé, non modifiable |
| `client.signin.send_code` | « Recevoir le code » | — |
| `client.signin.code.label` | Code à 6 chiffres reçu par SMS | 6 cases |
| `client.signin.resend` | « Renvoyer le code » | Actif après 30 s |
| `client.signin.resend_countdown` | Renvoyer le code dans {seconds} s | Variable `seconds` |
| `client.signin.first_name.label` | Votre prénom | Obligatoire, 30 caractères max |
| `client.signin.create_account` | « Créer mon compte » | Lien de F-C10 |
| `errors.auth.invalid_phone` | Ce numéro n'est pas valide. Vérifiez-le, puis réessayez. | — |
| `errors.auth.phone_not_supported` | Zelaté accepte pour l'instant les numéros français uniquement (+33). | Numéro hors +33 |
| `errors.auth.invalid_code` | Ce code n'est pas le bon. Vérifiez le SMS, puis réessayez. | — |
| `errors.auth.code_expired` | Ce code a expiré. Demandez-en un nouveau. | — |
| `errors.auth.too_many_attempts` | Trop d'essais. Patientez 5 min, puis demandez un nouveau code. (APP_FLOW, indicatif : « attendre 5 min ») | — |
| `errors.auth.otp_rate_limited` | Trop de codes ont été demandés en peu de temps. Réessayez plus tard. | Partagé avec P-03 |
| `notifications.auth.otp_code.sms` | Zelaté : votre code de connexion est {code}. Il est valable 5 min. Ne le donnez à personne.<br><br>@zelate.fr #{code} | SMS : 160 caractères GSM-7 au plus, code à 6 chiffres |

## Questions ouvertes
- **PRD U-03 / APP_FLOW F-C3** : le PRD fixe « 5 min » comme durée de validité du code. APP_FLOW ajoute « au 3e échec : attendre 5 min ». Les 5 min d'APP_FLOW sont-elles un blocage distinct après 3 échecs ? Le « 3e échec » désigne-t-il 3 codes erronés ou 3 demandes de renvoi ?
- **APP_FLOW F-C3** : un renvoi invalide-t-il le code précédent ? Remet-il le compteur des 3 essais à zéro ?
- **Résolu le 18/10** (PRD v1.1 P-03) — Valeurs des plafonds de codes SMS : 5 par heure et par numéro, 20 par heure et par IP, désormais dans le PRD.
- **Résolu le 18/10** (K1) — Code d'erreur de `auth-send-sms` : `auth.otp_rate_limited` (TRD §6.2, hors `queue-command`), clé `errors.auth.otp_rate_limited`.
- **PRD P-03 / BACKEND_SCHEMA §5** : la fenêtre d'une heure est-elle glissante ou fixe (`private.rate_limits.window_start` laisse penser à une fenêtre fixe) ? Les scénarios 11 et 11 bis en dépendent à la minute près.
- **Résolu le 19/10** (TRD v0.5 §9, BACKEND_SCHEMA v0.5 §4.16) — SMS de code et plafond : le code de connexion est hors outbox (`notifications.auth.otp_code`, envoyé par `auth-send-sms`) ; le plafond compte seulement les SMS `sent` du ticket dans `notifications` : le code n'y entre pas.
- **Résolu le 19/10** (K30) — Création du compte au premier passage : le profil (`is_guest = true`) naît de `join_queue` ou `check_in_appointment` avec le prénom, pas à l'inscription Auth ; voir scénarios 3 et 3 bis.
- **TRD** : quelle est la durée de session d'un client ? Elle n'est fixée que pour les coiffeurs (30 jours) ; les jetons d'accès de 15 min (ADR-019) ne disent pas la durée de la session.
- **Résolu le 19/10** (dictionnaire `client.json`, `errors.json`, `notifications.json`) — Textes de l'écran et du SMS de code rédigés.
