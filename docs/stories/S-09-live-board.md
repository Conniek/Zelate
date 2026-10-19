# S-09 · Vue temps réel de la file et de l'équipe

**En tant que** gérant, **je veux** voir en temps réel la file de mon salon et chaque coiffeur (statut, client en cours, fin estimée, prochains clients), sans aucun numéro de téléphone, **afin de** piloter la journée d'un coup d'œil et d'agir au bon moment.

- Priorité : I (PRD §5.3)
- Règles appliquées : H6 (le numéro du client n'est jamais affiché au salon) ; H1 et PRD §5.2 Distribution (coiffeur demandé ou pressenti) ; H10 et PRD §5.2 règles 6 à 8 (rendez-vous) ; PRD §5.2 transition 1b (rendez-vous « à confirmer » visible mais hors calcul) ; le gérant peut clore une prestation oubliée (PRD §5.1, E15) ; isolation par salon (PRD §5.1) ; propagation en moins de 2 s pour 95 % des événements, repli toutes les 10 s côté dashboard (PRD §6)
- Parcours : F-M6 ; F-M13 (rendez-vous du jour, stories S-18 et S-19) ; événements APP_FLOW §7 (colonne « Dashboard ») ; états communs APP_FLOW §8
- Commandes et données : RPC `get_salon_board` (gérant seulement, K9 ; le personnel ne lit `tickets` que par RPC, K32) · `complete_service` (panneau ticket, E15) · canal `salon:{salon_id}` (`queue_updated`, `queue_status_changed`, `presence_changed`, `appointment_pending`) · données lues `tickets` (dont `kind`, `scheduled_at`, `status` = `pending_confirmation`, `reassignment_requested_at`), `ticket_events` (`reassignment_resolved`, dernier résultat de réaffectation, E27), `stylist_presence`, `salon_members`, `salons` (`waiting_count`, `queue_status`, `is_full`)

## Scénarios

### 1. Affichage de la vue
- **Étant donné** un gérant connecté, salon publié, avec des coiffeurs présents et des tickets actifs
- **Quand** il ouvre `/dashboard`
- **Alors** l'en-tête affiche l'état de la file, le nombre de clients en attente, l'attente moyenne et l'indicateur « synchronisé »
- **Alors** chaque coiffeur a une colonne avec son statut, son client en cours, la fin estimée et ses prochains tickets (prénom, prestation, heure)
- **Alors** la liste globale montre tous les tickets actifs avec leur ordre, leur coiffeur et leur statut d'approche

### 2. Mise à jour en temps réel après une action d'un coiffeur
- **Étant donné** le dashboard ouvert
- **Quand** un coiffeur appelle un client depuis son téléphone
- **Alors** le ticket passe au statut « appelé » sur le dashboard en moins de 2 s (95 % des cas)

### 3. Nouveau ticket client
- **Étant donné** le dashboard ouvert
- **Quand** un client rejoint la file depuis l'app ou par le QR de l'affiche
- **Alors** son ticket est ajouté à la liste globale et à la colonne du coiffeur demandé ou pressenti

### 3 bis. Rendez-vous dans la liste globale
- **Étant donné** un rendez-vous de 14:00 saisi pour Léa
- **Quand** le gérant regarde la liste globale
- **Alors** le rendez-vous apparaît avec son heure, 14:00 (F-M6)
- **Quand** l'heure de passage de ce rendez-vous atteint 14:05
- **Alors** aucun retard n'est affiché (moins de 10 min, E30)
- **Quand** l'heure de passage de ce rendez-vous atteint 14:10
- **Alors** le retard du salon sur l'heure du rendez-vous est affiché (« 10 min de retard ») (PRD §5.2, E30 ; APP_FLOW §7 « Retard sur un rendez-vous »)

### 3 ter. Bandeau « Rendez-vous à confirmer »
- **Étant donné** le dashboard ouvert
- **Quand** un client se signale pour un rendez-vous en scannant l'affiche (`check_in_appointment`)
- **Alors** le bandeau « Rendez-vous à confirmer » affiche ce client en moins de 2 s (95 % des cas)
- **Alors** les heures de passage des autres tickets ne changent pas tant que le rendez-vous n'est pas confirmé (PRD §5.2 transition 1b)
- **Quand** le gérant clique sur le bandeau
- **Alors** la page `/dashboard/appointments` s'ouvre, avec sa section « À confirmer » (F-M13, story S-19)

### 4. Repli sans temps réel
- **Étant donné** un dashboard dont le canal temps réel ne répond plus, mais qui reste connecté
- **Quand** l'état de la file change
- **Alors** le dashboard affiche le changement au plus tard 10 s après

### 5. Perte de connexion
- **Étant donné** un dashboard qui a perdu la connexion
- **Quand** le gérant le regarde
- **Alors** un bandeau signale la perte de connexion
- **Alors** l'indicateur « synchronisé » n'est plus affiché
- **Alors** les actions du dashboard sont désactivées

### 6. Aucun numéro de téléphone (confidentialité)
- **Étant donné** des tickets créés depuis l'app, par le QR et à l'accueil
- **Quand** le gérant consulte l'en-tête, les colonnes, la liste globale et le panneau détail d'un ticket
- **Alors** aucun numéro de téléphone n'est affiché
- **Alors** la réponse de `get_salon_board` ne contient ni numéro de téléphone, ni `tracking_token`, ni `tracking_short_code` (K32)
- **Alors** une lecture directe de la table `tickets` depuis le compte du gérant ne renvoie rien : le personnel ne lit les tickets que par RPC (K32)

### 7. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** il appelle `get_salon_board` avec l'identifiant du salon B, ou s'abonne au canal `salon:{B}`
- **Alors** la lecture et l'abonnement sont refusés

### 7 bis. Vue du salon réservée au gérant
- **Étant donné** un coiffeur actif du salon A, connecté sur son téléphone
- **Quand** il appelle `get_salon_board` pour le salon A
- **Alors** la lecture est refusée (TRD §6.3, BACKEND_SCHEMA §8.1 : `managed_salon_id()`, K9)

### 8. Ticket en attente de réponse du client
- **Étant donné** un client dont le coiffeur demandé vient d'être déclaré absent, en retard ou partant plus tôt
- **Quand** le gérant regarde ce ticket
- **Alors** le ticket est marqué « en attente de réponse »

### 8 bis. Réaffectation en attente de l'accord du client
- **Étant donné** un ticket pour lequel le gérant a demandé une réaffectation qui recule l'heure du client (S-13)
- **Quand** le gérant regarde ce ticket
- **Alors** le ticket est marqué « en attente de réponse » (F-M10, E9)
- **Quand** 10 min passent sans réponse du client
- **Alors** la demande est effacée (`queue-tick`, BACKEND_SCHEMA `reassignment_requested_at`) et le ticket garde son coiffeur et son heure
- **Alors** le gérant voit le résultat « sans réponse » sur ce ticket (PRD §5.1, E27 ; `get_salon_board`, `reassignment_resolved` = `expired`)
- **Quand** un autre client refuse la demande
- **Alors** le gérant voit le résultat « refusé » sur son ticket (E27 ; `refused`)

### 9. Client à risque de fin de journée
- **Étant donné** une file à moins de 2 h de la fermeture
- **Quand** un client reçoit l'alerte de fin de journée
- **Alors** le dashboard le fait apparaître dans la liste des clients à risque, avec sa réponse (détail dans S-15)

### 10. Client appelé qui n'est pas venu
- **Étant donné** un client appelé qui n'est pas arrivé dans les 10 min
- **Quand** sa place est libérée automatiquement
- **Alors** son ticket est marqué « absent » et quitte la liste des tickets actifs du dashboard (APP_FLOW §7)

### 10 bis. Aucun compteur d'absences d'un client (confidentialité)
- **Étant donné** un client qui compte 5 absences en 30 jours, dans ce salon et dans d'autres
- **Quand** le gérant consulte son ticket, la liste globale ou le panneau détail
- **Alors** aucun compteur ni avertissement d'absences de ce client n'est affiché (PRD §5.1, E28)
- **Alors** la réponse de `get_salon_board` ne contient aucun compteur d'absences du client (BACKEND_SCHEMA §8.1)

### 11. Accès aux actions depuis la vue
- **Étant donné** le dashboard ouvert
- **Quand** le gérant clique sur un coiffeur
- **Alors** le menu de déclaration d'absence, de retard, de départ anticipé ou de pause s'ouvre (S-11)
- **Quand** il clique sur un ticket
- **Alors** le panneau détail s'ouvre avec « Retirer de la file » (S-12) et « Changer de coiffeur » (S-13)
- **Quand** il clique sur un ticket en prestation
- **Alors** le panneau détail propose aussi « Terminer la prestation » (F-M6, E15 ; détail dans C-08)
- **Quand** il appuie sur la touche `N`
- **Alors** la boîte « Client à l'accueil » s'ouvre (S-10)
- **Quand** il clique sur « Rendez-vous »
- **Alors** la page `/dashboard/appointments` s'ouvre (F-M13)

### 11 bis. Clore une prestation oubliée
- **Étant donné** un client en prestation chez Léa, qui a oublié de cliquer sur « Terminer »
- **Quand** le gérant clique sur « Terminer la prestation » dans le panneau du ticket et confirme
- **Alors** la commande `complete_service` est envoyée au nom du gérant
- **Alors** le ticket passe au statut `completed` et Léa redevient disponible
- **Alors** l'action est inscrite au journal du ticket avec l'acteur `manager` (BACKEND_SCHEMA `ticket_event_type`, E15)

### 12. File vide
- **Étant donné** une file ouverte sans ticket actif
- **Quand** le gérant ouvre `/dashboard`
- **Alors** l'état vide s'affiche avec une phrase et l'action suivante (APP_FLOW §8)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.board.header.waiting_count` | « {count, plural, =0 {Aucun client en attente} one {# client en attente} other {# clients en attente}} » | Pluriel ICU |
| `pro-manager.board.header.average_wait` | « Attente moyenne ~{minutes} min » | Durée en minutes |
| `pro-manager.board.header.synced` | « Synchronisé » | Libellé indicatif (APP_FLOW F-M6) |
| `pro-manager.board.ticket.awaiting_client_answer` | « En attente de réponse » | APP_FLOW §7 ; partagée avec S-13 |
| Résultat de réaffectation « refusé » / « sans réponse » | _À rédiger_ (aucune clé dans le dictionnaire) | Libellés du PRD §5.1 (E27) ; partagée avec S-13 |
| `pro-manager.board.pending_appointments.banner` | « {count, plural, one {# rendez-vous à confirmer} other {# rendez-vous à confirmer}} » | Pluriel ICU |
| `pro-manager.board.appointments` | « Rendez-vous » | Libellé indicatif (APP_FLOW F-M6) |
| `pro-manager.board.ticket.appointment_time` | « RDV {time} » | Heure du rendez-vous, format fr-FR |
| `pro-manager.board.ticket.appointment_delay` | « {minutes} min de retard » | Retard en minutes |
| `pro-manager.ticket_panel.complete` | « Terminer la prestation » | Libellé indicatif (APP_FLOW F-M6) ; partagée avec C-08 |
| `pro-manager.board.empty` | « Aucun client dans la file pour l'instant. Les inscriptions apparaîtront ici en direct. » | État vide (APP_FLOW §8) |
| `pro-manager.board.offline_banner` | « Connexion perdue : les actions sont bloquées jusqu'au retour du réseau. » | Partagée avec S-08 |
| `common.presence_status.<status>` | Voir `common.presence_status.*` dans le dictionnaire (7 textes) | Un libellé par valeur de `presence_status` (`offline`, `available`, `in_service`, `on_break`, `late`, `absent`, `off_duty`) |
| `common.ticket_status.<status>` | Voir `common.ticket_status.*` dans le dictionnaire (7 textes) | Un libellé par valeur de `ticket_status` |
| `common.approach_status.<status>` | Voir `common.approach_status.*` dans le dictionnaire (4 textes) | Confirmé, en retard de X min, sans réponse, arrivé (APP_FLOW F-S4) |

## Questions ouvertes
- **Résolu le 18/10** : APP_FLOW F-S4 reprend la liste de BACKEND_SCHEMA (confirmé à T-30, en retard de X min, sans réponse, arrivé). Question d'origine : les valeurs du statut d'approche ne sont pas les mêmes dans les deux documents. APP_FLOW F-S4 dit « pas parti, en route, arrivé, en retard de X min ». BACKEND_SCHEMA §4.13 dit « arrivé, en retard de X min, confirmé, sans réponse ». Sans GPS (H7), « pas parti » et « en route » ne peuvent pas être calculés. Quelle liste garder ?
- **APP_FLOW** : comment l'« attente moyenne » de l'en-tête est-elle calculée ? Est-ce la moyenne des attentes estimées des tickets en attente, `current_wait_minutes`, ou autre chose ?
- **APP_FLOW / TRD** : F-M6 parle des « tickets assignés » de chaque coiffeur. Mais d'après ADR-015, un ticket sans préférence n'est attribué qu'au moment de l'appel. La colonne montre-t-elle les tickets pressentis (`estimated_member_id`) ?
- **Résolu le 19/10** (E28, PRD §5.1 ; APP_FLOW v0.6 §7) : le dashboard ne montre aucun compteur d'absences d'un client ; à la libération, le ticket est seulement marqué « absent ».
- **Résolu le 19/10** (E27, TRD §6.3) : `get_salon_board` renvoie le dernier résultat de réaffectation de chaque ticket ; le gérant voit « refusé » ou « sans réponse ». Le texte de ces deux libellés manque dans le dictionnaire.
- **Résolu le 19/10** (E30, PRD §5.2) : « en retard de X min » sur un rendez-vous est le retard du salon sur l'heure du rendez-vous, affiché dès 10 min.
- **Résolu le 18/10** (K9, TRD §6.3) : `get_salon_board` est réservé au gérant (`managed_salon_id()`) ; un coiffeur ne lit pas la vue du salon.
- **Résolu le 19/10** (BACKEND_SCHEMA v0.5 §9) : `appointment_pending` est listé sur le canal `salon:{salon_id}` dans les deux documents.
- **APP_FLOW** : un rendez-vous « à confirmer » apparaît-il aussi dans la liste globale et dans la colonne du coiffeur choisi, ou seulement dans le bandeau ? Compte-t-il dans le nombre de clients en attente de l'en-tête ?
- **PRD** : le compteur de 10 min d'un client appelé (H4 : visible par le client et le coiffeur) doit-il aussi s'afficher sur le dashboard ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
