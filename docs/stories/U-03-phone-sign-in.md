# U-03 · S'identifier par numéro de téléphone

**En tant que** client, **je veux** m'identifier avec mon numéro de téléphone et un code reçu par SMS, **afin de** rejoindre une file sans créer de mot de passe.

- Priorité : I (PRD §5.3)
- Règles appliquées : code à 6 chiffres, valable 5 min, 3 essais, renvoi après 30 s (PRD §5.3 U-03) ; numéros +33 uniquement (PRD §6, PRD §9 « Fraude au trafic SMS ») ; plafonds de codes SMS par numéro et par IP (PRD §5.3 P-03)
- Parcours : F-C3 étape 4 (APP_FLOW §3) ; écran `/signin` (APP_FLOW §2.1) ; garde `/signin?next=/ticket` (APP_FLOW §2.3) ; lien « Créer mon compte » de F-C10
- Commandes et données : `signInWithOtp` (Supabase Auth) · Edge Function `auth-send-sms` · tables `profiles` (`first_name`, `is_guest`), `private.rate_limits` · numéro dans `auth.users.phone`

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
- **Et** mon compte est créé comme compte invité (`profiles.is_guest = true`) avec ce prénom

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

### 11. Plafond de codes par numéro ou par IP atteint
- **Étant donné** que le plafond de codes SMS de mon numéro, ou de mon adresse IP, est atteint
- **Quand** je touche « Recevoir le code » ou « Renvoyer le code »
- **Alors** aucun SMS n'est envoyé
- **Et** un message m'indique de réessayer plus tard

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
- **Alors** le texte fait 160 caractères GSM-7 au plus

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.signin.phone.label` | _À rédiger (absent des docs)_ | — |
| `client.signin.phone.prefix` | « +33 » | Fixé, non modifiable |
| `client.signin.send_code` | « Recevoir le code » | — |
| `client.signin.code.label` | _À rédiger (absent des docs)_ | 6 cases |
| `client.signin.resend` | « Renvoyer le code » | Actif après 30 s |
| `client.signin.resend_countdown` | _À rédiger (absent des docs)_ | Variable `seconds` |
| `client.signin.first_name.label` | _À rédiger (absent des docs)_ | Obligatoire, 30 caractères max |
| `client.signin.create_account` | « Créer mon compte » | Lien de F-C10 |
| `errors.auth.invalid_phone` | _À rédiger (absent des docs)_ | — |
| `errors.auth.phone_not_supported` | _À rédiger (absent des docs)_ | Numéro hors +33 |
| `errors.auth.invalid_code` | _À rédiger (absent des docs)_ | — |
| `errors.auth.code_expired` | _À rédiger (absent des docs)_ | — |
| `errors.auth.too_many_attempts` | _À rédiger_ (APP_FLOW, indicatif : « attendre 5 min ») | — |
| `errors.queue.rate_limited` | _À rédiger (absent des docs)_ | Partagé avec U-04, P-03 |
| `notifications.auth.otp_code.sms` | _À rédiger (absent des docs)_ | SMS : 160 caractères GSM-7 au plus, code à 6 chiffres |

## Questions ouvertes
- **PRD U-03 / APP_FLOW F-C3** : le PRD fixe « 5 min » comme durée de validité du code. APP_FLOW ajoute « au 3e échec : attendre 5 min ». Les 5 min d'APP_FLOW sont-elles un blocage distinct après 3 échecs ? Le « 3e échec » désigne-t-il 3 codes erronés ou 3 demandes de renvoi ?
- **APP_FLOW F-C3** : un renvoi invalide-t-il le code précédent ? Remet-il le compteur des 3 essais à zéro ?
- **PRD P-03 / TRD §7** : le PRD ne chiffre pas les plafonds de codes SMS. TRD §7 indique 5 par heure et par numéro, 20 par heure et par IP. Ce sont bien les valeurs à tester ? Il faut les reporter dans le PRD.
- **TRD §6.1 / §6.2** : le code `queue.rate_limited` est un code de `queue-command`. Quel code d'erreur et quelle clé de message renvoie `auth-send-sms` (passé par Supabase Auth) quand un plafond est atteint ?
- **PRD §5.4** : le SMS de code de connexion compte-t-il dans le plafond de 3 SMS par ticket ? Il est envoyé avant la création du ticket et n'est pas une ligne de `notifications`.
- **TRD** : quelle est la durée de session d'un client ? Elle n'est fixée que pour les coiffeurs (30 jours).
- **Textes** : aucun texte de cet écran n'est écrit, sauf les libellés de boutons d'APP_FLOW. Le texte du SMS de code manque aussi.
