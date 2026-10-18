# S-04 · Ajouter ses coiffeurs

**En tant que** gérant, **je veux** ajouter les coiffeurs de mon salon (prénom, nom, spécialités, e-mail) et leur envoyer une invitation, **afin qu'**ils activent leur compte sur leur téléphone et reçoivent les clients dont ils maîtrisent les prestations.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1 (le coiffeur reçoit les prestations qu'il maîtrise) ; PRD §11 n° 18 (lot 1 : chaque coiffeur utilise son propre téléphone) ; 20 coiffeurs maximum (PRD §5.3 S-04)
- Parcours : F-M2 « Équipe » et « Téléphones de l'équipe », F-M11 `/dashboard/team` ; suite côté coiffeur F-S1 (story C-01)
- Commandes et données : `invite-member` · tables `salon_members` (`role` = `stylist`, `status`, `first_name`, `last_name`, `email`), `member_specialties`, `specialties`, `private.member_invitations` (`expires_at`, `used_at`), `notifications` (`member_invitation`, canal `email`), `salon_events` (`member_invited`, `member_activated`)

## Scénarios

### 1. Inviter un coiffeur
- **Étant donné** le gérant à l'étape « Équipe » du wizard, avec moins de 20 coiffeurs
- **Quand** il clique sur « Ajouter un coiffeur », saisit prénom, nom, e-mail, coche au moins une spécialité et valide
- **Alors** la fonction `invite-member` est appelée
- **Alors** le coiffeur apparaît dans la liste de l'équipe avec le statut « invité »
- **Alors** un e-mail d'invitation est envoyé à l'adresse saisie
- **Alors** l'e-mail contient un lien à usage unique, valable 72 h
- **Alors** l'événement `member_invited` est inscrit au journal du salon

### 2. Le coiffeur active son compte
- **Étant donné** un coiffeur au statut « invité »
- **Quand** il active son compte depuis le lien de l'invitation (C-01)
- **Alors** son statut devient « actif » dans la liste de l'équipe du gérant
- **Alors** l'événement `member_activated` est inscrit au journal du salon

### 3. Rappel sur les téléphones de l'équipe
- **Étant donné** le gérant à l'étape « Équipe » du wizard
- **Quand** il a invité au moins un coiffeur
- **Alors** un rappel lui explique que chaque coiffeur active son compte depuis son invitation et installe Zelaté Pro sur son téléphone

### 4. Aucune spécialité cochée
- **Étant donné** le formulaire « Ajouter un coiffeur » rempli sans spécialité
- **Quand** le gérant valide
- **Alors** l'invitation est refusée avec un message d'erreur
- **Alors** aucun e-mail n'est envoyé

### 5. Champ obligatoire manquant
- **Étant donné** le formulaire sans prénom, sans nom ou sans e-mail
- **Quand** le gérant valide
- **Alors** l'invitation est refusée et le champ manquant est signalé

### 6. E-mail déjà présent dans l'équipe du salon
- **Étant donné** un membre du salon déjà enregistré avec l'e-mail « lea@exemple.fr »
- **Quand** le gérant invite un coiffeur avec ce même e-mail
- **Alors** l'invitation est refusée avec un message d'erreur
- **Alors** aucun e-mail n'est envoyé

### 7. E-mail d'un coiffeur rattaché à un autre salon
- **Étant donné** un coiffeur invité ou actif dans le salon B avec l'e-mail « sam@exemple.fr »
- **Quand** le gérant du salon A invite un coiffeur avec cet e-mail
- **Alors** l'invitation est refusée avec un message d'erreur
- **Alors** le message ne nomme pas le salon B (isolation par salon, PRD §5.1)

### 8. Limite de 20 coiffeurs
- **Étant donné** un salon qui a déjà 20 coiffeurs
- **Quand** le gérant essaie d'en ajouter un 21e
- **Alors** l'invitation est refusée avec un message qui rappelle la limite de 20
- **Alors** aucun e-mail n'est envoyé

### 9. Double clic sur la validation
- **Étant donné** le formulaire rempli
- **Quand** le gérant clique deux fois rapidement sur la validation
- **Alors** un seul membre est créé et un seul e-mail est envoyé

### 10. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** il essaie de lire la liste de l'équipe du salon B (par l'API)
- **Alors** la lecture est refusée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.team.add` | « Ajouter un coiffeur » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.team.status.invited` | « invité » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.team.status.active` | « actif » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.setup.teamPhones.reminder` | « Chaque coiffeur active son compte depuis son invitation et installe Zelaté Pro sur son téléphone. » | Reprend le contenu de APP_FLOW F-M2, formulation à valider |
| `common.specialties.<code>` | — (à rédiger, un libellé par code) | Codes `women_cut`, `men_cut`, `kids_cut`, `beard`, `color`, `highlights`, `braids`, `curly_hair`, `styling`, `treatment` (BACKEND_SCHEMA §4.5) |
| `notifications.member_invitation.email.subject` | — (à rédiger) | E-mail |
| `notifications.member_invitation.email.body` | — (à rédiger) | Lien à usage unique, valable 72 h ; nom du salon et prénom du coiffeur |
| `errors.team.specialtyRequired` | — (à rédiger) | Au moins une spécialité |
| `errors.team.emailAlreadyUsed` | — (à rédiger) | Ne nomme pas un autre salon |
| `errors.team.limitReached` | — (à rédiger) | Rappelle la limite de 20 |

## Questions ouvertes
- **PRD / BACKEND_SCHEMA** : le PRD dit « 20 coiffeurs maximum », alors que BACKEND_SCHEMA §4.4 dit « 20 membres actifs maximum par salon ». Le gérant fait-il partie des 20 ? Les coiffeurs « invités » et « désactivés » comptent-ils ?
- **APP_FLOW** : quand une invitation a expiré, le coiffeur lit « Demandez une nouvelle invitation à votre gérant » (F-S1). Pourtant, `/dashboard/team` (F-M2, F-M4) n'a aucune action « Renvoyer l'invitation ». Faut-il en ajouter une ? L'ancien lien est-il alors annulé ? Le gérant voit-il qu'une invitation a expiré ?
- **TRD** : les codes d'erreur de `invite-member` (spécialité manquante, e-mail déjà utilisé, limite atteinte) ne sont pas listés au TRD §6.
- **APP_FLOW** : la photo du coiffeur (`photo_path`, montrée sur la fiche salon F-C2) n'est pas demandée dans le formulaire. Qui l'ajoute, et à quel endroit ?
- **PRD** : si le gérant modifie les spécialités d'un coiffeur actif, quel est l'effet sur les tickets déjà en attente ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
