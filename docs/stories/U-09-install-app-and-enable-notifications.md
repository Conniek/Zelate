# U-09 · Installer l'app et activer les notifications

**En tant que** client, **je veux** installer l'app Zelaté et activer les notifications, avec un guide pour iPhone, sans que mon refus ait de conséquence, **afin d'**être prévenu sans dépendre des SMS.

- Priorité : I (PRD §5.3)
- Règles appliquées : H3 (3 SMS maximum par ticket) (PRD §5.1) ; push par défaut, SMS seulement sans push actif, sauf « votre tour » envoyé par les deux canaux (PRD §5.4) ; risque « notifications web limitées sur iPhone, PWA installée requise, iOS 16.4+ » (PRD §9)
- Parcours : F-C9 (`/install`), proposé après le premier ticket depuis F-C3 ; activation du push depuis F-C10 (APP_FLOW §3)
- Commandes et données : Edge Function `push-subscribe` · tables `push_subscriptions` (`profile_id` ou `ticket_id`, `endpoint`, `expired_at`), `notifications` (`status` = `skipped`, `skip_reason` = `push_active`)

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
- **Et** les SMS d'inscription, de T-10, de choix de coiffeur et de fin de journée ne sont plus envoyés (marqués `skipped`, motif `push_active`)
- **Et** le SMS « votre tour » est toujours envoyé en plus du push

### 5. Refus de la demande système sans conséquence
- **Étant donné** que l'app est installée et que j'ai un ticket actif
- **Quand** je touche « Activer les notifications » puis que je refuse la demande système
- **Alors** mon ticket garde son rang et son heure de passage
- **Et** je continue à recevoir les SMS de secours prévus, dans la limite de 3 SMS par ticket

### 6. « Plus tard »
- **Étant donné** que la carte d'installation est affichée
- **Quand** je touche « Plus tard »
- **Alors** la carte se ferme
- **Et** elle n'est plus proposée pour ce ticket
- **Et** elle peut être proposée de nouveau au ticket suivant, au plus tôt

### 7. Activer le push depuis le lien de suivi
- **Étant donné** que je suis mon ticket par `/t/:trackingToken`, sans session
- **Quand** j'active les notifications et que j'accepte la demande système
- **Alors** l'abonnement push est enregistré pour ce ticket (`push_subscriptions.ticket_id`)
- **Et** les notifications suivantes de ce ticket arrivent par push

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
| `client.install.ios_guide.step_share` | « Partager » | — |
| `client.install.ios_guide.step_add_to_home` | « Sur l'écran d'accueil » | — |
| `client.install.ios_guide.step_open` | « Ouvrir » | — |
| `client.install.ios_guide.image_alt` | _À rédiger (absent des docs)_ | Alternative textuelle de chaque image (RGAA AA) |
| `client.install.actions.enable_notifications` | « Activer les notifications » | — |
| `client.install.actions.later` | « Plus tard » | — |

## Questions ouvertes
- **APP_FLOW F-C9** : « Activer les notifications » n'est proposé qu'une fois l'app installée. Sur Android et sur ordinateur, le push web marche aussi dans le navigateur sans installation. Le propose-t-on sans installation, notamment aux clients venus par QR (U-05) et sur la page `/t/:trackingToken` ?
- **PRD §6 / APP_FLOW F-C9** : qu'affiche-t-on sur un iPhone sous iOS antérieur à 16.4, où le push web n'existe pas ?
- **PRD §5.4 / BACKEND_SCHEMA §4.17** : si un abonnement push est expiré (réponse 404 ou 410 du service de push), le client n'a plus de push actif. Le SMS de secours part-il pour la notification qui a échoué, ou seulement pour les suivantes ?
- **APP_FLOW F-C9** : après un refus de la demande système, le navigateur ne la reproposera pas. Que montre ensuite l'app (explication pour réactiver dans les réglages, rien) ? Que se passe-t-il si le client a installé l'app mais refusé les notifications ?
- **PRD §5.3 / APP_FLOW F-C11** : l'écran Compte (interrupteur « Notifications de suivi » avec la date du consentement, export des données, suppression du compte) n'a pas d'identifiant d'exigence dans le PRD. Il n'est couvert par aucune story.
- **Textes** : les alternatives textuelles des 3 images du guide ne figurent dans aucun document.
