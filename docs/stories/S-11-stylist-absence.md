# S-11 · Déclarer un coiffeur absent, en retard ou partant plus tôt

**En tant que** gérant, **je veux** déclarer qu'un coiffeur est absent, en retard ou part plus tôt, après avoir vu l'impact sur les clients, **afin que** l'attente annoncée reste juste et que les clients qui le demandaient puissent choisir.

- Priorité : I (PRD §5.3)
- Règles appliquées : PRD §5.2 Statuts du coiffeur (En retard, Absent, Fin de journée, En pause) ; PRD §5.2 transition 8 et PRD §11 n° 15 (sans réponse en 10 min : premier disponible si le coiffeur est absent toute la journée, sinon il attend) ; coiffeur indisponible : client en prestation terminé par le gérant, client appelé repris en tête par le premier coiffeur libre ; coiffeur absent toute la journée : pas de choix « attendre » (PRD §5.1, §11 E6 et E7) ; H1 ; H10 (rendez-vous attribués à un coiffeur) ; variation d'heure de 10 min ou plus par rapport à la dernière heure annoncée, écarts cumulés, expliquée (PRD §5.1, E11) ; H3 et PRD §5.4 (plafond de 3 SMS ; sans « Me prévenir », seuls l'inscription et « votre tour » partent, K11) ; H6
- Parcours : F-M8 ; F-M6 (clic sur un coiffeur, panneau « Terminer la prestation ») ; côté client F-C5 bandeau « Votre coiffeur n'est plus disponible » (story U-12)
- Commandes et données : RPC `preview_presence_change` (`member_id`, `status`, `until?`, K2) · `set_presence` (`member_id`, `status`, `break_type?`, `until?`, `shift_end_at?`) · `complete_service` (gérant, E15) · `resolve_stylist_change` (réponse du client) · tables `stylist_presence` (`status`, `expected_back_at`, `shift_end_at`, `break_type`, `updated_by_member_id`), `tickets` (`stylist_change_pending_since`, `estimated_start_at`, `last_notified_start_at`, `kind` = `appointment`), `salon_events` (`presence_changed`, `subject_member_id`), `ticket_events` (`stylist_change_requested`, `stylist_change_resolved`), `notifications` (`stylist_change_required`, `estimate_changed`, `cancelled_by_salon`)

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
- **Alors** chaque client qui demandait ce coiffeur reçoit une notification lui demandant de choisir
- **Alors** sa page de suivi ne lui propose que « Premier disponible » ou « Annuler ma place », sans « Attendre » (PRD §5.1, E7 ; APP_FLOW F-C5)
- **Alors** ces tickets sont marqués « en attente de réponse » sur le dashboard
- **Alors** l'événement `presence_changed` est inscrit au journal du salon, avec le coiffeur concerné

### 3 bis. Client appelé par le coiffeur déclaré indisponible
- **Étant donné** Léa, qui a appelé Sam (compteur de 10 min en cours)
- **Quand** le gérant confirme l'absence de Léa
- **Alors** le ticket de Sam passe en tête de file (PRD §5.1, E6)
- **Alors** Sam est pris par le premier coiffeur libre (PRD §5.1)

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
- **Alors** les deux rendez-vous sont présentés au gérant comme « à réaffecter » (F-M8 ; F-S3 : « les rendez-vous restants sont à réaffecter par le gérant »)
- La commande de réaffectation d'un rendez-vous et ce que le client en voit sont des questions ouvertes.

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

### 6. Mettre un coiffeur en pause
- **Étant donné** un coiffeur disponible
- **Quand** le gérant choisit « Pause », indique le type (repas, courte, imprévu) et la durée, puis confirme
- **Alors** le coiffeur passe au statut `on_break`
- **Alors** la durée restante de la pause est ajoutée aux heures de passage chez lui

### 7. Clients prévenus quand leur heure bouge de 10 min ou plus
- **Étant donné** des clients en attente dont l'heure de passage change à cause de la déclaration
- **Quand** l'écart avec la dernière heure qui leur a été annoncée (`last_notified_start_at`) est de 10 min ou plus, écarts précédents compris (E11)
- **Alors** le client reçoit une notification push « changement d'heure » avec la nouvelle heure et la raison
- **Quand** cet écart est de moins de 10 min
- **Alors** aucune notification n'est envoyée

### 8. Notification de choix et plafond SMS
- **Étant donné** un client qui demandait le coiffeur déclaré absent, qui a coché « Me prévenir » et qui n'a pas de push actif
- **Quand** la déclaration est confirmée
- **Alors** la demande de choix lui est envoyée par SMS si le ticket a reçu moins de 3 SMS
- **Alors** aucun SMS ne part si le ticket a déjà reçu 3 SMS (la notification est marquée `skipped`, `sms_cap_reached`)

### 8 bis. Client sans consentement aux notifications de suivi
- **Étant donné** un client qui demandait le coiffeur déclaré absent et qui n'a pas coché « Me prévenir »
- **Quand** la déclaration est confirmée
- **Alors** aucune demande de choix ne lui est envoyée (notification `skipped`, `no_consent` ; BACKEND_SCHEMA §4.16, K11)
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
- **Alors** il reçoit une notification push et un SMS, même au-delà du plafond, avec le motif, des excuses et des salons proches (APP_FLOW §7) ; pour un client sans « Me prévenir », voir les questions ouvertes

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
| `common.break_type.meal` | « repas » | PRD §5.2 |
| `common.break_type.short` | « courte » | PRD §5.2 |
| `common.break_type.unexpected` | « imprévu » | PRD §5.2 |
| `pro-manager.presence.impact.reassigned` | « réassignés automatiquement » | Libellé indicatif (APP_FLOW F-M8) |
| `pro-manager.presence.impact.client_to_confirm` | « à confirmer par le client » | Libellé indicatif (APP_FLOW F-M8) |
| `pro-manager.presence.confirm` | « Confirmer » | Libellé indicatif (APP_FLOW F-M8) |
| `pro-manager.presence.impact.appointments_to_reassign` | « rendez-vous à réaffecter » | Libellé indicatif (APP_FLOW F-M8) |
| `pro-manager.presence.impact.called_back_to_top` | « {first_name} (appel en cours) passe en tête de file pour le premier coiffeur libre. » | Client appelé repris en tête (F-M8, E6) |
| `pro-manager.presence.impact.service_to_complete` | « Prestation en cours pour {first_name} : à terminer par vous depuis le panneau du ticket. » | Client en prestation à terminer par le gérant (F-M8, E6) |
| `notifications.stylist_change_required.push` | Voir `notifications.stylist_change_required.push.*` dans le dictionnaire (2 textes) | Push ; choix « attendre » ou « premier disponible » ; sans « attendre » si le coiffeur est absent toute la journée (E7) |
| `notifications.stylist_change_required.sms` | « {salon_name} : {stylist_first_name} a un empêchement. Attendre ou premier disponible ? Choisissez : {link} » | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (TRD §9, K5) ; lien de suivi pour répondre |
| `common.change_reason.stylist_unavailable` | « Un coiffeur n'est plus disponible aujourd'hui. » | Raison montrée au client |
| `notifications.cancelled_by_salon.sms` | « {salon_name} a annulé votre place : {reason}. Toutes nos excuses. Salons proches : {link} » | Partagée avec S-12 ; **160 caractères GSM-7 maximum**, mêmes valeurs maximales (K5) |

## Questions ouvertes
- **Résolu le 18/10** (K2, TRD §6.3) : l'aperçu est calculé par la lecture `preview_presence_change`, qui exécute le moteur sans rien écrire.
- **Résolu le 18/10** (correction APP_FLOW F-M8) : le choix proposé au client est « attendre » ou « premier disponible » partout.
- **Résolu le 18/10** (E6, PRD §5.1) : le client en prestation est terminé par le gérant ; le client appelé passe en tête et est pris par le premier coiffeur libre.
- **Résolu le 18/10** (E7, PRD §5.1) : quand le coiffeur demandé est absent toute la journée, le client choisit seulement « premier disponible » ou annule ; sans réponse en 10 min, premier disponible.
- **Résolu le 18/10** (correction BACKEND_SCHEMA `stylist_change_pending_since`) : la règle des 10 min sans réponse est notée comme décidée.
- **APP_FLOW / TRD** : F-M8 garde un champ « motif » dans le formulaire, mais `set_presence` n'a aucun paramètre de motif (TRD §6.2), et le journal ne contient aucun texte libre (K10). Le champ « motif » est-il supprimé, ou devient-il une liste de valeurs ? Est-il montré au client ?
- **APP_FLOW** : le formulaire de F-M8 contient « heure prévue, heure de fin, motif », mais pas le type ni la durée d'une pause. Pourtant, le PRD exige les deux. Quels sont les champs du formulaire « Pause » côté gérant, et quelles durées sont proposées (F-S3 propose 5, 10, 15, 30, 45 et 60 min) ?
- **PRD / APP_FLOW** : le statut `absent` vaut-il toujours « absent toute la journée » (E7) ? F-M8 « Confirmer » dit encore que « ceux avec préférence choisissent « attendre » ou « premier disponible » », sans exception pour l'absence ; F-C5 et PRD §5.1 retirent « attendre » dans ce cas. Il faut aligner F-M8.
- **PRD / APP_FLOW** : qu'est-ce qu'une « absence sans alternative » (APP_FLOW §7) ? Par exemple, aucun autre coiffeur présent ne maîtrise la prestation ? Le motif d'annulation est-il `stylist_unavailable` (BACKEND_SCHEMA `cancel_reason`) ?
- **PRD / APP_FLOW / TRD (rendez-vous)** : F-M8 et F-S3 disent que les rendez-vous restants du coiffeur sont « à réaffecter par le gérant ». Par quelle commande : `update_appointment` (`member_id?`) ou `reassign_ticket` ? Que devient le rendez-vous tant que le gérant ne l'a pas réaffecté : reste-t-il chez le coiffeur absent, hors calcul, ou passe-t-il en « premier disponible » ? Le client du rendez-vous est-il prévenu, et a-t-il le choix (transition 8) ?
- **TRD** : `preview_presence_change` prend `member_id`, `status`, `until?`, mais pas `shift_end_at`. L'aperçu d'un départ plus tôt passe-t-il l'heure de fin dans `until` ?
- **PRD (consentement, K11)** : sans « Me prévenir », `cancelled_by_salon` n'est pas un message indispensable et part en `skipped` (BACKEND_SCHEMA §4.16). Un client annulé pour « absence sans alternative » ne serait donc pas prévenu, alors que PRD §5.4 dit que l'annulation par le salon « part toujours ». Laquelle des deux règles l'emporte ?
- **PRD / TRD** : un client appelé « repris en tête » (E6) repasse-t-il au statut `waiting`, et son compteur de 10 min est-il annulé ? Le premier coiffeur libre doit-il aussi maîtriser sa prestation (H1) ?
- **PRD / TRD** : `set_presence` n'a aucun code d'erreur propre (TRD §6.2). Que se passe-t-il pour une heure d'arrivée déjà passée, ou une heure de fin après la fermeture ? Comment annuler une déclaration faite par erreur, ou passer en « disponible » un coiffeur en retard qui vient d'arriver ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
