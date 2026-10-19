# S-11 · Déclarer un coiffeur absent, en retard ou partant plus tôt

**En tant que** gérant, **je veux** déclarer qu'un coiffeur est absent, en retard ou part plus tôt, après avoir vu l'impact sur les clients, **afin que** l'attente annoncée reste juste et que les clients qui le demandaient puissent choisir.

- Priorité : I (PRD §5.3)
- Règles appliquées : PRD §5.2 Statuts du coiffeur (En retard, Absent, Fin de journée, En pause) ; PRD §5.2 transition 8 et PRD §11 n° 15 (sans réponse en 10 min : premier disponible si le coiffeur est absent toute la journée, sinon il attend) ; coiffeur indisponible : client en prestation terminé par le gérant, client appelé repris en tête par le premier coiffeur libre ; coiffeur absent toute la journée : pas de choix « attendre » (PRD §5.1, §11 E6 et E7) ; H1 ; H10 (rendez-vous attribués à un coiffeur) ; variation d'heure de 10 min ou plus par rapport à la dernière heure annoncée, écarts cumulés, expliquée (PRD §5.1, E11) ; H3 et PRD §5.4 (plafond de 3 SMS ; la demande de choix et l'annulation par le salon sont des messages indispensables, envoyés sans « Me prévenir » ; le changement d'heure est un message d'anticipation, E17) ; rendez-vous du coiffeur indisponible : le client choisit comme les autres, le gérant peut réaffecter (PRD §5.1, E18) ; une pause ne déclenche pas le choix (E25) ; H6
- Parcours : F-M8 ; F-M6 (clic sur un coiffeur, panneau « Terminer la prestation ») ; côté client F-C5 bandeau « Votre coiffeur n'est plus disponible » (story U-12)
- Commandes et données : RPC `preview_presence_change` (`member_id`, `status`, `break_type?`, `until?`, `shift_end_at?`, K2, constat 27) · `set_presence` (`member_id`, `status`, `break_type?`, `until?`, `shift_end_at?`) · `complete_service` (gérant, E15) · `resolve_stylist_change` (réponse du client) · `reassign_ticket` (réaffectation d'un rendez-vous, E18, K39) · tables `stylist_presence` (`status`, `expected_back_at`, `shift_end_at`, `break_type`, `updated_by_member_id`), `tickets` (`stylist_change_pending_since`, `estimated_start_at`, `last_notified_start_at`, `kind` = `appointment`), `salon_events` (`presence_changed`, `subject_member_id`), `ticket_events` (`stylist_change_requested`, `stylist_change_resolved`), `notifications` (`stylist_change_required`, `estimate_changed`, `cancelled_by_salon`)

## Scénarios

### 1. Voir l'impact avant de confirmer
- **Étant donné** le gérant sur `/dashboard`, et un coiffeur avec des tickets demandés et des tickets pressentis
- **Quand** il ouvre le menu de ce coiffeur, choisit « Absent » et remplit le formulaire
- **Alors** la lecture `preview_presence_change` est appelée, sans rien écrire (TRD §6.3, K2)
- **Alors** l'aperçu liste les tickets touchés avec leur heure actuelle et leur nouvelle heure
- **Alors** les tickets sans préférence sont signalés « réassignés automatiquement »
- **Alors** les tickets qui demandaient ce coiffeur sont signalés « à confirmer par le client »
- **Alors** les rendez-vous de ce coiffeur sont signalés « rendez-vous à réaffecter » (F-M8)
- **Alors** un client appelé par ce coiffeur est signalé « repris en tête », et un client en prestation « à terminer par le gérant » (F-M8, E6)
- **Alors** aucun client n'est encore prévenu
- **Alors** aucun ticket ni statut ne change

### 2. Renoncer après l'aperçu
- **Étant donné** l'aperçu de l'impact affiché
- **Quand** le gérant ferme le formulaire sans confirmer
- **Alors** le statut du coiffeur ne change pas
- **Alors** aucune notification n'est envoyée

### 3. Confirmer une absence
- **Étant donné** l'aperçu de l'absence d'un coiffeur affiché
- **Quand** le gérant clique sur « Confirmer »
- **Alors** la commande `set_presence` (`absent`) est envoyée
- **Alors** le coiffeur ne reçoit plus de nouveaux clients
- **Alors** les tickets sans préférence sont recalculés avec les autres coiffeurs
- **Alors** chaque client qui demandait ce coiffeur reçoit une notification `stylist_change_required` (variante `no_wait`) lui demandant de choisir, qu'il ait coché « Me prévenir » ou non (E17)
- **Alors** sa page de suivi ne lui propose que « Premier disponible » ou « Annuler ma place », sans « Attendre » (PRD §5.1, E7 ; APP_FLOW F-C5)
- **Alors** ces tickets sont marqués « en attente de réponse » sur le dashboard
- **Alors** l'événement `presence_changed` est inscrit au journal du salon, avec le coiffeur concerné

### 3 bis. Client appelé par le coiffeur déclaré indisponible
- **Étant donné** Léa, qui a appelé Sam (compteur de 10 min en cours)
- **Quand** le gérant confirme l'absence de Léa
- **Alors** le ticket de Sam passe en tête de file (PRD §5.1, E6)
- **Alors** Sam est pris par le premier coiffeur libre (PRD §5.1)
- La transition exacte (retour à « En attente », compteur annulé, marqueur `priority_since`) attend la réponse d'Ely à E36 ; ce scénario sera complété ensuite.

### 3 ter. Client en prestation chez le coiffeur déclaré indisponible
- **Étant donné** Léa, qui coiffe Inès
- **Quand** le gérant confirme l'absence ou le départ de Léa
- **Alors** la prestation d'Inès reste en cours, à terminer par le gérant (PRD §5.1, E6)
- **Quand** le gérant clique sur « Terminer la prestation » dans le panneau du ticket d'Inès et confirme
- **Alors** la commande `complete_service` est envoyée au nom du gérant
- **Alors** l'action est inscrite au journal du ticket avec l'acteur `manager` (E15)

### 3 quater. Rendez-vous restants du coiffeur déclaré indisponible
- **Étant donné** Léa, avec un rendez-vous à 15:00 et un autre à 16:30
- **Quand** le gérant confirme l'absence de Léa
- **Alors** les deux rendez-vous sont présentés au gérant comme « à réaffecter » (F-M8 ; PRD §5.1, E18)
- **Alors** chaque client de ces rendez-vous reçoit la même demande de choix que les autres clients de Léa : « Premier disponible » ou « Annuler ma place », puisque Léa est absente toute la journée (E18, E7)
- **Alors** sans réponse en 10 min, son rendez-vous passe en « premier disponible » (transition 8)
- **Quand** le gérant réaffecte le rendez-vous de 15:00 à Karim (`reassign_ticket`)
- **Alors** la réaffectation suit la règle de S-13 : immédiate si l'heure du client ne recule pas, sinon demande au client (E27) ; `assigned_member_id` passe à Karim une fois la réaffectation faite (K39)

### 4. Déclarer un retard avec une heure d'arrivée prévue
- **Étant donné** un coiffeur hors ligne en début de journée
- **Quand** le gérant choisit « En retard », saisit l'heure d'arrivée prévue et confirme
- **Alors** le coiffeur passe au statut `late` avec cette heure (`expected_back_at`)
- **Alors** les heures de passage chez lui sont calculées à partir de l'heure prévue
- **Alors** il ne reçoit de clients qu'après l'heure prévue
- **Alors** les clients qui le demandaient doivent choisir « attendre » ou « premier disponible » (transition 8)

### 5. Déclarer un départ plus tôt
- **Étant donné** un coiffeur disponible avec des clients estimés jusqu'en fin d'après-midi
- **Quand** le gérant choisit « Part plus tôt », saisit l'heure de fin et confirme
- **Alors** le coiffeur passe au statut `off_duty` avec cette heure de fin (`shift_end_at`)
- **Alors** il ne reçoit plus de clients après cette heure
- **Alors** les tickets sans préférence qui dépasseraient cette heure sont redistribués
- **Alors** les clients qui le demandaient et qui dépasseraient cette heure doivent choisir « attendre » ou « premier disponible »
- **Alors** ses rendez-vous situés après cette heure sont présentés au gérant comme « à réaffecter » (F-M8, F-S3)
- **Alors** les clients de ces rendez-vous reçoivent la même demande de choix que les autres clients qui le demandaient (PRD §5.1, E18)

### 6. Mettre un coiffeur en pause
- **Étant donné** un coiffeur disponible
- **Quand** le gérant choisit « Pause », indique le type (repas, courte, imprévu) et la durée, puis confirme
- **Alors** le coiffeur passe au statut `on_break`
- **Alors** la durée restante de la pause est ajoutée aux heures de passage chez lui
- **Alors** les clients qui le demandaient ne reçoivent aucune demande de choix « attendre » ou « premier disponible » (PRD §5.1, E25)
- **Alors** seuls les clients dont l'heure bouge de 10 min ou plus sont prévenus (scénario 7)

### 7. Clients prévenus quand leur heure bouge de 10 min ou plus
- **Étant donné** des clients en attente dont l'heure de passage change à cause de la déclaration
- **Quand** l'écart avec la dernière heure qui leur a été annoncée (`last_notified_start_at`) est de 10 min ou plus, écarts précédents compris (E11)
- **Alors** le client qui a coché « Me prévenir » reçoit une notification push « changement d'heure » avec la nouvelle heure et la raison
- **Alors** sans « Me prévenir », la notification est marquée `skipped` (`no_consent`, message d'anticipation, E17) et la page de suivi affiche la nouvelle heure avec la raison
- **Quand** cet écart est de moins de 10 min
- **Alors** aucune notification n'est envoyée

### 8. Notification de choix et plafond SMS
- **Étant donné** un client qui demandait le coiffeur déclaré absent et qui n'a pas de push actif
- **Quand** la déclaration est confirmée
- **Alors** la demande de choix lui est envoyée par SMS si le ticket a reçu moins de 3 SMS
- **Alors** aucun SMS ne part si le ticket a déjà reçu 3 SMS (la notification est marquée `skipped`, `sms_cap_reached`)

### 8 bis. Client sans consentement aux notifications de suivi
- **Étant donné** un client qui demandait le coiffeur déclaré absent et qui n'a pas coché « Me prévenir »
- **Quand** la déclaration est confirmée
- **Alors** la demande de choix lui est envoyée quand même : c'est un message indispensable (PRD §5.1, E17)
- **Alors** le bandeau de choix s'affiche sur sa page de suivi (F-C5)

### 9. Pas de réponse du client en 10 min, coiffeur absent toute la journée
- **Étant donné** un client qui doit choisir parce que son coiffeur est déclaré absent pour la journée
- **Quand** 10 min passent sans réponse (tolérance des tests ±60 s, TRD §10.1, K7)
- **Alors** son ticket passe en « premier disponible »

### 10. Pas de réponse du client en 10 min, coiffeur en retard ou partant plus tôt
- **Étant donné** un client qui doit choisir parce que son coiffeur est en retard ou part plus tôt
- **Quand** 10 min passent sans réponse (tolérance des tests ±60 s, K7)
- **Alors** son ticket continue d'attendre ce coiffeur

### 11. Absence sans alternative
- **Étant donné** un client qui ne peut être servi par aucun autre coiffeur après l'absence déclarée
- **Quand** la déclaration est confirmée
- **Alors** son ticket est annulé par le salon
- **Alors** il reçoit une notification push et un SMS, même au-delà du plafond et même sans « Me prévenir », avec le motif, des excuses et des salons proches (APP_FLOW §7 ; PRD §5.4, E17)

### 12. Aucun numéro de téléphone (confidentialité)
- **Étant donné** l'aperçu de l'impact affiché
- **Quand** le gérant consulte la liste des tickets touchés
- **Alors** seuls les prénoms et les prestations sont affichés, sans numéro de téléphone
- **Alors** la réponse de `preview_presence_change` ne contient ni numéro de téléphone ni `tracking_token`
- **Alors** les messages aux clients partent de la plateforme, jamais du gérant

### 12 bis. Aperçu réservé au gérant
- **Étant donné** un coiffeur connecté du salon
- **Quand** il appelle `preview_presence_change` pour un autre membre
- **Alors** la lecture est refusée (BACKEND_SCHEMA §8.1 : `managed_salon_id()`)

### 13. Dashboard hors ligne
- **Étant donné** un dashboard qui a perdu la connexion
- **Quand** le gérant ouvre le menu d'un coiffeur
- **Alors** le bouton « Confirmer » est désactivé

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.presence.menu.absent` | « Absent » | Libellé indicatif (APP_FLOW F-M8) |
| `pro-manager.presence.menu.late` | « En retard » | Libellé indicatif (APP_FLOW F-M8) |
| `pro-manager.presence.menu.leaving_early` | « Part plus tôt » | Libellé indicatif (APP_FLOW F-M8) |
| `pro-manager.presence.menu.break` | « Pause » | Libellé indicatif (APP_FLOW F-M8) |
| `common.break_type.meal` | « Repas » | PRD §5.2 |
| `common.break_type.short` | « Courte » | PRD §5.2 |
| `common.break_type.unexpected` | « Imprévu » | PRD §5.2 |
| `pro-manager.presence.impact.reassigned` | « {count, plural, one {# client réassigné automatiquement} other {# clients réassignés automatiquement}} » | Pluriel ICU (APP_FLOW F-M8) |
| `pro-manager.presence.impact.client_to_confirm` | « {count, plural, one {# client demandait ce coiffeur : à confirmer par le client} other {# clients demandaient ce coiffeur : à confirmer par chaque client}} » | Pluriel ICU (APP_FLOW F-M8) |
| `pro-manager.presence.impact.nobody_notified_yet` | « Aucun client n'est prévenu avant votre confirmation. » | Scénario 1 |
| `pro-manager.presence.form.break_type` / `.break_duration` | « Type de pause » / « Durée de la pause » | Formulaire « Pause » côté gérant |
| `pro-manager.presence.confirm` | « Confirmer » | Libellé indicatif (APP_FLOW F-M8) |
| `pro-manager.presence.impact.appointments_to_reassign` | « {count, plural, one {# rendez-vous à réaffecter} other {# rendez-vous à réaffecter}} » | Pluriel ICU (APP_FLOW F-M8, E18) |
| `pro-manager.presence.impact.called_back_to_top` | « {first_name} (appel en cours) passe en tête de file pour le premier coiffeur libre. » | Client appelé repris en tête (F-M8, E6) |
| `pro-manager.presence.impact.service_to_complete` | « Prestation en cours pour {first_name} : à terminer par vous depuis le panneau du ticket. » | Client en prestation à terminer par le gérant (F-M8, E6) |
| `notifications.stylist_change_required.push` | Voir `notifications.stylist_change_required.push.*` dans le dictionnaire (2 textes) | Push ; choix « attendre » ou « premier disponible » ; sans « attendre » si le coiffeur est absent toute la journée (E7) |
| `notifications.stylist_change_required.sms` | « {salon_name} : {stylist_first_name} a un empêchement. Attendre ou premier disponible ? Choisissez : {link} » | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (TRD §9, K5) ; lien de suivi pour répondre |
| `notifications.stylist_change_required.no_wait.push` / `.sms` | Voir `notifications.stylist_change_required.no_wait.*` dans le dictionnaire (3 textes) | Coiffeur absent toute la journée : « premier disponible » ou annuler (E7) ; SMS ≤ 160 caractères GSM-7, mêmes valeurs maximales (K5), dans le plafond |
| `notifications.cancelled_by_salon.reason.stylist_unavailable` | « aucun coiffeur disponible » | Motif lu par le client (scénario 11) |
| `common.change_reason.stylist_break` | « Le coiffeur prévu fait une pause. » | Raison montrée au client (scénario 6) |
| `common.change_reason.stylist_late` | « Le coiffeur prévu arrive plus tard. » | Raison montrée au client (scénario 4) |
| `common.change_reason.stylist_unavailable` | « Un coiffeur n'est plus disponible aujourd'hui. » | Raison montrée au client |
| `notifications.cancelled_by_salon.sms` | « {salon_name} a annulé votre place : {reason}. Toutes nos excuses. Salons proches : {link} » | Partagée avec S-12 ; **160 caractères GSM-7 maximum**, mêmes valeurs maximales (K5) |

## Questions ouvertes
- **Résolu le 18/10** (K2, TRD §6.3) : l'aperçu est calculé par la lecture `preview_presence_change`, qui exécute le moteur sans rien écrire.
- **Résolu le 18/10** (correction APP_FLOW F-M8) : le choix proposé au client est « attendre » ou « premier disponible » partout.
- **Résolu le 18/10** (E6, PRD §5.1) : le client en prestation est terminé par le gérant ; le client appelé passe en tête et est pris par le premier coiffeur libre.
- **Résolu le 18/10** (E7, PRD §5.1) : quand le coiffeur demandé est absent toute la journée, le client choisit seulement « premier disponible » ou annule ; sans réponse en 10 min, premier disponible.
- **Résolu le 18/10** (correction BACKEND_SCHEMA `stylist_change_pending_since`) : la règle des 10 min sans réponse est notée comme décidée.
- **Résolu le 19/10** (K10, APP_FLOW v0.6 F-M8) : le formulaire n'a pas de motif en texte libre (« pas de motif en texte libre, K10 ») ; rien n'est montré au client.
- **Résolu en partie le 19/10** (constat 27, TRD v0.5 §6.3 ; dictionnaire `pro-manager.presence.form.break_type`, `.break_duration`) : l'aperçu reçoit `break_type?` et le formulaire « Pause » du gérant a un type et une durée. **Reste ouvert (APP_FLOW)** : F-M8 ne liste toujours que « heure prévue, heure de fin » ; quelles durées sont proposées au gérant (F-S3 propose 5, 10, 15, 30, 45 et 60 min) ?
- **PRD / APP_FLOW** : le statut `absent` vaut-il toujours « absent toute la journée » (E7) ? F-M8 « Confirmer » dit encore que « ceux avec préférence choisissent « attendre » ou « premier disponible » », sans exception pour l'absence ; F-C5 et PRD §5.1 retirent « attendre » dans ce cas. Il faut aligner F-M8.
- **PRD / APP_FLOW** : qu'est-ce qu'une « absence sans alternative » (APP_FLOW §7) ? Par exemple, aucun autre coiffeur présent ne maîtrise la prestation ? Le motif d'annulation est-il `stylist_unavailable` (BACKEND_SCHEMA `cancel_reason`) ?
- **Résolu le 19/10** (E18, E27, K39 ; PRD §5.1, TRD §6.2) : le client d'un rendez-vous touché choisit comme les autres (transition 8) ; le gérant voit les rendez-vous touchés et peut les réaffecter par `reassign_ticket`, avec la règle de non-recul, qui modifie `assigned_member_id`.
- **Résolu le 19/10** (constat 27, TRD v0.5 §6.3) : `preview_presence_change` a maintenant `shift_end_at?` et `break_type?`.
- **Résolu le 19/10** (E17, PRD §5.1 et §5.4) : `cancelled_by_salon` est un message indispensable ; il part sans « Me prévenir », par push et SMS hors plafond.
- **Résolu le 19/10** (E25, PRD §5.1) : une pause du coiffeur ne déclenche pas le choix « attendre / premier disponible ».
- **En attente de E36 (Ely)** : un client appelé « repris en tête » (E6) repasse-t-il au statut `waiting` (transition à ajouter au PRD), son compteur de 10 min est-il annulé, et comment garde-t-il la tête (`priority_since`, K31) ? Le premier coiffeur libre doit-il aussi maîtriser sa prestation (H1) ?
- **PRD / TRD** : `set_presence` n'a aucun code d'erreur propre (TRD §6.2). Que se passe-t-il pour une heure d'arrivée déjà passée, ou une heure de fin après la fermeture ? Comment annuler une déclaration faite par erreur ? Le passage en « disponible » d'un coiffeur en retard qui arrive, ou la fin d'une pause, est-il automatique (**en attente de E32**) ?
- **APP_FLOW / dictionnaire (nouveau)** : F-S3 et `pro-stylist.presence.end_of_day_appointments` disent « Le gérant le réaffectera », alors que E18 fait d'abord choisir le client, le gérant ne réaffectant que s'il le souhaite. Faut-il aligner ces textes ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
