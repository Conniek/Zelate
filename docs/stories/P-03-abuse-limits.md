# P-03 · Limiter les abus

**En tant qu'**équipe plateforme, **je veux** limiter les abus (un ticket actif par numéro, plafonds de codes SMS par numéro et par IP, avertissement après 5 absences en 30 jours), **afin de** protéger les files des salons et maîtriser le coût des SMS.

- Priorité : I (PRD §5.3, v1.1)
- Règles appliquées : un seul ticket actif à la fois, tous salons confondus ; absences répétées : avertissement seul, par notification, à la 5e absence en 30 jours, tous salons confondus (E10), une fois par période de 30 jours, hors plafond de SMS, aucun compteur d'absences visible par le salon (E28) ; avertissement d'absences = message indispensable, envoyé sans « Me prévenir » (E17) ; une ligne de contact privé pour chaque ticket dont le numéro est connu, l'unicité par numéro excluant les rendez-vous à confirmer (K28, K14) ; annuler, même une fois appelé, n'est pas une absence (E3) ; chaque salon ne voit que ses propres données (PRD §5.1 « Autres règles ») ; plafonds de codes SMS : 5 par heure et par numéro, 20 par heure et par IP (PRD §5.3 P-03, TRD §7) ; absences enregistrées dans `private.no_show_records` par empreinte du numéro, 30 jours glissants, walk-ins compris (K8, TRD §8) ; notification « Avertissement d'absences » : push, SMS si pas de push (PRD §5.4) ; H4 (absence après 10 min) et H6 (numéro jamais affiché) (PRD §5.1) ; décision n° 17 (PRD §11) ; risque « Fraude au trafic SMS » : plafonds par numéro, par IP et par pays, +33 uniquement (PRD §9)
- Parcours : F-C3 (étapes 4 et 5), F-M7 (inscription à l'accueil, message `already_has_active_ticket`), F-C7 (libération à 10 min) (APP_FLOW) ; événement « Libération » : compteur d'absences (APP_FLOW §7)
- Commandes et données : `join_queue`, `register_walk_in` (erreurs `queue.already_has_active_ticket`, `queue.rate_limited`) · `cancel_ticket` · Edge Function `auth-send-sms` (plafonds de codes, erreur `auth.otp_rate_limited`, TRD §6.2) · `queue-tick` (`called → no_show`) · tables `tickets` (index unique partiel « un ticket actif par client », `no_show_at`, `is_test`), `private.ticket_contacts` (`phone_hash`, `is_active`, `is_pending_confirmation`), `private.no_show_records` (`phone_hash`, `ticket_id`, `occurred_at`), `private.no_show_warnings` (`phone_hash`, `warned_at`, E28), `private.rate_limits`, `notifications` (`no_show_warning`) · `check_in_appointment` (signalement non bloqué par un rendez-vous déjà saisi, K14) · tâche `daily-maintenance` (purge des `no_show_records` et `no_show_warnings` de plus de 30 jours)

## Scénarios

### 1. Un ticket actif par client, tous salons confondus

- **Étant donné** que j'ai un ticket actif au salon A
- **Quand** j'essaie de rejoindre la file du salon B
- **Alors** aucun ticket n'est créé au salon B
- **Et** l'erreur `queue.already_has_active_ticket` s'affiche avec « Voir ma place »

### 2. Un ticket actif par numéro, inscription à l'accueil comprise

- **Étant donné** qu'un numéro a déjà un ticket actif, créé depuis l'app ou à l'accueil d'un autre salon
- **Quand** un gérant inscrit ce même numéro à l'accueil de son salon
- **Alors** aucun ticket n'est créé
- **Et** le gérant voit le message `queue.already_has_active_ticket`
- **Et** le message ne révèle ni le numéro ni le salon où se trouve l'autre ticket

### 2 bis. Signalement d'un rendez-vous déjà saisi pour ce numéro (K14, K28)

- **Étant donné** un rendez-vous saisi aujourd'hui par le salon avec le numéro de Léa, au statut « En attente »
- **Quand** Léa, connectée avec ce numéro, se signale pour ce rendez-vous par le QR de l'affiche
- **Alors** son signalement est créé au statut « À confirmer », sans erreur `queue.already_has_active_ticket`
- **Et** la fusion avec le rendez-vous saisi est proposée au salon
- **Et** une fois la fusion faite, un seul ticket actif reste pour ce numéro

### 3. Nouveau ticket possible après la clôture du précédent

- **Étant donné** que mon dernier ticket est « Terminé », « Annulé » ou « Absent »
- **Quand** je rejoins une file
- **Alors** le ticket est créé

### 4. Les tickets de test ne bloquent pas

- **Étant donné** un ticket de test (`is_test`) créé pour le test d'un salon
- **Quand** un client réel rejoint une file
- **Alors** le ticket de test n'empêche la création d'aucun ticket

### 5. Plafond de 5 codes SMS par heure et par numéro

- **Étant donné** que 5 codes de connexion ont été envoyés à un numéro dans l'heure
- **Quand** un 6e code est demandé pour ce numéro, depuis n'importe quel appareil
- **Alors** aucun SMS n'est envoyé
- **Et** l'erreur `auth.otp_rate_limited` est renvoyée, avec un message qui indique de réessayer plus tard

### 6. Plafond de 20 codes SMS par heure et par IP

- **Étant donné** que 20 codes de connexion ont été demandés depuis une adresse IP dans l'heure
- **Quand** un 21e code est demandé depuis cette adresse IP pour un autre numéro
- **Alors** aucun SMS n'est envoyé
- **Et** l'erreur `auth.otp_rate_limited` est renvoyée

### 7. Numéros hors +33 refusés

- **Étant donné** un numéro qui n'est pas un numéro +33
- **Quand** un code de connexion est demandé pour ce numéro
- **Alors** la demande est refusée
- **Et** aucun SMS n'est envoyé

### 8. Une absence est comptée à la libération automatique

- **Étant donné** que j'ai été appelé et que mon arrivée n'est pas validée
- **Quand** 10 min se sont écoulées depuis l'appel
- **Alors** mon ticket passe au statut « Absent »
- **Et** une ligne est ajoutée dans `private.no_show_records` avec l'empreinte de mon numéro, le ticket et l'heure

### 9. Une annulation ne compte pas comme absence, même une fois appelé (E3)

- **Étant donné** que mon ticket est « En attente » ou « Appelé »
- **Quand** je l'annule
- **Alors** aucune ligne n'est ajoutée dans `private.no_show_records`

### 10. Avertissement à la 5e absence en 30 jours (E10)

- **Étant donné** que j'ai 4 absences dans les 30 derniers jours
- **Quand** une 5e absence est enregistrée
- **Alors** je reçois la notification `no_show_warning` par push, ou par SMS si je n'ai pas de push actif
- **Et** je peux toujours rejoindre une file : aucun blocage n'est appliqué
- **Et** ni le gérant ni l'admin ne reçoivent d'avertissement
- **Et** l'avertissement est noté pour mon numéro (`private.no_show_warnings`)

### 10 quater. Avertissement sans « Me prévenir » et plafond SMS atteint (E17, E28)

- **Étant donné** que j'ai 4 absences dans les 30 derniers jours, que je n'ai pas coché « Me prévenir », que je n'ai pas de push actif et que mon ticket a déjà reçu 3 SMS
- **Quand** une 5e absence est enregistrée
- **Alors** je reçois le SMS `no_show_warning` (message indispensable, hors plafond)

### 10 quinquies. Une seule fois par période de 30 jours (E28)

- **Étant donné** que j'ai reçu un avertissement il y a 12 jours
- **Quand** une 6e puis une 7e absence sont enregistrées dans les 30 jours
- **Alors** aucune nouvelle notification `no_show_warning` n'est créée
- **Quand** une nouvelle 5e absence en 30 jours est enregistrée plus de 30 jours après le dernier avertissement
- **Alors** je reçois à nouveau la notification `no_show_warning`

### 10 bis. Absences comptées tous salons confondus (E10, K8)

- **Étant donné** que j'ai 2 absences au salon A et 2 au salon B dans les 30 derniers jours
- **Quand** une 5e absence est enregistrée au salon C
- **Alors** je reçois la notification `no_show_warning`

### 10 ter. Absences d'un client inscrit à l'accueil (K8)

- **Étant donné** qu'un numéro a 4 absences en 30 jours, dont certaines sur des tickets inscrits à l'accueil (walk-in) dont le contact a été effacé 24 h après la clôture
- **Quand** une 5e absence est enregistrée pour ce numéro, depuis l'app ou à l'accueil
- **Alors** les 5 absences sont comptées, l'empreinte du numéro étant calculée avec le même secret pour un client connecté et pour un walk-in
- **Et** la notification `no_show_warning` part vers ce numéro

### 11. Pas d'avertissement en dessous du seuil

- **Étant donné** que j'ai 3 absences dans les 30 derniers jours
- **Quand** une 4e absence est enregistrée
- **Alors** aucun avertissement n'est émis

### 12. Absences hors de la fenêtre de 30 jours

- **Étant donné** que j'ai 5 absences, dont la plus ancienne date de 31 jours
- **Quand** l'avertissement est évalué
- **Alors** seules 4 absences comptent dans les 30 derniers jours
- **Et** aucun avertissement n'est émis
- **Et** la ligne de plus de 30 jours est supprimée de `private.no_show_records` par la tâche de nuit

### 13. Confidentialité de l'avertissement

- **Étant donné** qu'un client a atteint 5 absences en 30 jours
- **Quand** le gérant ou un coiffeur consulte la file
- **Alors** il ne voit pas le numéro de téléphone du client
- **Et** il ne voit aucun compteur d'absences de ce client, ni de son salon ni d'un autre (E28)
- **Et** il ne voit pas que le client a été averti

## Textes à prévoir

| Clé (anglais)                                        | Texte (français)                                                                                                                                                                                                  | Contrainte                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `errors.queue.already_has_active_ticket`             | Ce numéro a déjà une place en cours. Une seule place à la fois est possible.                                                                                                                                      | Partagé avec U-04 ; ne révèle ni numéro ni autre salon                                                                    |
| `errors.queue.rate_limited`                          | Trop de demandes en peu de temps. Patientez quelques minutes, puis réessayez.                                                                                                                                     | Plafond de création de tickets ; partagé avec U-04                                                                        |
| `errors.auth.otp_rate_limited`                       | Trop de codes ont été demandés en peu de temps. Réessayez plus tard.                                                                                                                                              | Plafond de codes SMS ; partagé avec U-03                                                                                  |
| `errors.auth.phone_not_supported`                    | Zelaté accepte pour l'instant les numéros français uniquement (+33).                                                                                                                                              | Partagé avec U-03                                                                                                         |
| `notifications.no_show_warning.push.title` / `.body` | Titre : Pensez à annuler si vous ne venez pas<br>Corps : Vous comptez {count, plural, one {# absence} other {# absences}} en 30 jours. Si vous ne pouvez pas venir, annulez : la place revient à un autre client. | Avertissement seul, sans blocage (E10) ; une fois par 30 jours (E28) ; message indispensable (E17) ; ne nomme aucun salon |
| `notifications.no_show_warning.sms`                  | Zelaté : vous comptez {count, plural, one {# absence} other {# absences}} en 30 jours. Si vous ne pouvez pas venir, annulez votre place : elle profitera à un autre client.                                       | SMS : 160 caractères GSM-7 au plus, accents translittérés (K5) ; si pas de push ; hors plafond de 3 SMS (E28)             |

## Questions ouvertes

- **Résolu le 18/10** (E10) — Avertissement : envoyé au client, par notification, à la 5e absence en 30 jours, tous salons confondus ; voir scénarios 10 et 10 bis. Reste à rédiger le texte.
- **Résolu le 18/10** (K8) — Stockage des absences : `private.no_show_records`, une ligne par absence et par empreinte du numéro, 30 jours glissants, purge chaque nuit ; voir scénarios 8 et 12.
- **Résolu le 19/10 (E28, APP_FLOW v0.6 §7)** : le salon ne voit aucun compteur d'absences d'un client ; le dashboard marque seulement le ticket « absent » (scénario 13). Question d'origine : la ligne « Libération » d'APP_FLOW §7 affichait un « compteur d'absences » sur le dashboard, alors que `private.no_show_records` n'est jamais lisible par un salon. Que voit exactement le gérant : le nombre d'absences du jour de son salon (`tickets.no_show_at`), ou autre chose ? Il ne doit voir aucune absence venue d'un autre salon (scénario 13).
- **Résolu le 18/10** (K8) — Absences des walk-ins : comptées grâce à l'empreinte du numéro, calculée avec le même secret pour tous ; voir scénario 10 ter.
- **Résolu le 18/10** (PRD v1.1 P-03) — Valeurs des plafonds de codes SMS : 5 par heure et par numéro, 20 par heure et par IP ; voir scénarios 5 et 6.
- **PRD P-03 / BACKEND_SCHEMA §5** : la fenêtre d'une heure est-elle glissante ou fixe (`private.rate_limits.window_start` laisse penser à une fenêtre fixe) ?
- **BACKEND_SCHEMA §5** : `private.rate_limits` prévoit aussi un plafond de « création de tickets », absent du PRD. Seul `create_appointment` a une valeur (60 par heure et par salon, K15) ; quelle valeur et quelle clé pour `join_queue` et `register_walk_in` ? Le code renvoyé est le code commun `queue.rate_limited` (TRD §6.2).
- **Résolu le 18/10** (K1) — Code d'erreur de `auth-send-sms` : `auth.otp_rate_limited` (TRD §6.2).
- **Résolu le 19/10 (E28)** : l'avertissement part hors plafond SMS, une fois par période de 30 jours et par numéro (scénarios 10 quater et 10 quinquies). Question d'origine : compte-t-il dans le plafond de 3 SMS ?
- **Résolu le 19/10 (E17)** : `no_show_warning` est un message indispensable, envoyé sans « Me prévenir » (scénario 10 quater). Question d'origine : un client sans la case n'était jamais averti.
- **BACKEND_SCHEMA §4.16 / §5** (reste ouvert après K28, qui garde le contact 24 h après la clôture, donc le numéro de la 5e absence est disponible) : vers quoi part `no_show_warning` pour un walk-in dont le contact (`private.ticket_contacts`) a été effacé ? Le numéro de la 5e absence est disponible, mais à quel ticket la notification est-elle rattachée (`notifications.ticket_id`) ?
- **PRD §5.1 « isolation par salon »** : pour un walk-in déjà inscrit ailleurs, le message `already_has_active_ticket` affiché au gérant peut-il dire que le numéro a une place dans un autre salon ? Le scénario 2 suppose qu'il ne doit pas le dire.
- **Résolu le 18/10** (PRD v1.1 §5.3) — Priorité : P-03 passe en I.
