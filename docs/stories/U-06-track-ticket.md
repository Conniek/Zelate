# U-06 · Suivre ma position et mon heure de passage

**En tant que** client inscrit dans une file, **je veux** suivre en temps réel ma position et mon heure de passage, avec mon code de ticket bien visible, **afin d'**arriver au salon juste à temps.

- Priorité : I (PRD §5.3)
- Règles appliquées : H2 (heure simulée), H3 (T-10 et « votre tour » ; 3 SMS maximum par ticket), H4 (compteur de 10 min, rappel à 5 min sans SMS, place libérée à 10 min), H7 (arrivée validée par le code du ticket de 5 caractères), H10 (rendez-vous du salon) (PRD §5.1) ; position = nombre de clients avant lui chez son coiffeur, demandé ou pressenti (E13) ; le SMS « votre tour » part toujours, même plafond atteint (E1) ; sans la case « Me prévenir », seuls l'inscription et « votre tour » partent (K11) (PRD §5.1 « Autres règles ») ; transitions 1b, 2, 4 et 7, calcul de l'attente affichée (PRD §5.2) ; notifications « Préparez-vous », « Votre tour », « Rappel », « Place libérée », « Rendez-vous refusé » (PRD §5.4) ; mise à jour en moins de 2 s page ouverte, sinon toutes les 30 s (PRD §5.3 U-06, PRD §6) ; « votre tour » envoyé en moins de 5 s (PRD §5.3 C-04) ; SMS en 160 caractères GSM-7 : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (K5, TRD §9)
- Parcours : F-C5, F-C7, F-C10 (APP_FLOW §3) ; carte d'un rendez-vous et rendez-vous à confirmer (F-C5, F-C12 ; U-14, U-15) ; garde `/ticket` (APP_FLOW §2.3) ; événements « Préparez-vous », « Votre tour », « Rappel », « Libération », « Rendez-vous confirmé ou refusé » (APP_FLOW §7) ; états « Hors ligne » (APP_FLOW §8)
- Commandes et données : RPC `my_active_ticket()` · Edge Function `ticket-public` (page `/t/:shortCode`, lien court de 8 caractères) · canaux `ticket:{ticket_id}` et `ticket-token:{token_key}` (`ticket_updated`, TRD ADR-018, §6.4) · `queue-tick` (T-10, rappel, libération) · tables `tickets` (`short_code`, `tracking_short_code`, `kind`, `scheduled_at`, `queue_rank`, `requested_member_id`, `estimated_member_id`, `estimated_start_at`, `declared_arrival_at`, `status` dont `pending_confirmation`, `called_at`, `release_due_at`, `reminder_sent_at`, `get_ready_sent_at`, `arrived_at`, `no_show_at`), `private.no_show_records`, `notifications` (`get_ready`, `your_turn`, `arrival_reminder`, `released_no_show`, `appointment_confirmed`, `appointment_rejected`)

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

### 1 quater. Rendez-vous « à confirmer » (renvoi vers U-14)
- **Étant donné** que je me suis signalé pour un rendez-vous par le QR de l'affiche et que le salon ne l'a pas encore confirmé (statut `pending_confirmation`)
- **Quand** j'ouvre ma page de suivi
- **Alors** le message « Le salon confirme votre rendez-vous… » est affiché
- **Et** aucune heure de passage ni aucune position n'est affichée
- **Quand** le gérant ou mon coiffeur confirme le rendez-vous
- **Alors** ma page affiche la carte du scénario 1 ter, avec mon heure de passage
- **Et** si j'ai coché « Me prévenir », je reçois la notification push `appointment_confirmed` avec mon heure de passage
- **Quand** le salon refuse le rendez-vous
- **Alors** l'écran de fin s'affiche avec « Rejoindre la file » (F-C12)
- **Et** si j'ai coché « Me prévenir », je reçois la notification push `appointment_rejected`, sans SMS

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

### 7. Appel : « C'est votre tour ! »
- **Étant donné** que mon ticket est en tête pour un coiffeur disponible
- **Quand** le coiffeur m'appelle
- **Alors** mon ticket passe au statut « Appelé »
- **Et** un écran plein « C'est votre tour ! » s'affiche avec le prénom du coiffeur, l'adresse du salon, le code du ticket en grand et un compteur de 10 min
- **Et** je reçois une notification push en priorité haute
- **Et** je reçois aussi un SMS « votre tour », que j'aie ou non un push actif, et même sans la case « Me prévenir » (K11)
- **Et** la notification « votre tour » part en moins de 5 s après l'appel

### 8. « Votre tour » part même plafond atteint (E1)
- **Étant donné** que je n'ai pas de push actif et que 3 SMS ont déjà été envoyés pour mon ticket (par exemple inscription, choix de coiffeur et préparez-vous)
- **Quand** le coiffeur m'appelle
- **Alors** le SMS « votre tour » est envoyé quand même
- **Et** il n'est pas marqué `skipped` (`sms_cap_reached`)
- **Et** ce ticket a reçu 4 SMS au total

### 8 bis. Sans la case « Me prévenir » (K11)
- **Étant donné** que je n'ai pas coché « Me prévenir » à l'inscription
- **Quand** mon heure de passage arrive à 10 min ou moins, puis que le coiffeur m'appelle, puis que 5 min passent sans arrivée
- **Alors** la notification « Préparez-vous » ne part pas (`skipped`, motif `no_consent`)
- **Et** la notification « votre tour » part par push et par SMS
- **Et** le rappel à 5 min ne part pas (`skipped`, motif `no_consent`)
- **Et** ma page de suivi affiche quand même l'écran « C'est votre tour ! » avec le compteur

### 9. Rappel à 5 min, sans SMS
- **Étant donné** que j'ai coché « Me prévenir », que j'ai été appelé il y a 5 min et que mon arrivée n'est pas validée
- **Quand** les 5 min sont atteintes
- **Alors** je reçois la notification push « Le salon vous attend, place libérée dans 5 min »
- **Et** aucun SMS n'est envoyé pour ce rappel

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
- **Et** si j'ai coché « Me prévenir », je reçois une notification push qui me propose de me réinscrire
- **Et** mon écran affiche l'écran de fin avec la raison et le bouton « Rejoindre une autre file »

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
- **Et** je peux répondre à T-30, signaler un retard, choisir « attendre » ou « premier disponible », accepter ou refuser une réaffectation, répondre à l'alerte de fin de journée, annuler et activer le push
- **Et** un lien « Créer mon compte » est proposé

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
- **Alors** le nom du salon est tronqué à 40 caractères
- **Et** les accents et les caractères hors GSM-7 sont translittérés avant l'envoi
- **Et** chaque texte fait 160 caractères GSM-7 au plus (longueur de l'adresse : voir questions ouvertes)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.ticket.code.label` | Votre code, à donner au coiffeur | Code en grand ; à donner au coiffeur |
| `client.ticket.position` | {count, plural, =0 {Personne avant vous} one {# client avant vous} other {# clients avant vous}} | Pluriel ICU |
| `client.ticket.estimated_time` | Passage prévu vers {time} | Variable `time` |
| `client.ticket.stylist.first_available` | « premier disponible » | — |
| `client.ticket.appointment.times` | Rendez-vous à {appointment_time} · passage prévu vers {start_time} (APP_FLOW F-C5, indicatif : « Rendez-vous à 14h00 · passage prévu vers 14h20 ») | Variables `appointmentTime`, `estimatedTime` ; pas de position |
| `client.ticket.appointment.pending` | Le salon confirme votre rendez-vous… (APP_FLOW F-C5, indicatif : « Le salon confirme votre rendez-vous… ») | Partagé avec U-14 |
| `client.ticket.end.reason.appointment_rejected` | Le salon n'a pas retrouvé votre rendez-vous. Vous pouvez rejoindre la file sans rendez-vous. | Avec « Rejoindre la file » ; partagé avec U-14 |
| `notifications.appointment_confirmed.push` | Voir `notifications.appointment_confirmed.push.*` dans le dictionnaire (2 textes) | Push ; heure de passage ; partagé avec U-14 |
| `notifications.appointment_rejected.push` | Voir `notifications.appointment_rejected.push.*` dans le dictionnaire (2 textes) | Push seulement ; partagé avec U-14 |
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
| `notifications.get_ready.sms` | {salon_name} : préparez-vous, passage vers {time}. Adresse : {address}. Itinéraire : {link} | SMS : 160 caractères GSM-7 au plus, avec heure, adresse, itinéraire ; nom du salon tronqué à 40, accents translittérés (K5) ; dans le plafond de 3 SMS |
| `notifications.your_turn.push` | Voir `notifications.your_turn.push.*` dans le dictionnaire (2 textes) | Priorité haute ; prénom du coiffeur, adresse, code ; message indispensable (K11) |
| `notifications.your_turn.sms` | Zelaté : c'est votre tour ! {stylist_first_name} vous attend, {address}. Code {code}. Venez sous 10 min : {link} | SMS : 160 caractères GSM-7 au plus, avec prénom du coiffeur (≤ 30), adresse, code ; accents translittérés (K5) ; hors plafond (E1) |
| `notifications.arrival_reminder.push` | « Le salon vous attend, place libérée dans 5 min » | Push seulement |
| `notifications.released_no_show.push` | Voir `notifications.released_no_show.push.*` dans le dictionnaire (2 textes) | Push seulement ; proposition de se réinscrire |

## Questions ouvertes
- **Résolu le 18/10** (E13) — Position : nombre de clients avant lui chez son coiffeur, demandé ou pressenti ; voir scénario 1 bis.
- **Résolu le 18/10** (K6) — Temps réel de `/t/:shortCode` : canal public `ticket-token:{token_key}` (TRD ADR-018), repli à 30 s ; voir scénario 15 bis.
- **Résolu le 18/10** (E1) — SMS « votre tour » plafond atteint : il part toujours, hors plafond ; voir scénario 8.
- **Résolu le 18/10** (K5) — Longueurs dans les SMS : prénom ≤ 30, nom du salon tronqué à 40, accents et caractères hors GSM-7 translittérés, lien court de 8 caractères ; voir scénario 17.
- **TRD §9 / BACKEND_SCHEMA §4.3** : K5 ne borne pas l'adresse du salon (`salons.address_line` n'a pas de longueur maximale), alors que les SMS « Préparez-vous » et « Votre tour » la contiennent (PRD §5.4, APP_FLOW §7). Quelle longueur maximale tester, ou faut-il tronquer l'adresse comme le nom ?
- **PRD §5.4 / BACKEND_SCHEMA §4.16** : sans la case « Me prévenir », le rappel à 5 min et « Place libérée » ne partent pas (seuls `ticket_created` et `your_turn` sont indispensables). Un client sans consentement n'est donc pas prévenu que sa place va être libérée. Est-ce voulu par Ely ?
- **PRD §5.4 / BACKEND_SCHEMA §3** : de même, `appointment_confirmed` et `appointment_rejected` ne sont pas indispensables : un client qui s'est signalé sans cocher « Me prévenir » ne reçoit ni la confirmation ni le refus (il est pourtant sur place). Est-ce voulu ?
- **PRD H7 / APP_FLOW F-C5** : la carte d'un rendez-vous affiche-t-elle aussi le code du ticket en grand ? Le client avec rendez-vous valide-t-il son arrivée par ce code (F-M13 affiche un statut « arrivé ») ?
- **PRD §5.2 transition 1b / APP_FLOW F-C5** : la carte d'un rendez-vous à confirmer affiche-t-elle le code du ticket, et le client peut-il annuler pendant l'attente de confirmation ?
- **PRD §5.4** : « Préparez-vous » part-il une seule fois, comme « Votre tour approche » ? Que se passe-t-il si l'heure de passage remonte au-dessus de 10 min puis redescend ?
- **APP_FLOW F-C7** : que devient le compteur de 10 min sur l'écran du client une fois l'arrivée validée ?
- **Textes** : la plupart des textes de la carte du ticket, de l'écran d'appel, des écrans de fin et des notifications « Préparez-vous », « Votre tour » et « Place libérée » ne figurent dans aucun document.
