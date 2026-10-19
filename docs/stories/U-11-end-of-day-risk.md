# U-11 · Être prévenu du risque de ne pas être pris avant la fermeture

**En tant que** client inscrit dans une file, **je veux** être prévenu une fois si je risque de ne pas être pris avant la fermeture, et choisir « Je reste » ou « J'annule », **afin de** ne pas attendre pour rien.

- Priorité : I (PRD §5.3)
- Règles appliquées : H9 (fin de journée) (PRD §5.1) ; règles « Fin de journée (H9) » : alerte unique à partir de 2 h avant la **dernière** fermeture de la journée (valeur par défaut, réglable par salon après le pilote), à la fermeture le gérant voit **tous** les clients restants et choisit « Servir » ou « Annuler avec excuses », annulation automatique 15 min après la fermeture, un client « servi » non pris avant minuit (heure de Paris) est annulé avec un message d'excuse, les rendez-vous restants sont traités comme les autres clients, une coupure de midi n'annule rien, aucun ticket ne passe d'un jour à l'autre (E5, E24, PRD §5.2) ; un rendez-vous encore à confirmer est annulé avec excuses à la fermeture (E19) ; nouveaux horaires du jour pris en compte pour la fin de journée (E16, PRD §5.1) ; l'alerte de fin de journée est un message d'anticipation, retenu sans la case « Me prévenir » ; l'annulation par le salon est indispensable et hors plafond (E17, E28) ; décision n° 19 (PRD §11) ; notifications « Risque de fin de journée » (push, SMS si pas de push dans la limite du plafond) et « Annulation par le salon » (push et SMS hors plafond) (PRD §5.4)
- Parcours : F-C5 (bandeau « Risque de fin de journée ») et F-C10 (APP_FLOW §3) ; côté gérant F-M12 ; événements « Risque de fin de journée », « Clients restants à la fermeture », « Annulation par le salon » (APP_FLOW §7)
- Commandes et données : `respond_end_of_day` (`ticket_id`, `choice` = `stay` | `cancel` ; code `queue.already_resolved` et codes communs, TRD §6.2) · `queue-tick` (alerte, annulation automatique 15 min après la fermeture, annulation à minuit des clients « servis » non pris) · `resolve_closing` (gérant, `ticket_ids`, `decision` = `serve` | `cancel`) · tables `salons` (`end_of_day_warning_minutes` défaut 120, `closing_grace_minutes` défaut 15), `opening_hours`, `tickets` (`end_of_day_warned_at`, `end_of_day_choice`, `closing_decision`, `status`, `cancel_reason`), `ticket_events` (`end_of_day_warned`, `end_of_day_responded`, `cancelled`), `notifications` (`end_of_day_risk`, `cancelled_by_salon`)

## Scénarios

### 1. Alerte à partir de 2 h avant la fermeture
- **Étant donné** un salon qui ferme à 19h00, avec le réglage par défaut de 2 h (120 min), j'ai coché « Me prévenir », et mon ticket dont la fin estimée est 19h10
- **Quand** il est 17h00 et qu'un événement relance le calcul
- **Alors** je reçois une notification push avec le texte « Vous risquez de ne pas être pris avant la fermeture » et les choix « Je reste » et « J'annule »
- **Et** si je n'ai pas de push actif, je reçois cette alerte par SMS, dans la limite de 3 SMS par ticket
- **Et** ma page de suivi affiche le bandeau « Vous risquez de ne pas être pris avant la fermeture » avec « Je reste » et « J'annule »
- **Et** l'envoi de l'alerte est enregistré sur le ticket (`end_of_day_warned_at`) et au journal (`end_of_day_warned`)

### 2. Pas d'alerte avant la fenêtre
- **Étant donné** le même salon qui ferme à 19h00 et mon ticket dont la fin estimée est 19h10
- **Quand** il est 16h59
- **Alors** aucune alerte de fin de journée ne m'est envoyée

### 2 bis. Plusieurs plages : seule la dernière fermeture compte (E5)
- **Étant donné** un salon ouvert de 9h00 à 12h00 et de 14h00 à 19h00 ce jour-là
- **Quand** il est 10h30 et que la fin estimée de mon ticket est 12h20
- **Alors** aucune alerte de fin de journée ne m'est envoyée, la fenêtre de 2 h se calculant avant 19h00
- **Quand** il est 17h00 et que la fin estimée de mon ticket est 19h10
- **Alors** l'alerte du scénario 1 m'est envoyée

### 2 ter. Horaires modifiés dans la journée (E16)
- **Étant donné** un salon qui fermait à 19h00 et dont le gérant avance la fermeture du jour à 18h00
- **Quand** il est 16h00 et que la fin estimée de mon ticket est 18h10
- **Alors** l'alerte de fin de journée m'est envoyée, la fenêtre de 2 h se calculant avant 18h00

### 2 quater. La coupure de midi n'annule rien (E24)
- **Étant donné** un salon ouvert de 9h00 à 12h00 et de 14h00 à 19h00, et mon ticket encore en attente à 12h00
- **Quand** la plage du matin se termine
- **Alors** mon ticket n'est pas annulé et reste à son rang
- **Et** la file reprend à la plage de 14h00

### 3. Pas d'alerte si la fin estimée est avant la fermeture
- **Étant donné** que nous sommes dans les 2 h avant la fermeture et que la fin estimée de mon ticket est avant l'heure de fermeture
- **Quand** le calcul est relancé
- **Alors** aucune alerte de fin de journée ne m'est envoyée

### 4. Une seule alerte
- **Étant donné** que j'ai déjà reçu l'alerte de fin de journée
- **Quand** de nouveaux événements relancent le calcul et que ma fin estimée reste après la fermeture
- **Alors** je ne reçois pas de seconde alerte

### 5. Heure redevenue sûre
- **Étant donné** que j'ai reçu l'alerte de fin de journée
- **Quand** ma fin estimée repasse avant l'heure de fermeture
- **Alors** je ne reçois que la notification de changement d'heure, selon la règle des 10 min (voir U-10)
- **Et** aucune nouvelle alerte de fin de journée n'est envoyée

### 6. « Je reste »
- **Étant donné** que l'alerte de fin de journée est affichée
- **Quand** je touche « Je reste »
- **Alors** mon choix `stay` est enregistré sur le ticket
- **Et** un événement `end_of_day_responded` est ajouté au journal
- **Et** mon ticket reste dans la file au même rang
- **Et** le gérant voit « reste » pour moi dans la liste des clients à risque

### 7. « J'annule »
- **Étant donné** que l'alerte de fin de journée est affichée
- **Quand** je touche « J'annule »
- **Alors** mon ticket passe au statut « Annulé » avec le motif `client_cancelled` (BACKEND_SCHEMA §3)
- **Et** les tickets suivants avancent
- **Et** l'écran de fin s'affiche avec « Rejoindre une autre file »
- **Et** le gérant voit « annule » pour moi dans la liste des clients à risque

### 8. Sans réponse
- **Étant donné** que j'ai reçu l'alerte et que je ne réponds pas
- **Quand** l'heure de fermeture approche
- **Alors** mon ticket reste dans la file
- **Et** le gérant voit « sans réponse » pour moi dans la liste des clients à risque

### 8 bis. Le gérant voit tous les clients restants (E5)
- **Étant donné** qu'à l'heure de fermeture trois clients attendent encore : l'un a répondu « Je reste », l'autre n'a pas répondu, le troisième n'a jamais reçu l'alerte
- **Quand** la boîte « *n* clients attendent encore » s'ouvre sur le dashboard
- **Alors** les trois clients y figurent, avec leur réponse éventuelle
- **Et** un client avec rendez-vous qui attend encore y figure comme les autres (E24)

### 9. À la fermeture, le gérant choisit « Servir »
- **Étant donné** que j'attends encore à l'heure de fermeture
- **Quand** le gérant choisit « Servir » pour moi (ou pour tous)
- **Alors** mon ticket reste dans la file
- **Et** la décision `serve` est enregistrée sur le ticket
- **Et** je ne suis pas annulé automatiquement 15 min après la fermeture

### 10. À la fermeture, le gérant choisit « Annuler avec excuses »
- **Étant donné** que j'attends encore à l'heure de fermeture
- **Quand** le gérant choisit « Annuler avec excuses » pour moi (ou pour tous)
- **Alors** mon ticket passe au statut « Annulé » avec le motif `end_of_day`
- **Et** je reçois une notification push et un SMS avec le motif, des excuses et des salons proches
- **Et** ce SMS est envoyé même si 3 SMS ont déjà été envoyés pour ce ticket (hors plafond, E28)
- **Et** ce message part même si je n'ai pas coché « Me prévenir » (message indispensable, E17)

### 11. Sans décision du gérant : annulation automatique 15 min après la fermeture
- **Étant donné** que j'attends encore à 19h00, heure de fermeture, et que le gérant n'a rien décidé pour moi
- **Quand** il est 19h15
- **Alors** mon ticket passe au statut « Annulé » avec le motif `end_of_day`
- **Et** je reçois une notification push et un SMS (hors plafond) avec un message d'excuse et des salons proches
- **Et** à 19h14, mon ticket est encore actif

### 12. « Servi » mais non pris avant minuit (E5, E24)
- **Étant donné** que le gérant a choisi « Servir » pour moi et que je n'ai pas été pris
- **Quand** il est 23h59, heure de Paris
- **Alors** mon ticket est encore actif
- **Quand** il est minuit, heure de Paris
- **Alors** mon ticket passe au statut « Annulé » avec le motif `end_of_day`
- **Et** je reçois le message d'excuse de l'annulation par le salon (`cancelled_by_salon`, variante `end_of_day`), par push et par SMS, hors plafond (PRD §5.4, E28)
- **Et** mon ticket n'apparaît pas dans la file du lendemain

### 12 bis. Rendez-vous encore à confirmer à la fermeture (E19)
- **Étant donné** que je me suis signalé pour un rendez-vous et que le salon ne l'a ni confirmé ni refusé
- **Quand** la dernière fermeture de la journée arrive
- **Alors** mon ticket passe au statut « Annulé » avec le motif `end_of_day`
- **Et** je reçois un message d'excuse

### 13. Plafond SMS atteint sans push
- **Étant donné** que je n'ai pas de push actif et que 3 SMS ont déjà été envoyés pour mon ticket
- **Quand** l'alerte de fin de journée est déclenchée
- **Alors** aucun SMS d'alerte n'est envoyé (marqué `skipped`, motif `sms_cap_reached`)
- **Et** le bandeau d'alerte s'affiche à l'ouverture de ma page de suivi

### 13 bis. Sans la case « Me prévenir » (E17)
- **Étant donné** que je n'ai pas coché « Me prévenir » et que la fin estimée de mon ticket dépasse la fermeture dans la fenêtre de 2 h
- **Quand** l'alerte de fin de journée est déclenchée
- **Alors** ni push ni SMS ne part (`skipped`, motif `no_consent`) : c'est un message d'anticipation
- **Et** le bandeau d'alerte s'affiche à l'ouverture de ma page de suivi
- **Quand** le gérant choisit ensuite « Annuler avec excuses » pour moi, ou que l'annulation automatique s'applique
- **Alors** la notification d'annulation par le salon part quand même, par push et par SMS (message indispensable, E17)

### 14. Réponse depuis le lien SMS
- **Étant donné** que je suis mon ticket par `/t/:shortCode`, sans session
- **Quand** je touche « Je reste »
- **Alors** mon choix est enregistré comme depuis l'app

### 15. Erreur `queue.already_resolved`
- **Étant donné** que j'ai déjà répondu « Je reste » à l'alerte
- **Quand** j'envoie de nouveau une réponse depuis une notification ou une autre page restée ouverte
- **Alors** la réponse est refusée et le ticket n'est pas modifié
- **Et** le message d'erreur `queue.already_resolved` s'affiche

### 15 bis. Erreur `queue.invalid_transition`
- **Étant donné** que mon ticket a déjà été annulé (par le gérant ou automatiquement)
- **Quand** je réponds « Je reste » depuis une notification ou une page restée ouverte
- **Alors** la réponse est refusée et le ticket n'est pas modifié
- **Et** le message d'erreur `queue.invalid_transition` s'affiche

### 16. Confidentialité de la liste des clients à risque
- **Étant donné** que je suis dans la liste des clients à risque du dashboard
- **Quand** le gérant la consulte
- **Alors** il voit mon prénom et ma réponse
- **Et** il ne voit pas mon numéro de téléphone

### 17. Les SMS de fin de journée tiennent en un seul SMS
- **Étant donné** les modèles de SMS « Risque de fin de journée » et « Annulation par le salon » (fin de journée)
- **Quand** ils sont remplis avec des valeurs de longueur maximale
- **Alors** chaque texte fait 160 caractères GSM-7 au plus

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.ticket.end_of_day.banner` | « Vous risquez de ne pas être pris avant la fermeture » | — |
| `client.ticket.end_of_day.hint` | Si vous restez, le salon décidera à la fermeture s'il peut encore vous prendre. | Sous le bandeau |
| `client.ticket.end_of_day.stay` | « Je reste » | — |
| `client.ticket.end_of_day.cancel` | « J'annule » | — |
| `notifications.end_of_day_risk.push` | Voir `notifications.end_of_day_risk.push.*` dans le dictionnaire (2 textes : « Le salon ferme bientôt » ; « {salon_name} : vous risquez de ne pas être pris avant la fermeture. Vous restez ? ») | Push avec actions `notifications.end_of_day_risk.actions.stay` et `.cancel` ; message d'anticipation (E17) |
| `notifications.end_of_day_risk.sms` | {salon_name} : vous risquez de ne pas être pris avant la fermeture. Vous restez ? Répondez : {link} | SMS : 160 caractères GSM-7 au plus (au plus 142 avec un nom de salon de 40 et le lien court) ; dans le plafond de 3 SMS ; « ê » translittéré |
| `notifications.cancelled_by_salon.end_of_day.push` | Voir `notifications.cancelled_by_salon.end_of_day.push.*` dans le dictionnaire (2 textes) | Motif, excuses, salons proches ; message indispensable (E17) |
| `notifications.cancelled_by_salon.end_of_day.sms` | {salon_name} ferme et n'a pas pu vous prendre aujourd'hui. Toutes nos excuses. Salons proches : {link} | SMS : 160 caractères GSM-7 au plus (cible du lien « Salons proches » : voir questions ouvertes) ; hors plafond (E28) |
| `client.ticket.end.reason.end_of_day` | Le salon ferme et n'a pas pu vous prendre aujourd'hui. Toutes nos excuses. | — |
| `client.nearby_salons.link` | « Salons proches » | Partagé avec U-02, U-04 |
| `errors.queue.already_resolved` | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran. | Partagé avec U-08, U-12 |
| `errors.queue.invalid_transition` | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. | Partagé avec U-07, U-08, U-12 |

## Questions ouvertes
- **Résolu le 18/10** (E5) — Heure de fermeture : la fin de la dernière plage de la journée ; voir scénario 2 bis.
- **Résolu le 19/10** (E24) — Coupure de midi : elle n'annule rien, la file reprend à la plage suivante ; voir scénario 2 quater.
- **Résolu le 18/10** (PRD §5.2, H9) — Réglage des 2 h : valeur par défaut au pilote, réglable par salon après le pilote ; cohérent avec APP_FLOW F-M11.
- **Résolu le 19/10** (BACKEND_SCHEMA v0.5 §3, constat 28) — « J'annule » sur l'alerte : `client_cancelled` ; voir scénario 7. Question d'origine : quand le client choisit « J'annule » sur l'alerte, le `cancel_reason` est-il `client_cancelled` ou `end_of_day` ? Le choix compte pour la métrique « Clients non servis en fin de journée » (PRD §8). Pour « Annuler avec excuses » et l'annulation automatique, `end_of_day` est confirmé par le schéma v0.3 (`queue_closed` retiré).
- **Résolu le 19/10** (E5, E24) — Client « Servi » non pris : annulé à minuit (heure de Paris), motif `end_of_day`, message d'excuse de l'annulation par le salon (push et SMS hors plafond) ; voir scénario 12.
- **Résolu le 19/10** (E19) — Rendez-vous encore à confirmer à la fermeture : annulé avec excuses (`end_of_day`) ; voir scénario 12 bis. Reste ouvert (PRD §5.4 / APP_FLOW §7) : par quel modèle et quel canal part ce message (`cancelled_by_salon.end_of_day` par push et SMS, ou push seulement comme un refus de rendez-vous, le client étant sur place) ?
- **Résolu le 18/10** (E5) — Clients vus par le gérant à la fermeture : tous les restants, qu'ils aient répondu ou non ; voir scénario 8 bis.
- **Résolu le 19/10** (E17) — L'annulation par le salon est un message indispensable ; l'alerte de fin de journée reste un message d'anticipation ; voir scénarios 10 et 13 bis. Question d'origine : sans la case « Me prévenir », seuls `ticket_created` et `your_turn` partent. L'alerte de fin de journée ne part donc pas (scénario 13 bis), et l'annulation avec excuses (`cancelled_by_salon`) non plus, alors que PRD §5.4 la dit envoyée « toujours » (hors plafond). L'annulation par le salon doit-elle compter parmi les messages indispensables ?
- **Résolu le 19/10** (K16) — `already_resolved` pour une seconde réponse à la même alerte, `invalid_transition` pour un ticket qui n'est plus actif ; voir scénarios 15 et 15 bis.
- **APP_FLOW F-C5** : « J'annule » sur l'alerte demande-t-il une confirmation, comme dans F-C6 et F-C8 ?
- **PRD §5.4 / APP_FLOW §7** : les « salons proches » du message d'annulation : combien, choisis comment, et donnés comment dans un SMS de 160 caractères (lien vers l'accueil ?) ?
- **Résolu le 19/10** (E28, PRD §5.4) — Plafond atteint sans push : l'alerte de fin de journée reste dans le plafond (seuls `your_turn`, `cancelled_by_salon` et `no_show_warning` en sont exclus) ; le client la voit en ouvrant sa page ; voir scénario 13.
- **Résolu le 19/10** (dictionnaire `client.json`, `notifications.json`) — SMS d'alerte, notifications d'annulation de fin de journée et raison de l'écran de fin rédigés.
