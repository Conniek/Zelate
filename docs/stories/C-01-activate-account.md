# C-01 · Activer son compte et se connecter

**En tant que** coiffeur invité par mon gérant, **je veux** activer mon compte depuis l'invitation, installer Zelaté Pro sur mon téléphone et me connecter par lien magique, **afin de** recevoir mes clients depuis mon propre téléphone, sans mot de passe.

- Priorité : I (PRD §5.3)
- Règles appliquées : PRD §5.1 « Aucune donnée client n'est stockée sur le téléphone du coiffeur : affichage seulement, rien en cache, déconnexion à distance par le gérant » ; décision n° 18 (PRD §11) ; TRD ADR-007 et §7 (ligne « Coiffeur (lot 1) »)
- Parcours : F-S1, F-S2 (APP_FLOW §4) ; gardes de navigation (APP_FLOW §2.3)
- Commandes et données : `activate-invitation` (Edge Function, TRD §6.1) · tables `private.member_invitations`, `salon_members`, `profiles`, `salon_events`

Hors périmètre : l'envoi de l'invitation par le gérant (S-04), la coupure des sessions par le gérant (S-16), la tablette partagée et le PIN (lot 2).

## Scénarios

### 1. Activation depuis une invitation valide
- **Étant donné** un coiffeur ajouté par le gérant, enregistré dans `salon_members` au statut `invited`
- **Et** une invitation `private.member_invitations` dont `expires_at` (émission + 72 h) n'est pas dépassé et dont `used_at` est vide
- **Quand** il ouvre le lien de l'e-mail d'invitation (`/invite/:token`) et touche « Activer mon compte »
- **Alors** la page affiche « Ouvrez le lien reçu sur votre téléphone »
- **Et** un e-mail de connexion contenant un lien magique est envoyé à l'adresse de l'invitation
- **Et** l'invitation est marquée utilisée (`used_at` renseigné)
- **Et** le membre est rattaché à un compte (`salon_members.profile_id` renseigné) et passe au statut `active`
- **Et** le journal du salon enregistre un événement `member_activated`
- **Et** l'équipe du dashboard affiche ce coiffeur « actif » au lieu de « invité »

### 2. Adresse déjà associée à un compte Zelaté
- **Étant donné** une invitation valide envoyée à une adresse e-mail déjà associée à un compte Zelaté
- **Quand** le coiffeur touche « Activer mon compte »
- **Alors** le membre est rattaché à ce compte existant
- **Et** aucun second compte n'est créé

### 3. Ouverture du lien de connexion sur le téléphone
- **Étant donné** un coiffeur qui vient d'activer son compte
- **Quand** il ouvre sur son téléphone le lien de connexion reçu par e-mail
- **Alors** il est connecté avec une session de 30 jours
- **Et** Zelaté Pro lui propose de s'installer sur son téléphone
- **Et** il arrive sur « Ma file » (`/stylist/queue`)

### 4. Guide d'installation sur iPhone
- **Étant donné** un coiffeur connecté sur un iPhone (Safari iOS 16.4 ou plus)
- **Quand** la proposition d'installation de Zelaté Pro s'affiche
- **Alors** elle présente le guide en 3 images : Partager → Sur l'écran d'accueil → Ouvrir

### 5. Lien d'invitation expiré
- **Étant donné** une invitation dont `expires_at` (émission + 72 h) est dépassé et qui n'a jamais été utilisée
- **Quand** le coiffeur ouvre le lien
- **Alors** la page affiche « Demandez une nouvelle invitation à votre gérant »
- **Et** le membre reste au statut `invited`
- **Et** aucun e-mail de connexion n'est envoyé

### 6. Lien d'invitation déjà utilisé
- **Étant donné** une invitation dont `used_at` est renseigné
- **Quand** quelqu'un ouvre à nouveau ce lien
- **Alors** la page affiche « Demandez une nouvelle invitation à votre gérant »
- **Et** aucun compte n'est créé ni rattaché

### 7. Session expirée ou absente
- **Étant donné** un coiffeur actif dont la session de 30 jours a expiré
- **Quand** il ouvre `/stylist/queue`
- **Alors** il est redirigé vers `/signin?next=/stylist/queue`

### 8. Reconnexion par lien magique
- **Étant donné** un coiffeur actif, non connecté, sur la page de connexion de Zelaté Pro
- **Quand** il saisit son e-mail, touche « Recevoir mon lien » puis ouvre le lien reçu
- **Alors** il est connecté avec une session de 30 jours
- **Et** il arrive sur « Ma file » (`/stylist/queue`)

### 9. Compte désactivé par le gérant
- **Étant donné** un coiffeur dont le statut est `deactivated`
- **Quand** il ouvre l'espace coiffeur ou demande un lien de connexion
- **Alors** il voit un message indiquant que son accès a été retiré (texte à unifier, voir questions)
- **Et** aucune session ne lui est ouverte
- **Et** aucune donnée de la file du salon ne lui est affichée

### 10. Sessions coupées par le gérant
- **Étant donné** un coiffeur actif dont le gérant vient de couper toutes les sessions (« Déconnecter ses appareils », S-16)
- **Quand** il utilise l'espace coiffeur sur son téléphone
- **Alors** il est renvoyé vers `/signin` avec un message indiquant que son accès a été retiré
- **Et** la file du salon n'est plus affichée sur son téléphone

### 11. Déconnexion volontaire
- **Étant donné** un coiffeur connecté
- **Quand** il choisit « Se déconnecter » dans le menu
- **Alors** sa session prend fin
- **Et** il arrive sur la page de connexion de Zelaté Pro (F-S2)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.invite.activate_button` | « Activer mon compte » | Libellé indicatif (APP_FLOW F-S1), à valider en REQ-3 |
| `pro-stylist.invite.check_email` | « Ouvrez le lien reçu sur votre téléphone » | Libellé indicatif (APP_FLOW F-S1) |
| `pro-stylist.invite.link_invalid` | « Demandez une nouvelle invitation à votre gérant » | Lien expiré ou déjà utilisé (APP_FLOW F-S1) |
| `pro-stylist.install.prompt` | À rédiger (REQ-3) | Proposition d'installer Zelaté Pro ; aucun texte dans les documents |
| `pro-stylist.install.ios_steps` | « Partager » → « Sur l'écran d'accueil » → « Ouvrir » | Guide en 3 images, repris de F-C9 |
| `pro-stylist.signin.email_label` | À rédiger (REQ-3) | Champ e-mail ; espace de noms à confirmer (page `/signin` partagée avec le gérant) |
| `pro-stylist.signin.request_link` | « Recevoir mon lien » | Libellé indicatif (APP_FLOW F-S2) ; espace de noms à confirmer |
| `pro-stylist.signin.access_revoked` | « Votre accès a été retiré, contactez votre gérant » | APP_FLOW F-S2 ; diffère de §2.3 (voir questions) |
| `common.actions.sign_out` | « Se déconnecter » | APP_FLOW F-S2 |

## Questions ouvertes
- [APP_FLOW] Le message d'accès retiré diffère : §2.3 « Votre accès a été retiré » ; F-S2 « Votre accès a été retiré, contactez votre gérant ». Lequel retenir ?
- [APP_FLOW] Après « Déconnecter ses appareils », F-M4 dit que le coiffeur « se reconnecte par lien magique », mais F-S2 affiche « Votre accès a été retiré, contactez votre gérant » aussi pour les « sessions coupées ». Le coiffeur peut-il redemander un lien seul, ou le message bloque-t-il la reconnexion ?
- [APP_FLOW / PRD] F-S1 propose l'installation « comme F-C9 » : reprend-on tout F-C9 (bouton « Installer » sur Android, « Plus tard ») ou seulement le guide iPhone ? L'installation est-elle obligatoire (PRD C-01 : « installer Zelaté Pro ») ou le coiffeur peut-il travailler dans le navigateur ?
- [APP_FLOW] Un lien d'invitation inconnu ou mal formé affiche-t-il le même message que le lien expiré ou utilisé ?
- [APP_FLOW] Le lien de connexion ouvert sur un autre appareil que le téléphone (ordinateur) : accepté ou refusé pour un coiffeur ?
- [TRD] Durée de validité du lien magique de connexion : non précisée.
- [TRD / BACKEND_SCHEMA] L'e-mail de connexion (lien magique) n'a pas de modèle dans l'énumération `notification_template` ni d'entrée dans TRD §9 : est-il rédigé dans `notifications.json` ou dans les modèles de Supabase Auth ?
- [TRD §9] Espace de noms des textes de la page `/signin` de Zelaté Pro, partagée par le gérant et le coiffeur : `pro-stylist`, `pro-manager` ou `common` ?
