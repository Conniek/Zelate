# U-15 · Être prévenu avant de partir quand le salon a du retard

**En tant que** client dont le salon a saisi le rendez-vous avec mon numéro, **je veux** être prévenu dès que le salon prend 10 min de retard sur mon rendez-vous, puis à chaque nouvel écart de 10 min, **afin de** partir de chez moi à la bonne heure au lieu d'attendre sur place.

- Priorité : I (PRD §5.3)
- Règles appliquées : H3 (3 SMS maximum par ticket), H6 (numéro jamais affiché au salon), H10 (rendez-vous du salon) (PRD §5.1) ; « Prévenir avant de partir (rendez-vous) » et calcul de l'heure de passage d'un rendez-vous (PRD §5.2) ; notification « Retard sur un rendez-vous » : push, SMS si pas de push dans la limite du plafond ; « votre tour » et l'annulation par le salon hors plafond (PRD §5.4) ; décisions R5, R6, E1 (PRD §11) ; question ouverte n° 9 sur le consentement (PRD §9)
- Parcours : F-C13 ; suivi par lien SMS F-C10 ; carte ticket d'un rendez-vous F-C5 ; saisie par le salon F-M13 et F-S10 ; événements « Ticket créé » et « Retard sur un rendez-vous » (APP_FLOW §7)
- Commandes et données : `create_appointment` (`first_name`, `scheduled_at`, `member_id`, `service_id?`, `phone?`) · `queue-tick` (alertes de retard sur rendez-vous) · `send-notifications` (plafond SMS) · Edge Function `ticket-public` · canal `ticket-token:{token_key}` · tables `tickets` (`kind` = `appointment`, `appointment_source` = `salon_entry`, `channel` = `front_desk`, `scheduled_at`, `estimated_start_at`, `appointment_delay_warned_steps`, `tracking_short_code`), `ticket_events` (`appointment_delay_warned`), `notifications` (`ticket_created`, `appointment_delay`, `status`, `skip_reason`), `push_subscriptions` (`ticket_id`), `private.ticket_contacts` · composants `TicketCard`, `AppointmentBadge`

## Scénarios

### 1. SMS avec le lien de suivi à la saisie du rendez-vous
- **Étant donné** que le gérant saisit mon rendez-vous de 14h00 avec Léa et mon numéro de téléphone
- **Quand** le rendez-vous est enregistré
- **Alors** je reçois un SMS avec l'heure du rendez-vous, l'heure de passage, le code du ticket et le lien de suivi `/t/:shortCode`
- **Et** mon numéro n'est plus jamais réaffiché au salon après l'enregistrement

### 2. Suivre mon rendez-vous par le lien
- **Étant donné** que j'ai reçu le SMS de mon rendez-vous de 14h00
- **Quand** j'ouvre le lien sans session
- **Alors** je vois l'heure du rendez-vous et l'heure de passage réelle (exemple « Rendez-vous à 14h00 · passage prévu vers 14h20 »)
- **Et** aucune position n'est affichée

### 3. Première alerte : 10 min de retard
- **Étant donné** que mon rendez-vous est à 14h00, que je n'ai pas de push actif et que l'envoi est autorisé au regard du consentement (voir scénario 12)
- **Quand** mon heure de passage estimée passe à 14h10
- **Alors** je reçois un SMS `appointment_delay` qui m'indique de venir vers 14h10
- **Et** le nombre d'alertes envoyées pour ce ticket passe à 1 (`appointment_delay_warned_steps`)
- **Et** un événement `appointment_delay_warned` est ajouté au journal du ticket

### 4. Pas d'alerte sous 10 min de retard
- **Étant donné** que mon rendez-vous est à 14h00
- **Quand** mon heure de passage estimée passe à 14h09
- **Alors** aucune notification `appointment_delay` n'est créée

### 5. Nouvelle alerte à chaque nouvel écart de 10 min
- **Étant donné** que j'ai déjà été prévenu pour 10 min de retard sur mon rendez-vous de 14h00
- **Quand** mon heure de passage estimée passe à 14h15
- **Alors** aucune nouvelle alerte n'est envoyée
- **Quand** elle passe à 14h20
- **Alors** je reçois une deuxième alerte qui m'indique de venir vers 14h20
- **Et** le nombre d'alertes envoyées passe à 2

### 6. Une seule alerte par palier
- **Étant donné** que j'ai été prévenu pour 10 min de retard
- **Quand** mon heure de passage oscille entre 14h10 et 14h19 au fil des recalculs
- **Alors** aucune autre alerte n'est envoyée pour ce palier

### 7. Push actif : pas de SMS
- **Étant donné** que j'ai activé le push depuis la page `/t/:shortCode` (abonnement lié à mon ticket)
- **Quand** mon heure de passage atteint 10 min de retard
- **Alors** je reçois l'alerte par push
- **Et** aucun SMS n'est envoyé pour cette alerte (marqué `skipped`, motif `push_active`)

### 8. Plafond de 3 SMS atteint
- **Étant donné** que je n'ai pas de push actif et que 3 SMS ont déjà été envoyés pour mon ticket
- **Quand** mon heure de passage atteint un nouveau palier de 10 min de retard
- **Alors** aucun SMS n'est envoyé (marqué `skipped`, motif `sms_cap_reached`)
- **Et** ma page de suivi affiche l'heure de passage à jour
- **Et** le SMS « votre tour » partira quand même quand Léa m'appellera

### 9. Sans téléphone saisi : aucune alerte
- **Étant donné** que le salon a saisi mon rendez-vous sans numéro de téléphone
- **Quand** son heure de passage dépasse l'heure du rendez-vous de 10 min
- **Alors** aucune notification `appointment_delay` n'est envoyée
- **Et** je peux me signaler à mon arrivée en scannant le QR de l'affiche (F-C12, U-14)

### 10. Le retard est visible au salon
- **Étant donné** que l'heure de passage de mon rendez-vous de 14h30 dépasse de 20 min l'heure prévue
- **Quand** le gérant consulte le dashboard
- **Alors** le rendez-vous affiche son heure et son retard (exemple « RDV 14h30 · +20 min »)

### 11. Mise à jour de ma page de suivi
- **Étant donné** que ma page `/t/:shortCode` est ouverte
- **Quand** mon heure de passage change
- **Alors** l'heure affichée se met à jour en moins de 2 s
- **Et** sinon, elle est relue au plus tard 30 s après, ou dès que je reviens sur la page

### 12. Consentement du client (en attente de la question n° 9 du PRD §9)
- **Étant donné** que le salon a saisi mon rendez-vous avec mon numéro et que je n'ai coché aucune case « Me prévenir »
- **Quand** mon heure de passage atteint 10 min de retard
- **Alors** _à trancher par Ely avec un avis RGPD_ : l'alerte part comme un message indispensable, ou elle demande d'abord mon accord, ou elle est marquée `skipped` (`no_consent`) comme le prévoit aujourd'hui BACKEND_SCHEMA §4.16

### 13. Confidentialité : aucun numéro côté salon
- **Étant donné** que mon rendez-vous a été saisi avec mon numéro
- **Quand** le gérant ou Léa consulte le rendez-vous, la file ou le dashboard
- **Alors** mon prénom et l'heure du rendez-vous sont affichés
- **Et** mon numéro de téléphone n'est affiché nulle part, ni dans les données reçues
- **Et** la notification enregistrée ne contient pas mon numéro dans ses variables (`params`)

### 14. Le SMS de retard tient en un seul SMS
- **Étant donné** le modèle de SMS « Retard sur un rendez-vous »
- **Quand** il est rempli avec une heure et un nom de salon de longueur maximale (40 caractères dans les SMS)
- **Alors** le texte fait 160 caractères GSM-7 au plus

### 15. Erreur `queue.invalid_phone` à la saisie
- **Étant donné** que le gérant saisit un rendez-vous avec un numéro mal formé ou hors +33
- **Quand** il enregistre (`create_appointment`)
- **Alors** le rendez-vous n'est pas créé
- **Et** le message d'erreur `queue.invalid_phone` s'affiche
- **Et** aucun SMS n'est envoyé

### 16. Erreur `queue.already_has_active_ticket` à la saisie
- **Étant donné** que mon numéro a déjà un ticket actif, dans ce salon ou dans un autre
- **Quand** le gérant saisit un rendez-vous avec ce numéro
- **Alors** le rendez-vous n'est pas créé
- **Et** le message d'erreur `queue.already_has_active_ticket` s'affiche, sans révéler dans quel salon est mon autre ticket

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `notifications.ticket_created.sms` | _À rédiger (absent des docs)_ | SMS : 160 caractères GSM-7 au plus ; pour un rendez-vous, heure du rendez-vous, heure de passage, code et lien `zelate.fr/t/xxxxxxxx` ; partagé avec U-04 |
| `notifications.appointment_delay.push` | « Le salon a du retard, venez vers {time} » (indicatif, APP_FLOW F-C13) | Variable `time` |
| `notifications.appointment_delay.sms` | « Le salon a du retard, venez vers {time} » (indicatif, APP_FLOW F-C13) | SMS : 160 caractères GSM-7 au plus, nom de salon tronqué à 40, accents translittérés ; dans le plafond de 3 SMS |
| `client.ticket.appointment.summary` | « Rendez-vous à {scheduledTime} · passage prévu vers {startTime} » | Exemple APP_FLOW F-C5 ; partagé avec U-14 |
| `common.appointment.badge_late` | « RDV {time} · +{minutes} min » | Exemple DESIGN_SYSTEM §2.4 « RDV 14h30 · +20 min » |
| `errors.queue.invalid_phone` | _À rédiger (absent des docs)_ | Côté salon ; partagé avec S-10 |
| `errors.queue.already_has_active_ticket` | _À rédiger (absent des docs)_ | Côté salon : ne nomme pas l'autre salon |

## Questions ouvertes
- **PRD §9 question n° 9 / BACKEND_SCHEMA §3 et §4.16 / TRD §8** : un rendez-vous saisi par le salon n'a pas de profil client, donc pas de `tracking_consent_at`. Avec la règle actuelle (seuls `ticket_created` et `your_turn` partent sans consentement), l'alerte `appointment_delay` serait toujours marquée `skipped` (`no_consent`) : U-15 ne fonctionnerait jamais pour son public principal. À trancher par Ely, avec avis RGPD (scénario 12 en attente).
- **PRD §5.2 / APP_FLOW F-C13** : le texte diffère : « venez à 14h20 » (PRD) ou « venez vers 14h20 » (APP_FLOW). L'heure annoncée est-elle l'heure de passage exacte ou arrondie (aux 5 min, comme l'attente affichée) ?
- **PRD §5.2 / BACKEND_SCHEMA §4.13** : si le retard saute d'un coup de 5 à 25 min, envoie-t-on une seule alerte (palier 2) ou deux (paliers 1 et 2) ? Le scénario 5 suppose une alerte par palier franchi ; à confirmer.
- **PRD §5.2 / §5.4** : si le salon rattrape son retard (mon heure revient vers 14h00), suis-je prévenu ? La notification « Changement d'heure » ne part que par push : un client sans push n'en saura rien et viendra trop tard. Le compteur `appointment_delay_warned_steps` redescend-il ?
- **PRD §5.4 / APP_FLOW F-M13** : quand le salon modifie l'heure du rendez-vous (`update_appointment`), le compteur de paliers repart-il de zéro ? Quel modèle de notification part (aucun n'est nommé pour « l'heure change de 10 min ou plus ») ?
- **PRD §5.2** : les alertes continuent-elles une fois le client arrivé, appelé ou en prestation ? Aucun état n'arrête la règle.
- **PRD §5.2 / §5.4** : la règle vaut « si le salon a saisi le téléphone du client ». Un rendez-vous signalé par le client (U-14) ou un rendez-vous saisi sans téléphone dont le client a ensuite activé le push ne reçoit-il jamais d'alerte ?
- **TRD §9 / APP_FLOW F-C13** : le SMS de retard contient-il le lien de suivi ? La place restante dans 160 caractères en dépend.
- **APP_FLOW F-S10 / F-M13** : le statut « en retard de X min » de la liste des rendez-vous désigne-t-il le retard du salon (heure de passage après l'heure prévue) ou le retard du client ? Les deux coexistent dans ces écrans.
- **BACKEND_SCHEMA §4.16** : la forme de `dedupe_key` pour `appointment_delay` n'est pas écrite (un palier = une clé, par exemple). Elle conditionne le scénario 6.
- **Textes** : les modèles push et SMS « Retard sur un rendez-vous » et le SMS d'inscription d'un rendez-vous ne sont pas rédigés ; seuls des libellés indicatifs existent.
