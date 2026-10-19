# U-09 · Installer l'app et activer les notifications

**En tant que** client, **je veux** installer l'app Zelaté et activer les notifications, avec un guide pour iPhone, sans que mon refus ait de conséquence, **afin d'**être prévenu sans dépendre des SMS.

- Priorité : I (PRD §5.3)
- Règles appliquées : H3 (3 SMS maximum par ticket) (PRD §5.1) ; le SMS « votre tour » part toujours, même plafond atteint (E1) ; sans la case « Me prévenir », seuls les messages d'anticipation sont retenus, les messages indispensables partent toujours (E17) ; plafond hors `your_turn`, `cancelled_by_salon` et `no_show_warning` (E28) (PRD §5.1 « Autres règles ») ; abonnements écrits seulement par `push-subscribe` (K33) ; abonnement lié à un ticket supprimé à sa clôture (K40) ; push par défaut, SMS seulement sans push actif, sauf « votre tour » envoyé par les deux canaux (PRD §5.4) ; risque « notifications web limitées sur iPhone, PWA installée requise, iOS 16.4+ » (PRD §9)
- Parcours : F-C9 (`/install`), proposé après le premier ticket depuis F-C3 ; activation du push depuis F-C10 (APP_FLOW §3)
- Commandes et données : Edge Function `push-subscribe` (seul moyen d'écrire dans `push_subscriptions`, K33 ; abonnement mal formé : `queue.invalid_payload` ; jeton inconnu : `queue.forbidden`) · tables `push_subscriptions` (`profile_id` ou `ticket_id`, `endpoint`, `expired_at`), `notifications` (`status` = `skipped`, `skip_reason` = `push_active`)

## Scénarios

### 1. Proposition après le premier ticket
- **Étant donné** que je viens de créer mon premier ticket et que l'app n'est pas installée
- **Quand** l'écran « Mon ticket » s'ouvre
- **Alors** la carte « Installez Zelaté pour être prévenu sans SMS » s'affiche

### 2. Installer sur Android ou sur ordinateur
- **Étant donné** que la carte d'installation est affichée sur Android ou sur ordinateur
- **Quand** je touche « Installer »
- **Alors** l'invite d'installation du navigateur s'ouvre
- **Et** si je l'accepte, l'app Zelaté est installée

### 3. Guide d'installation pour iPhone
- **Étant donné** que la carte d'installation est affichée sur un iPhone
- **Quand** je touche « Comment faire »
- **Alors** un guide en 3 images s'affiche : « Partager », « Sur l'écran d'accueil », « Ouvrir »
- **Et** chaque image a une alternative textuelle

### 4. Activer les notifications
- **Étant donné** que l'app est installée et que j'ai un ticket actif
- **Quand** je touche « Activer les notifications » et que j'accepte la demande système
- **Alors** mon abonnement push est enregistré
- **Et** les notifications suivantes de mon ticket arrivent par push
- **Et** les SMS d'inscription, de T-10, de choix de coiffeur, de fin de journée, de retard sur un rendez-vous et d'avertissement d'absences ne sont plus envoyés (marqués `skipped`, motif `push_active`)
- **Et** le SMS « votre tour » est toujours envoyé en plus du push

### 5. Refus de la demande système sans conséquence
- **Étant donné** que l'app est installée et que j'ai un ticket actif
- **Quand** je touche « Activer les notifications » puis que je refuse la demande système
- **Alors** mon ticket garde son rang et son heure de passage
- **Et** je continue à recevoir les SMS de secours prévus, dans la limite de 3 SMS par ticket ; ceux des messages d'anticipation seulement si j'ai coché « Me prévenir » (E17)
- **Et** le SMS « votre tour » part toujours, même si le plafond de 3 SMS est atteint

### 6. « Plus tard »
- **Étant donné** que la carte d'installation est affichée
- **Quand** je touche « Plus tard »
- **Alors** la carte se ferme
- **Et** elle n'est plus proposée pour ce ticket
- **Et** elle peut être proposée de nouveau au ticket suivant, au plus tôt

### 7. Activer le push depuis le lien de suivi
- **Étant donné** que je suis mon ticket par `/t/:shortCode`, sans session
- **Quand** j'active les notifications et que j'accepte la demande système
- **Alors** l'abonnement push est enregistré pour ce ticket par `push-subscribe` (`push_subscriptions.ticket_id`)
- **Et** les notifications suivantes de ce ticket arrivent par push
- **Quand** ce ticket est clos (terminé, annulé ou absent)
- **Alors** cet abonnement est supprimé (K40 ; moment exact : voir questions ouvertes)

### 7 bis. Aucune écriture directe des abonnements (K33)
- **Étant donné** que je suis un client connecté
- **Quand** j'essaie d'écrire directement dans `push_subscriptions` (création, modification ou suppression), par exemple pour m'abonner aux push d'un membre du salon
- **Alors** l'écriture est refusée
- **Et** je ne peux lire que mes propres abonnements

### 8. iPhone sans installation : SMS de secours
- **Étant donné** un iPhone sur lequel l'app n'est pas installée
- **Quand** j'ai un ticket actif
- **Alors** aucune activation des notifications n'est proposée en dehors du guide d'installation
- **Et** les notifications de mon ticket partent par SMS selon les règles du PRD §5.4

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.install.card.title` | « Installez Zelaté pour être prévenu sans SMS » | — |
| `client.install.actions.install` | « Installer » | Android, ordinateur |
| `client.install.actions.how_to` | « Comment faire » | iPhone |
| `client.install.ios_guide.title` | Installer Zelaté sur iPhone | — |
| `client.install.ios_guide.step_share` | Touchez « Partager » dans la barre de Safari. | — |
| `client.install.ios_guide.step_add_to_home` | Choisissez « Sur l'écran d'accueil », puis « Ajouter ». | — |
| `client.install.ios_guide.step_open` | Ouvrez Zelaté depuis l'icône de votre écran d'accueil. | — |
| `client.install.ios_guide.image_alt` | {step, select, share {Barre de Safari avec le bouton Partager, un carré et une flèche vers le haut} add_to_home {Menu de partage de Safari avec l'option Sur l'écran d'accueil} other {Écran d'accueil de l'iPhone avec l'icône Zelaté}} | Alternative textuelle de chaque image (RGAA AA) |
| `client.install.actions.enable_notifications` | « Activer les notifications » | — |
| `client.install.actions.later` | « Plus tard » | — |

## Questions ouvertes
- **APP_FLOW F-C9** : « Activer les notifications » n'est proposé qu'une fois l'app installée. Sur Android et sur ordinateur, le push web marche aussi dans le navigateur sans installation. Le propose-t-on sans installation, notamment aux clients venus par QR (U-05) et sur la page `/t/:shortCode` ?
- **PRD §6 / APP_FLOW F-C9** : qu'affiche-t-on sur un iPhone sous iOS antérieur à 16.4, où le push web n'existe pas ?
- **PRD §5.4 / BACKEND_SCHEMA §4.17** : si un abonnement push est expiré (réponse 404 ou 410 du service de push), le client n'a plus de push actif. Le SMS de secours part-il pour la notification qui a échoué, ou seulement pour les suivantes ?
- **APP_FLOW F-C9** : après un refus de la demande système, le navigateur ne la reproposera pas. Que montre ensuite l'app (explication pour réactiver dans les réglages, rien) ? Que se passe-t-il si le client a installé l'app mais refusé les notifications ?
- **Résolu le 18/10** (K12) — Écran Compte sans exigence : U-13 ajoutée au PRD (prénom, consentements, export, suppression) ; voir la story U-13.
- **PRD §5.4 / APP_FLOW F-C9** : activer le push et cocher « Me prévenir » sont deux gestes distincts. Depuis E17, un client qui active le push sans avoir coché la case reçoit en push tous les messages indispensables, mais aucun message d'anticipation (votre tour approche, préparez-vous, changement d'heure, fin de journée). F-C9 doit-il le lui dire, ou lui proposer d'activer « Me prévenir » (`set_notifications_consent`) ?
- **BACKEND_SCHEMA §4.17 et §10 (🟡, Koni)** : moment exact de la suppression d'un abonnement lié à un ticket clos : la clôture produit souvent une dernière notification (`released_no_show`, `cancelled_by_salon`) qui a besoin de l'abonnement ; voir scénario 7.
- **Résolu le 19/10** (dictionnaire `client.json`) — Alternatives textuelles des 3 images du guide rédigées (`client.install.ios_guide.image_alt`).
