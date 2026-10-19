# U-06 · Suivre ma position et mon heure de passage

**En tant que** client inscrit dans une file, **je veux** suivre en temps réel ma position et mon heure de passage, avec mon code de ticket bien visible, **afin d'**arriver au salon juste à temps.

- Priorité : I (PRD §5.3)
- Règles appliquées : H2 (heure simulée), H3 (T-10 et « votre tour » ; 3 SMS maximum par ticket), H4 (compteur de 10 min, rappel à 5 min sans SMS, place libérée à 10 min), H7 (arrivée validée par le code du ticket de 5 caractères), H10 (rendez-vous du salon) (PRD §5.1) ; position = nombre de clients avant lui chez son coiffeur, demandé ou pressenti (E13) ; le SMS « votre tour » part toujours, même plafond atteint (E1) ; sans la case « Me prévenir », seuls les messages d'anticipation (préparez-vous, votre tour approche, changement d'heure, fin de journée) sont retenus, les messages indispensables partent toujours (E17) ; la case s'active aussi depuis le lien de suivi (`set_notifications_consent`, K34) ; un client avec rendez-vous donne son code à l'appel (E21) ; un rendez-vous à confirmer est annulable par le client (E19) ; plafond SMS hors `your_turn`, `cancelled_by_salon` et `no_show_warning` (E28) (PRD §5.1 « Autres règles ») ; chaque appel incrémente `call_count` (K31) ; adresse du salon tronquée à 30 caractères dans les SMS « préparez-vous » et « votre tour » (K20) ; transitions 1b, 2, 4 et 7, calcul de l'attente affichée (PRD §5.2) ; notifications « Préparez-vous », « Votre tour », « Rappel », « Place libérée », « Rendez-vous refusé » (PRD §5.4) ; mise à jour en moins de 2 s page ouverte, sinon toutes les 30 s (PRD §5.3 U-06, PRD §6) ; « votre tour » envoyé en moins de 5 s (PRD §5.3 C-04) ; SMS en 160 caractères GSM-7 : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (K5, TRD §9)
- Parcours : F-C5, F-C7, F-C10 (APP_FLOW §3) ; carte d'un rendez-vous et rendez-vous à confirmer (F-C5, F-C12 ; U-14, U-15) ; garde `/ticket` (APP_FLOW §2.3) ; événements « Préparez-vous », « Votre tour », « Rappel », « Libération », « Rendez-vous confirmé ou refusé » (APP_FLOW §7) ; états « Hors ligne » (APP_FLOW §8)
- Commandes et données : RPC `my_active_ticket()` · Edge Function `ticket-public` (page `/t/:shortCode`, lien court de 8 caractères) · canaux `ticket:{ticket_id}` et `ticket-token:{token_key}` (`ticket_updated`, TRD ADR-018, §6.4) · `queue-tick` (T-10, rappel, libération) · tables `tickets` (`short_code`, `tracking_short_code`, `kind`, `scheduled_at`, `queue_rank`, `requested_member_id`, `estimated_member_id`, `estimated_start_at`, `declared_arrival_at`, `status` dont `pending_confirmation`, `notifications_consent_at`, `call_count`, `called_at`, `release_due_at`, `reminder_sent_at`, `get_ready_sent_at`, `arrived_at`, `no_show_at`), `private.no_show_records`, `notifications` (`get_ready`, `your_turn` clé `your_turn:<call_count>`, `arrival_reminder` clé `arrival_reminder:<call_count>`, `released_no_show`, `no_show_warning`, `appointment_confirmed`, `appointment_rejected`) · `set_notifications_consent` (`ticket_id`, `consent`)

## Scénarios

### 1. Carte du ticket
- **Étant donné** que j'ai un ticket « En attente »
- **Quand** j'ouvre `/ticket`
- **Alors** le code du ticket (exemple « #AF2K9 ») est affiché en grand, avec l'indication qu'il faut le donner au coiffeur
- **Et** ma position et mon heure de passage sont affichées
- **Et** le prénom du coiffeur demandé, ou « premier disponible », est affiché
- **Et** l'heure de la dernière mise à jour est affichée (exemple « mis à jour à 14h32 »)

### 1 bis. Position = clients avant moi chez mon coiffeur (E13)
- **Étant donné** que 6 tickets du salon ont été créés avant le mien, que je n'ai pas de préférence et que 2 d'entre eux sont placés avant moi chez mon coiffeur pressenti
- **Quand** ma carte de ticket s'affiche
- **Alors** ma position indique 2 clients avant moi
- **Et** les tickets placés chez les autres coiffeurs ne sont pas comptés
- **Quand** j'ai demandé un coiffeur précis
- **Alors** ma position compte les clients placés avant moi chez ce coiffeur demandé

### 1 ter. Carte d'un ticket de rendez-vous (H10)
- **Étant donné** que mon ticket est un rendez-vous (`kind` = `appointment`) à 14h00, confirmé, et que mon heure de passage estimée est 14h20
- **Quand** j'ouvre ma page de suivi
- **Alors** l'heure du rendez-vous et l'heure de passage sont affichées (exemple APP_FLOW F-C5 : « Rendez-vous à 14h00 · passage prévu vers 14h20 »)
- **Et** aucune position n'est affichée
- **Et** le code du ticket est affiché, à donner au coiffeur à l'appel comme les autres clients (E21)

### 1 quater. Rendez-vous « à confirmer » (renvoi vers U-14)
- **Étant donné** que je me suis signalé pour un rendez-vous par le QR de l'affiche et que le salon ne l'a pas encore confirmé (statut `pending_confirmation`)
- **Quand** j'ouvre ma page de suivi
- **Alors** le message « Le salon confirme votre rendez-vous… » est affiché
- **Et** aucune heure de passage ni aucune position n'est affichée
- **Quand** le gérant ou mon coiffeur confirme le rendez-vous
- **Alors** ma page affiche la carte du scénario 1 ter, avec mon heure de passage
- **Et** je reçois la notification push `appointment_confirmed` avec mon heure de passage, même sans la case « Me prévenir » (message indispensable, E17)
- **Quand** le salon refuse le rendez-vous
- **Alors** l'écran de fin s'affiche avec le motif choisi par le salon et « Rejoindre la file » (F-C12, E29)
- **Et** je reçois la notification push `appointment_rejected` avec ce motif, sans SMS, même sans la case « Me prévenir » (E17)
- **Quand** je touche « Annuler ma place » pendant l'attente de confirmation
- **Alors** mon signalement est annulé (`cancel_ticket`, motif `client_cancelled`, E19 ; détail dans U-08)

### 2. Attente arrondie aux 5 min supérieures
- **Étant donné** qu'il est 14h00, que mon heure de passage simulée est 14h32 et que je n'ai pas déclaré d'heure d'arrivée
- **Quand** mon ticket s'affiche
- **Alors** l'attente affichée est de 35 min

### 3. Mise à jour en temps réel, page ouverte
- **Étant donné** que ma page de suivi est ouverte et connectée
- **Quand** un coiffeur termine une prestation et que l'heure de passage des tickets est recalculée
- **Alors** ma position et mon heure de passage se mettent à jour en moins de 2 s

### 4. Repli sans temps réel
- **Étant donné** que le temps réel n'est pas disponible sur mon appareil
- **Quand** ma page de suivi reste ouverte
- **Alors** les informations du ticket sont relues toutes les 30 s
- **Et** elles sont relues aussi dès que je reviens sur l'app

### 5. Hors ligne
- **Étant donné** que ma page de suivi est ouverte
- **Quand** mon téléphone perd la connexion
- **Alors** un bandeau « Connexion perdue, dernière mise à jour à … » s'affiche avec l'heure de la dernière donnée reçue
- **Et** les dernières informations reçues restent affichées

### 6. « Préparez-vous » à T-10
- **Étant donné** que j'ai coché « Me prévenir » et que mon heure de passage arrive à 10 min ou moins
- **Quand** le moteur détecte ce seuil
- **Alors** je reçois une notification push « Préparez-vous » avec l'heure, l'adresse et l'itinéraire
- **Et** si je n'ai pas de push actif, je la reçois par SMS (SMS 2)
- **Et** l'envoi est enregistré sur le ticket (`get_ready_sent_at`)

### 6 bis. « Préparez-vous » une seule fois
- **Étant donné** que j'ai déjà reçu « Préparez-vous »
- **Quand** mon heure de passage remonte au-dessus de 10 min puis redescend à 10 min ou moins
- **Alors** je ne reçois pas de second « Préparez-vous » (`get_ready_sent_at` déjà renseigné, BACKEND_SCHEMA §10)

### 7. Appel : « C'est votre tour ! »
- **Étant donné** que mon ticket est en tête pour un coiffeur disponible
- **Quand** le coiffeur m'appelle
- **Alors** mon ticket passe au statut « Appelé »
- **Et** un écran plein « C'est votre tour ! » s'affiche avec le prénom du coiffeur, l'adresse du salon, le code du ticket en grand et un compteur de 10 min
- **Et** je reçois une notification push en priorité haute
- **Et** je reçois aussi un SMS « votre tour », que j'aie ou non un push actif, et même sans la case « Me prévenir » (E1, E17)
- **Et** la notification « votre tour » part en moins de 5 s après l'appel
- **Et** le nombre d'appels de mon ticket passe à 1 (`call_count`), et la notification porte la clé `your_turn:1` (K31)

### 7 bis. Second appel après « Prendre le suivant » (K31)
- **Étant donné** que j'ai déclaré un retard, que le coiffeur m'a appelé puis a choisi « Prendre le suivant » (U-07, C-09)
- **Quand** il m'appelle de nouveau
- **Alors** je reçois de nouveau « votre tour » par push et par SMS (clé `your_turn:2`)
- **Et** un nouveau compteur démarre ; les heures du premier appel (`called_at`, `reminder_sent_at`, `release_due_at`) avaient été vidées en quittant « Appelé »

### 8. « Votre tour » part même plafond atteint (E1)
- **Étant donné** que je n'ai pas de push actif et que 3 SMS ont déjà été envoyés pour mon ticket (par exemple inscription, choix de coiffeur et préparez-vous)
- **Quand** le coiffeur m'appelle
- **Alors** le SMS « votre tour » est envoyé quand même
- **Et** il n'est pas marqué `skipped` (`sms_cap_reached`)
- **Et** ce ticket a reçu 4 SMS au total

### 8 bis. Sans la case « Me prévenir » (E17)
- **Étant donné** que je n'ai pas coché « Me prévenir » à l'inscription
- **Quand** mon heure de passage arrive à 10 min ou moins, puis que le coiffeur m'appelle, puis que 5 min passent sans arrivée
- **Alors** la notification « Préparez-vous » ne part pas (`skipped`, motif `no_consent`)
- **Et** la notification « votre tour » part par push et par SMS
- **Et** le rappel à 5 min part quand même : c'est un message indispensable (E17)
- **Et** ma page de suivi affiche quand même l'écran « C'est votre tour ! » avec le compteur

### 9. Rappel à 5 min, sans SMS
- **Étant donné** que j'ai été appelé il y a 5 min, que je n'ai pas déclaré de retard et que mon arrivée n'est pas validée, avec ou sans la case « Me prévenir » (E17)
- **Quand** les 5 min sont atteintes
- **Alors** je reçois la notification push « Le salon vous attend, place libérée dans 5 min »
- **Et** aucun SMS n'est envoyé pour ce rappel
- **Et** le rappel n'est envoyé qu'une fois pour cet appel (`reminder_sent_at`, clé `arrival_reminder:<call_count>`)
- **Et** l'heure de ce rappel pour un client qui a déclaré un retard dépend de E33 (en attente d'Ely)

### 10. Arrivée validée par le code
- **Étant donné** que j'ai été appelé et que je donne mon code au coiffeur
- **Quand** le coiffeur saisit ce code
- **Alors** mon arrivée est horodatée
- **Et** mon écran affiche « Installez-vous »

### 11. Place libérée à 10 min
- **Étant donné** que j'ai été appelé il y a 10 min, que je n'ai pas déclaré de retard et que mon arrivée n'est pas validée
- **Quand** les 10 min sont atteintes (`release_due_at`)
- **Alors** mon ticket passe au statut « Absent »
- **Et** une absence est enregistrée pour mon numéro (`private.no_show_records`, voir P-03)
- **Et** je reçois une notification push qui me propose de me réinscrire, même sans la case « Me prévenir » (`released_no_show`, message indispensable, E17)
- **Et** mon écran affiche l'écran de fin avec la raison et le bouton « Rejoindre une autre file »

### 11 bis. Cinquième absence en 30 jours (renvoi vers P-03)
- **Étant donné** que mon numéro compte déjà 4 absences en 30 jours, tous salons confondus, et qu'aucun avertissement ne m'a été envoyé dans les 30 derniers jours
- **Quand** ma place est libérée faute d'arrivée
- **Alors** je reçois l'avertissement d'absences (`no_show_warning`) par push, ou par SMS si je n'ai pas de push actif, hors plafond de 3 SMS (E28)
- **Et** une 6e absence dans les 30 jours ne déclenche pas de second avertissement (E28)
- **Et** le salon ne voit aucun compteur de mes absences (E28)

### 12. Ticket terminé ou annulé
- **Étant donné** que mon ticket est passé au statut « Terminé » ou « Annulé »
- **Quand** j'ouvre `/ticket`
- **Alors** l'écran de fin affiche la raison
- **Et** le bouton « Rejoindre une autre file » ouvre l'accueil (F-C1)

### 13. Actions depuis la carte du ticket
- **Étant donné** que mon ticket est « En attente »
- **Quand** je touche « Itinéraire »
- **Alors** l'application de cartes de l'appareil s'ouvre sur l'adresse du salon
- **Quand** je touche « Je serai en retard »
- **Alors** le choix d'un retard de 5 à 30 min s'ouvre (voir U-07)
- **Quand** je touche « Annuler ma place »
- **Alors** la confirmation d'annulation s'ouvre (voir U-08)

### 14. Accès sans connexion
- **Étant donné** que je ne suis pas connecté
- **Quand** j'ouvre `/ticket`
- **Alors** je suis redirigé vers `/signin?next=/ticket`

### 15. Suivi par lien SMS
- **Étant donné** que j'ai reçu un SMS avec le lien court `zelate.fr/t/xxxxxxxx` (8 caractères) d'un ticket de moins de 24 h
- **Quand** j'ouvre ce lien sans session
- **Alors** le lien court est résolu par `ticket-public`
- **Et** je vois le même affichage que sur `/ticket`
- **Et** je peux répondre à T-30, signaler un retard, choisir « attendre » ou « premier disponible », accepter ou refuser une réaffectation, répondre à l'alerte de fin de journée, annuler, activer le push et activer « Me prévenir »
- **Et** un lien « Créer mon compte » est proposé

### 15 ter. Activer « Me prévenir » depuis le lien de suivi (E17, K34)
- **Étant donné** que le gérant m'a inscrit à l'accueil (ou a saisi mon rendez-vous avec mon numéro) et que je n'ai donc jamais vu la case « Me prévenir »
- **Quand** j'ouvre le lien de suivi reçu par SMS et que j'active « Me prévenir »
- **Alors** la commande `set_notifications_consent` part avec `consent` vrai, au titre du jeton de suivi
- **Et** l'heure de mon consentement est enregistrée sur le ticket (`notifications_consent_at`)
- **Et** les messages d'anticipation suivants de ce ticket (votre tour approche, préparez-vous, changement d'heure, fin de journée) me sont envoyés
- **Quand** je le désactive
- **Alors** `notifications_consent_at` est vidé et seuls les messages indispensables partent
- **Quand** le ticket est déjà terminé, annulé ou absent
- **Alors** la commande est refusée avec `queue.invalid_transition` (jamais `queue.already_resolved`, K34)

### 15 bis. Lien SMS à jour en temps réel (K6)
- **Étant donné** que ma page `/t/:shortCode` est ouverte et connectée, sans session
- **Quand** un coiffeur termine une prestation et que mon heure de passage est recalculée
- **Alors** ma position et mon heure de passage se mettent à jour en moins de 2 s, par le canal `ticket-token:{token_key}`
- **Et** le message reçu sur ce canal ne contient aucune donnée personnelle (seulement `{ version }`)
- **Quand** le temps réel n'est pas disponible
- **Alors** les informations sont relues toutes les 30 s et au retour sur la page

### 16. Lien de suivi expiré
- **Étant donné** un lien `/t/:shortCode` dont le jeton est inconnu ou dont le ticket date de plus de 24 h
- **Quand** je l'ouvre
- **Alors** le message « Ce lien a expiré » s'affiche
- **Et** aucune information de ticket n'est affichée

### 17. Les SMS du suivi tiennent en un seul SMS
- **Étant donné** les modèles de SMS « Préparez-vous » (SMS 2) et « Votre tour »
- **Quand** ils sont remplis avec des valeurs de longueur maximale : prénom du coiffeur de 30 caractères, nom du salon de 80 caractères, adresse du salon, code, lien court `zelate.fr/t/xxxxxxxx`
- **Alors** le nom du salon est tronqué à 40 caractères et l'adresse du salon à 30 caractères (K20)
- **Et** les accents et les caractères hors GSM-7 sont translittérés avant l'envoi
- **Et** chaque texte fait 160 caractères GSM-7 au plus (lien « Itinéraire » de « Préparez-vous » : voir questions ouvertes)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.ticket.code.label` | Votre code, à donner au coiffeur | Code en grand ; à donner au coiffeur |
| `client.ticket.position` | {count, plural, =0 {Personne avant vous} one {# client avant vous} other {# clients avant vous}} | Pluriel ICU |
| `client.ticket.estimated_time` | Passage prévu vers {time} | Variable `time` |
| `client.ticket.stylist.first_available` | « premier disponible » | — |
| `client.ticket.appointment.times` | Rendez-vous à {appointment_time} · passage prévu vers {start_time} (APP_FLOW F-C5, indicatif : « Rendez-vous à 14h00 · passage prévu vers 14h20 ») | Variables `appointment_time`, `start_time` ; pas de position ; doublon de `client.ticket.appointment.summary` (U-14, U-15) |
| `client.ticket.appointment.pending` | Le salon confirme votre rendez-vous… (APP_FLOW F-C5, indicatif : « Le salon confirme votre rendez-vous… ») | Partagé avec U-14 |
| `client.ticket.end.reason.appointment_rejected` | Le salon n'a pas retrouvé votre rendez-vous. Vous pouvez rejoindre la file sans rendez-vous. | Avec « Rejoindre la file » ; partagé avec U-14 ; texte écrit pour le seul cas « rendez-vous introuvable », alors que le motif vient d'une liste (E29) |
| `client.ticket.end.removal_reason` | Motif : {reason} | Motif d'un refus ou d'une annulation par le salon (E29) |
| `client.ticket.appointment.pending_hint` | Votre heure de passage s'affichera dès que le salon aura confirmé. | Rendez-vous à confirmer |
| `notifications.appointment_confirmed.push` | Voir `notifications.appointment_confirmed.push.*` dans le dictionnaire (2 textes) | Push ; heure de passage ; message indispensable (E17) ; partagé avec U-14 |
| `notifications.appointment_rejected.push` | Voir `notifications.appointment_rejected.push.*` dans le dictionnaire (2 textes) | Push seulement ; variable `reason` (E29) ; message indispensable (E17) ; partagé avec U-14 |
| `client.ticket.updated_at` | « mis à jour à {time} » (exemple APP_FLOW : « mis à jour à 14h32 ») | Format fr-FR |
| `common.actions.directions` | « Itinéraire » | Partagé avec U-02 |
| `client.ticket.actions.late` | « Je serai en retard » | — |
| `client.ticket.actions.cancel` | « Annuler ma place » | Partagé avec U-08 |
| `client.ticket.called.title` | « C'est votre tour ! » | — |
| `client.ticket.called.countdown` | Temps restant pour arriver : {remaining} | Compteur de 10 min |
| `client.ticket.arrived.title` | « Installez-vous » | — |
| `client.ticket.end.rejoin` | « Rejoindre une autre file » | — |
| `client.ticket.end.reason.completed` | Votre passage chez {salon_name} est terminé. À bientôt ! | — |
| `client.ticket.end.reason.no_show` | Votre place a été libérée : le salon ne vous a pas vu arriver à temps après l'appel. | — |
| `client.ticket.offline` | « Connexion perdue, dernière mise à jour à {time} » | — |
| `client.tracking.expired` | « Ce lien a expiré » | — |
| `client.tracking.create_account` | « Créer mon compte » | — |
| `notifications.get_ready.push` | Voir `notifications.get_ready.push.*` dans le dictionnaire (2 textes) | Heure, adresse, itinéraire |
| `notifications.get_ready.sms` | {salon_name} : préparez-vous, passage vers {time}. Adresse : {address}. Itinéraire : {link} | SMS : 160 caractères GSM-7 au plus, avec heure, adresse, itinéraire ; nom du salon tronqué à 40, adresse tronquée à 30, accents translittérés (K5, K20) ; dans le plafond de 3 SMS ; message d'anticipation (consentement, E17) |
| `notifications.your_turn.push` | Voir `notifications.your_turn.push.*` dans le dictionnaire (2 textes) | Priorité haute ; prénom du coiffeur, adresse, code ; message indispensable (E17) |
| `notifications.your_turn.sms` | Zelaté : c'est votre tour ! {stylist_first_name} vous attend, {address}. Code {code}. Venez sous 10 min : {link} | SMS : 160 caractères GSM-7 au plus, avec prénom du coiffeur (≤ 30), adresse tronquée à 30, code ; accents translittérés (K5, K20) ; hors plafond (E1, E28) |
| `notifications.arrival_reminder.push.title` | Le salon vous attend | Push seulement ; message indispensable (E17) |
| `notifications.arrival_reminder.push.body` | Votre place sera libérée dans 5 min. Donnez le code {code} à {stylist_first_name} en arrivant. | Push seulement |
| `notifications.no_show_warning.push` | Voir `notifications.no_show_warning.push.*` dans le dictionnaire (2 textes) | Une fois par 30 jours ; partagé avec P-03 |
| `notifications.no_show_warning.sms` | Zelaté : vous comptez {count, plural, one {# absence} other {# absences}} en 30 jours. Si vous ne pouvez pas venir, annulez votre place : elle profitera à un autre client. | SMS : 160 caractères GSM-7 au plus ; hors plafond (E28) |
| `legal.consent.tracking_notifications.switch` | Notifications de suivi | Interrupteur « Me prévenir » de `/t/:shortCode` (E17, K34) ; libellé de cette page non décrit par APP_FLOW F-C10 |
| `notifications.released_no_show.push` | Voir `notifications.released_no_show.push.*` dans le dictionnaire (2 textes) | Push seulement ; proposition de se réinscrire ; message indispensable (E17) |

## Questions ouvertes
- **Résolu le 18/10** (E13) — Position : nombre de clients avant lui chez son coiffeur, demandé ou pressenti ; voir scénario 1 bis.
- **Résolu le 18/10** (K6) — Temps réel de `/t/:shortCode` : canal public `ticket-token:{token_key}` (TRD ADR-018), repli à 30 s ; voir scénario 15 bis.
- **Résolu le 18/10** (E1) — SMS « votre tour » plafond atteint : il part toujours, hors plafond ; voir scénario 8.
- **Résolu le 18/10** (K5) — Longueurs dans les SMS : prénom ≤ 30, nom du salon tronqué à 40, accents et caractères hors GSM-7 translittérés, lien court de 8 caractères ; voir scénario 17.
- **Résolu le 19/10** (K20) — Adresse du salon dans les SMS « Préparez-vous » et « Votre tour » : tronquée à 30 caractères ; voir scénario 17.
- **TRD §9 / notifications.json** : le SMS « Préparez-vous » se termine par « Itinéraire : {link} ». Quel lien (lien court `zelate.fr/t/…` de 20 caractères, ou lien de carte plus long) ? La tenue en 160 caractères en dépend (avec le lien court, le texte fait au plus 153 caractères).
- **Rattachée à E36** (client appelé repris en tête, en attente d'Ely) : quand mon coiffeur devient indisponible alors que je suis appelé, que voit ma page (retour à l'attente, compteur arrêté) et quelle notification reçois-je ? Aucun scénario n'est écrit avant la réponse.
- **Résolu le 19/10** (E17) — Rappel à 5 min et « Place libérée » sans consentement : messages indispensables, ils partent toujours ; voir scénarios 8 bis, 9 et 11. Question d'origine : sans la case « Me prévenir », le rappel à 5 min et « Place libérée » ne partent pas (seuls `ticket_created` et `your_turn` sont indispensables). Un client sans consentement n'est donc pas prévenu que sa place va être libérée. Est-ce voulu par Ely ?
- **Résolu le 19/10** (E17) — `appointment_confirmed` et `appointment_rejected` sont indispensables ; voir scénario 1 quater. Question d'origine : de même, `appointment_confirmed` et `appointment_rejected` ne sont pas indispensables : un client qui s'est signalé sans cocher « Me prévenir » ne reçoit ni la confirmation ni le refus (il est pourtant sur place). Est-ce voulu ?
- **Résolu le 19/10** (E21) — Le client avec rendez-vous donne le code de son ticket à l'appel, comme les autres ; le code figure donc sur sa carte ; voir scénario 1 ter. Question d'origine : la carte d'un rendez-vous affiche-t-elle aussi le code du ticket en grand ? Le client avec rendez-vous valide-t-il son arrivée par ce code (F-M13 affiche un statut « arrivé ») ?
- **Résolu en partie le 19/10** (E19) — Le client peut annuler un rendez-vous à confirmer ; voir scénario 1 quater. Reste ouvert (APP_FLOW F-C5) : la carte d'un rendez-vous à confirmer affiche-t-elle déjà le code du ticket ?
- **Résolu le 19/10** (BACKEND_SCHEMA v0.5 §10) — « Préparez-vous » part une seule fois (`get_ready_sent_at`) ; voir scénario 6 bis.
- **APP_FLOW F-C7** : que devient le compteur de 10 min sur l'écran du client une fois l'arrivée validée ?
- **Résolu le 19/10** (dictionnaire `client.json`, `notifications.json`) — Textes de la carte, de l'écran d'appel, des écrans de fin et des notifications rédigés.
