# U-11 · Être prévenu du risque de ne pas être pris avant la fermeture

**En tant que** client inscrit dans une file, **je veux** être prévenu une fois si je risque de ne pas être pris avant la fermeture, et choisir « Je reste » ou « J'annule », **afin de** ne pas attendre pour rien.

- Priorité : I (PRD §5.3)
- Règles appliquées : H9 (fin de journée) (PRD §5.1) ; règles « Fin de journée (H9) » : alerte unique à partir de 2 h avant la fermeture (valeur réglable par salon), « Servir » ou « Annuler avec excuses » à la fermeture, annulation automatique 15 min après la fermeture, aucun ticket ne passe d'un jour à l'autre (PRD §5.2) ; décision n° 19 (PRD §11) ; notifications « Risque de fin de journée » (push, SMS si pas de push dans la limite du plafond) et « Annulation par le salon » (push et SMS hors plafond) (PRD §5.4)
- Parcours : F-C5 (bandeau « Risque de fin de journée ») et F-C10 (APP_FLOW §3) ; côté gérant F-M12 ; événements « Risque de fin de journée », « Clients restants à la fermeture », « Annulation par le salon » (APP_FLOW §7)
- Commandes et données : `respond_end_of_day` (`ticket_id`, `choice` = `stay` | `cancel`) · `queue-tick` (alerte, annulation automatique) · `resolve_closing` (gérant, `serve` | `cancel`) · tables `salons` (`end_of_day_warning_minutes` défaut 120, `closing_grace_minutes` défaut 15), `opening_hours`, `tickets` (`end_of_day_warned_at`, `end_of_day_choice`, `closing_decision`, `status`, `cancel_reason`), `ticket_events` (`end_of_day_warned`, `end_of_day_responded`, `cancelled`), `notifications` (`end_of_day_risk`, `cancelled_by_salon`)

## Scénarios

### 1. Alerte à partir de 2 h avant la fermeture
- **Étant donné** un salon qui ferme à 19h00, avec le réglage par défaut de 2 h (120 min), et mon ticket dont la fin estimée est 19h10
- **Quand** il est 17h00 et qu'un événement relance le calcul
- **Alors** je reçois une notification push avec le texte « Vous risquez de ne pas être pris avant la fermeture » et les choix « Je reste » et « J'annule »
- **Et** si je n'ai pas de push actif, je reçois cette alerte par SMS, dans la limite de 3 SMS par ticket
- **Et** ma page de suivi affiche le bandeau « Vous risquez de ne pas être pris avant la fermeture » avec « Je reste » et « J'annule »
- **Et** l'envoi de l'alerte est enregistré sur le ticket (`end_of_day_warned_at`) et au journal (`end_of_day_warned`)

### 2. Pas d'alerte avant la fenêtre
- **Étant donné** le même salon qui ferme à 19h00 et mon ticket dont la fin estimée est 19h10
- **Quand** il est 16h59
- **Alors** aucune alerte de fin de journée ne m'est envoyée

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
- **Alors** mon ticket passe au statut « Annulé »
- **Et** les tickets suivants avancent
- **Et** l'écran de fin s'affiche avec « Rejoindre une autre file »
- **Et** le gérant voit « annule » pour moi dans la liste des clients à risque

### 8. Sans réponse
- **Étant donné** que j'ai reçu l'alerte et que je ne réponds pas
- **Quand** l'heure de fermeture approche
- **Alors** mon ticket reste dans la file
- **Et** le gérant voit « sans réponse » pour moi dans la liste des clients à risque

### 9. À la fermeture, le gérant choisit « Servir »
- **Étant donné** que j'attends encore à l'heure de fermeture
- **Quand** le gérant choisit « Servir » pour moi (ou pour tous)
- **Alors** mon ticket reste dans la file et je serai servi
- **Et** la décision `serve` est enregistrée sur le ticket

### 10. À la fermeture, le gérant choisit « Annuler avec excuses »
- **Étant donné** que j'attends encore à l'heure de fermeture
- **Quand** le gérant choisit « Annuler avec excuses » pour moi (ou pour tous)
- **Alors** mon ticket passe au statut « Annulé » avec le motif `end_of_day`
- **Et** je reçois une notification push et un SMS avec le motif, des excuses et des salons proches
- **Et** ce SMS est envoyé même si 3 SMS ont déjà été envoyés pour ce ticket (hors plafond)

### 11. Sans décision du gérant : annulation automatique 15 min après la fermeture
- **Étant donné** que j'attends encore à 19h00, heure de fermeture, et que le gérant n'a rien décidé pour moi
- **Quand** il est 19h15
- **Alors** mon ticket passe au statut « Annulé » avec le motif `end_of_day`
- **Et** je reçois une notification push et un SMS (hors plafond) avec un message d'excuse et des salons proches
- **Et** à 19h14, mon ticket est encore actif

### 12. Aucun ticket ne passe au lendemain
- **Étant donné** que le gérant a choisi « Servir » pour moi et que je n'ai pas été servi avant la fin de la journée de service
- **Quand** la journée de service suivante commence
- **Alors** mon ticket n'apparaît pas dans la file du lendemain

### 13. Plafond SMS atteint sans push
- **Étant donné** que je n'ai pas de push actif et que 3 SMS ont déjà été envoyés pour mon ticket
- **Quand** l'alerte de fin de journée est déclenchée
- **Alors** aucun SMS d'alerte n'est envoyé (marqué `skipped`, motif `sms_cap_reached`)
- **Et** le bandeau d'alerte s'affiche à l'ouverture de ma page de suivi

### 14. Réponse depuis le lien SMS
- **Étant donné** que je suis mon ticket par `/t/:shortCode`, sans session
- **Quand** je touche « Je reste »
- **Alors** mon choix est enregistré comme depuis l'app

### 15. Erreur `queue.invalid_transition`
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
| `client.ticket.end_of_day.stay` | « Je reste » | — |
| `client.ticket.end_of_day.cancel` | « J'annule » | — |
| `notifications.end_of_day_risk.push` | « Vous risquez de ne pas être pris avant la fermeture » | Push avec actions « Je reste » et « J'annule » |
| `notifications.end_of_day_risk.sms` | _À rédiger_ (base : « Vous risquez de ne pas être pris avant la fermeture » + lien de suivi) | SMS : 160 caractères GSM-7 au plus ; dans le plafond de 3 SMS |
| `notifications.cancelled_by_salon.end_of_day.push` | _À rédiger (absent des docs)_ | Motif, excuses, salons proches |
| `notifications.cancelled_by_salon.end_of_day.sms` | _À rédiger (absent des docs)_ | SMS : 160 caractères GSM-7 au plus ; hors plafond |
| `client.ticket.end.reason.end_of_day` | _À rédiger (absent des docs)_ | — |
| `client.nearby_salons.link` | « Salons proches » | Partagé avec U-02, U-04 |

## Questions ouvertes
- **PRD H9 / BACKEND_SCHEMA §4.7** : un salon peut avoir plusieurs plages par jour (S-03). Quelle est « l'heure de fermeture » : la fin de la plage en cours (pause de midi) ou la fin de la dernière plage du jour ? Les tickets traversent-ils une coupure de midi ?
- **PRD §5.2 / BACKEND_SCHEMA §4.3 / APP_FLOW F-M11** : le PRD dit que les 2 h sont « réglables par salon » et le schéma accepte de 30 à 240 min, mais APP_FLOW F-M11 dit que ces délais sont « réglables après le pilote ». Le réglage existe-t-il pendant le pilote ?
- **BACKEND_SCHEMA §3** : quand le client choisit « J'annule » sur l'alerte, le `cancel_reason` est-il `client_cancelled` ou `end_of_day` ? Le choix compte pour la métrique « Clients non servis en fin de journée » (PRD §8). Les scénarios 10 et 11 supposent `end_of_day` pour « Annuler avec excuses » et pour l'annulation automatique, plutôt que `queue_closed` : est-ce bien le cas ?
- **PRD §5.2 « Aucun ticket ne passe d'un jour à l'autre »** : un client que le gérant a choisi de « Servir » et qui n'est toujours pas servi à la fin de la journée de service, quel statut prend-il, avec quel motif, et quelle notification reçoit-il ?
- **PRD §5.2** : « le gérant décide pour ceux qui sont restés » vise-t-il tous les clients encore dans la file à la fermeture, ou seulement ceux qui ont répondu « Je reste » ?
- **APP_FLOW F-C5** : « J'annule » sur l'alerte demande-t-il une confirmation, comme dans F-C6 et F-C8 ?
- **PRD §5.4 / APP_FLOW §7** : les « salons proches » du message d'annulation : combien, choisis comment, et donnés comment dans un SMS de 160 caractères (lien vers l'accueil ?) ?
- **PRD §5.4** : sans push et avec un plafond SMS atteint, le client ne voit l'alerte que s'il ouvre sa page de suivi. Est-ce acceptable ?
- **Textes** : le SMS d'alerte, les notifications d'annulation de fin de journée et la raison affichée sur l'écran de fin ne figurent dans aucun document.
