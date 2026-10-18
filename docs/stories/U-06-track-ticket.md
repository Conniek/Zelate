# U-06 · Suivre ma position et mon heure de passage

**En tant que** client inscrit dans une file, **je veux** suivre en temps réel ma position et mon heure de passage, avec mon code de ticket bien visible, **afin d'**arriver au salon juste à temps.

- Priorité : I (PRD §5.3)
- Règles appliquées : H2 (heure simulée), H3 (T-10 et « votre tour » ; 3 SMS maximum par ticket), H4 (compteur de 10 min, rappel à 5 min sans SMS, place libérée à 10 min), H7 (arrivée validée par le code du ticket de 5 caractères) (PRD §5.1) ; transitions 2, 4 et 7, calcul de l'attente affichée (PRD §5.2) ; notifications « Préparez-vous », « Votre tour », « Rappel », « Place libérée » (PRD §5.4) ; mise à jour en moins de 2 s page ouverte, sinon toutes les 30 s (PRD §5.3 U-06, PRD §6) ; « votre tour » envoyé en moins de 5 s (PRD §5.3 C-04)
- Parcours : F-C5, F-C7, F-C10 (APP_FLOW §3) ; garde `/ticket` (APP_FLOW §2.3) ; événements « Préparez-vous », « Votre tour », « Rappel », « Libération » (APP_FLOW §7) ; états « Hors ligne » (APP_FLOW §8)
- Commandes et données : RPC `my_active_ticket()` · Edge Function `ticket-public` (page `/t/:trackingToken`) · canal `ticket:{ticket_id}` (`ticket_updated`) · `queue-tick` (T-10, rappel, libération) · tables `tickets` (`short_code`, `queue_rank`, `estimated_start_at`, `declared_arrival_at`, `status`, `called_at`, `reminder_sent_at`, `get_ready_sent_at`, `arrived_at`, `no_show_at`), `notifications` (`get_ready`, `your_turn`, `arrival_reminder`, `released_no_show`)

## Scénarios

### 1. Carte du ticket
- **Étant donné** que j'ai un ticket « En attente »
- **Quand** j'ouvre `/ticket`
- **Alors** le code du ticket (exemple « #AF2K9 ») est affiché en grand, avec l'indication qu'il faut le donner au coiffeur
- **Et** ma position et mon heure de passage sont affichées
- **Et** le prénom du coiffeur demandé, ou « premier disponible », est affiché
- **Et** l'heure de la dernière mise à jour est affichée (exemple « mis à jour à 14h32 »)

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
- **Étant donné** que mon heure de passage arrive à 10 min ou moins
- **Quand** le moteur détecte ce seuil
- **Alors** je reçois une notification push « Préparez-vous » avec l'heure, l'adresse et l'itinéraire
- **Et** si je n'ai pas de push actif, je la reçois par SMS (SMS 2)

### 7. Appel : « C'est votre tour ! »
- **Étant donné** que mon ticket est en tête pour un coiffeur disponible
- **Quand** le coiffeur m'appelle
- **Alors** mon ticket passe au statut « Appelé »
- **Et** un écran plein « C'est votre tour ! » s'affiche avec le prénom du coiffeur, l'adresse du salon, le code du ticket en grand et un compteur de 10 min
- **Et** je reçois une notification push en priorité haute
- **Et** je reçois aussi un SMS (SMS 3), que j'aie ou non un push actif
- **Et** la notification « votre tour » part en moins de 5 s après l'appel

### 8. Plafond de 3 SMS avec « votre tour » compris
- **Étant donné** que je n'ai pas de push actif et que j'ai reçu le SMS 1 (inscription) et le SMS 2 (préparez-vous)
- **Quand** le coiffeur m'appelle
- **Alors** le SMS 3 « votre tour » est envoyé
- **Et** ce ticket a reçu 3 SMS au total

### 9. Rappel à 5 min, sans SMS
- **Étant donné** que j'ai été appelé il y a 5 min et que mon arrivée n'est pas validée
- **Quand** les 5 min sont atteintes
- **Alors** je reçois la notification push « Le salon vous attend, place libérée dans 5 min »
- **Et** aucun SMS n'est envoyé pour ce rappel

### 10. Arrivée validée par le code
- **Étant donné** que j'ai été appelé et que je donne mon code au coiffeur
- **Quand** le coiffeur saisit ce code
- **Alors** mon arrivée est horodatée
- **Et** mon écran affiche « Installez-vous »

### 11. Place libérée à 10 min
- **Étant donné** que j'ai été appelé il y a 10 min et que mon arrivée n'est pas validée
- **Quand** les 10 min sont atteintes
- **Alors** mon ticket passe au statut « Absent »
- **Et** une absence est ajoutée à mon compteur d'absences
- **Et** je reçois une notification push qui me propose de me réinscrire
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
- **Étant donné** que j'ai reçu un SMS avec le lien `/t/:trackingToken` d'un ticket de moins de 24 h
- **Quand** j'ouvre ce lien sans session
- **Alors** je vois le même affichage que sur `/ticket`
- **Et** les informations sont relues toutes les 30 s
- **Et** je peux répondre à T-30, signaler un retard, choisir « attendre » ou « premier disponible », répondre à l'alerte de fin de journée, annuler et activer le push
- **Et** un lien « Créer mon compte » est proposé

### 16. Lien de suivi expiré
- **Étant donné** un lien `/t/:trackingToken` dont le jeton est inconnu ou dont le ticket date de plus de 24 h
- **Quand** je l'ouvre
- **Alors** le message « Ce lien a expiré » s'affiche
- **Et** aucune information de ticket n'est affichée

### 17. Les SMS du suivi tiennent en un seul SMS
- **Étant donné** les modèles de SMS « Préparez-vous » (SMS 2) et « Votre tour » (SMS 3)
- **Quand** ils sont remplis avec des valeurs de longueur maximale (nom et adresse du salon, prénom du coiffeur, code)
- **Alors** chaque texte fait 160 caractères GSM-7 au plus

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.ticket.code.label` | _À rédiger (absent des docs)_ | Code en grand ; à donner au coiffeur |
| `client.ticket.position` | _À rédiger (absent des docs)_ | Pluriel ICU |
| `client.ticket.estimated_time` | _À rédiger (absent des docs)_ | Variable `time` |
| `client.ticket.stylist.first_available` | « premier disponible » | — |
| `client.ticket.updated_at` | « mis à jour à {time} » (exemple APP_FLOW : « mis à jour à 14h32 ») | Format fr-FR |
| `common.actions.directions` | « Itinéraire » | Partagé avec U-02 |
| `client.ticket.actions.late` | « Je serai en retard » | — |
| `client.ticket.actions.cancel` | « Annuler ma place » | Partagé avec U-08 |
| `client.ticket.called.title` | « C'est votre tour ! » | — |
| `client.ticket.called.countdown` | _À rédiger (absent des docs)_ | Compteur de 10 min |
| `client.ticket.arrived.title` | « Installez-vous » | — |
| `client.ticket.end.rejoin` | « Rejoindre une autre file » | — |
| `client.ticket.end.reason.completed` | _À rédiger (absent des docs)_ | — |
| `client.ticket.end.reason.no_show` | _À rédiger (absent des docs)_ | — |
| `client.ticket.offline` | « Connexion perdue, dernière mise à jour à {time} » | — |
| `client.tracking.expired` | « Ce lien a expiré » | — |
| `client.tracking.create_account` | « Créer mon compte » | — |
| `notifications.get_ready.push` | _À rédiger (absent des docs)_ | Heure, adresse, itinéraire |
| `notifications.get_ready.sms` | _À rédiger (absent des docs)_ | SMS : 160 caractères GSM-7 au plus, avec heure, adresse, itinéraire |
| `notifications.your_turn.push` | _À rédiger (absent des docs)_ | Priorité haute ; prénom du coiffeur, adresse, code |
| `notifications.your_turn.sms` | _À rédiger (absent des docs)_ | SMS : 160 caractères GSM-7 au plus, avec prénom du coiffeur, adresse, code |
| `notifications.arrival_reminder.push` | « Le salon vous attend, place libérée dans 5 min » | Push seulement |
| `notifications.released_no_show.push` | _À rédiger (absent des docs)_ | Push seulement ; proposition de se réinscrire |

## Questions ouvertes
- **PRD U-06 / APP_FLOW F-C5** : que mesure la « position » ? Le rang parmi tous les tickets en attente du salon, ou le rang parmi les tickets éligibles pour mon coiffeur (demandé ou pressenti) ?
- **PRD U-06 / APP_FLOW F-C10 / TRD §6.4** : le PRD exige une mise à jour en moins de 2 s page ouverte. Or la page `/t/:trackingToken` n'a pas de session, ne peut pas s'abonner au canal `ticket:{ticket_id}` et se rafraîchit toutes les 30 s. Accepte-t-on cette exception pour les clients inscrits à l'accueil ?
- **PRD §5.4 / BACKEND_SCHEMA §4.16** : « Votre tour » part « toujours » par SMS (SMS 3), mais les SMS « Choix de coiffeur » et « Risque de fin de journée » comptent aussi dans le plafond de 3. Si un client sans push en a déjà reçu 3, le SMS « votre tour » part-il quand même (au-delà du plafond) ou est-il marqué `skipped` (`sms_cap_reached`), comme le prévoit le schéma ?
- **BACKEND_SCHEMA §4.3 / TRD §9** : `salons.address_line` n'a pas de longueur maximale et `salons.name` peut faire 80 caractères. Les SMS 2 et 3 (nom, adresse, prénom du coiffeur, code) ne peuvent donc pas tenir à coup sûr en 160 caractères. Il faut aussi décider comment traiter les caractères hors GSM-7 (ê, ô, ç…) dans les noms et les prénoms : translittération, troncature ?
- **PRD §5.4** : « Préparez-vous » part-il une seule fois, comme « Votre tour approche » ? Que se passe-t-il si l'heure de passage remonte au-dessus de 10 min puis redescend ?
- **APP_FLOW F-C7** : que devient le compteur de 10 min sur l'écran du client une fois l'arrivée validée ?
- **Textes** : la plupart des textes de la carte du ticket, de l'écran d'appel, des écrans de fin et des notifications « Préparez-vous », « Votre tour » et « Place libérée » ne figurent dans aucun document.
