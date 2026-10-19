# S-16 · Déconnecter à distance le compte d'un coiffeur

**En tant que** gérant, **je veux** déconnecter à distance tous les appareils d'un coiffeur (téléphone perdu ou changé) ou désactiver son compte (départ du salon), **afin qu'**aucune donnée client ne reste accessible sur un téléphone qui n'est plus sous contrôle.

- Priorité : I (PRD §5.3)
- Règles appliquées : aucune donnée client stockée sur le téléphone du coiffeur ; affichage seulement, rien en cache ; déconnexion à distance par le gérant (PRD §5.1, PRD §6 « Appareil du coiffeur ») ; PRD §11 n° 18 ; coiffeur indisponible : client en prestation terminé par le gérant, client appelé repris en tête par le premier coiffeur libre ; coiffeur désactivé : seulement « premier disponible » ou annuler, sans réponse en 10 min premier disponible (PRD §5.1, §5.2 transition 8, §11 E6 et E7) ; révocation effective en 15 min au plus, sans fermeture des canaux temps réel côté serveur (TRD ADR-019, K4, K41) ; rendez-vous du coiffeur désactivé : le client choisit comme les autres, le gérant peut réaffecter (PRD §5.1, E18) ; la demande de choix est un message indispensable (E17) ; isolation par salon (PRD §5.1)
- Parcours : F-M4 `/dashboard/team` ; côté coiffeur F-S2 et gardes de navigation (APP_FLOW §2.3) ; côté client F-C5 (story U-12) ; rendez-vous F-M13
- Commandes et données : `revoke-member-sessions` · `deactivate-member` (TRD §6.1, K3 ; écrit la file par le module `queue-transaction`, K38) · `complete_service` (gérant, E15) · `reassign_ticket` (rendez-vous, E18, K39) · tables `push_subscriptions` (`member_id`, supprimés à la révocation),  `salon_members` (`status` = `deactivated`), `salon_events` (`member_sessions_revoked`, `member_deactivated`, `subject_member_id`), `tickets` (`requested_member_id`, `assigned_member_id`, `stylist_change_pending_since`, `kind` = `appointment`), `notifications` (`stylist_change_required`)

## Scénarios

### 1. Déconnecter les appareils d'un coiffeur
- **Étant donné** le coiffeur Léa, actif, connecté sur son téléphone
- **Quand** le gérant ouvre le menu de Léa sur `/dashboard/team`, choisit « Déconnecter ses appareils » et confirme
- **Alors** la fonction `revoke-member-sessions` est appelée
- **Alors** toutes les sessions de Léa sont coupées
- **Alors** toute commande ou lecture RPC envoyée depuis le téléphone de Léa est refusée dès la révocation (TRD ADR-019 ; `queue.forbidden` pour une commande)
- **Alors** le téléphone de Léa affiche l'écran de connexion avec le message « Vous avez été déconnecté, reconnectez-vous avec votre e-mail », au plus tard 15 min après (APP_FLOW §2.3 et F-S2 ; ADR-019, K4)
- **Alors** le statut de Léa reste « actif »
- **Alors** les abonnements push liés à Léa sont supprimés : son ancien téléphone ne reçoit plus les push `appointment_checked_in`, qui portent un prénom de client (BACKEND_SCHEMA §4.17)
- **Alors** l'événement `member_sessions_revoked` est inscrit au journal du salon, avec Léa comme membre concerné

### 2. Plus aucune donnée client sur le téléphone coupé
- **Étant donné** les sessions de Léa coupées depuis 15 min ou plus
- **Quand** quelqu'un rouvre Zelaté Pro sur son ancien téléphone, ou utilise le bouton retour du navigateur
- **Alors** aucun prénom, aucune prestation et aucun code de ticket ne s'affiche

### 3. Le coiffeur se reconnecte après un changement de téléphone
- **Étant donné** Léa, active, dont les sessions ont été coupées
- **Quand** elle demande un lien magique sur son nouveau téléphone et l'ouvre
- **Alors** elle retrouve sa file

### 4. Désactiver un coiffeur qui quitte le salon
- **Étant donné** le coiffeur Sam, actif
- **Quand** le gérant choisit « Désactiver » dans le menu de Sam et confirme
- **Alors** la fonction `deactivate-member` est appelée (TRD §6.1, K3)
- **Alors** le statut de Sam devient `deactivated`
- **Alors** toutes les sessions de Sam sont coupées, et toute commande ou lecture RPC de Sam est refusée dès la désactivation (ADR-019)
- **Alors** le téléphone de Sam perd l'accès au plus tard 15 min après (F-M4 « Accès retiré en 15 min au plus », K4)
- **Alors** Sam ne reçoit plus de clients
- **Alors** Sam n'apparaît plus parmi les coiffeurs de la fiche salon
- **Alors** l'événement `member_deactivated` est inscrit au journal du salon, avec Sam comme membre concerné

### 5. Un coiffeur désactivé ne peut plus se reconnecter
- **Étant donné** Sam désactivé
- **Quand** il demande un lien magique et l'ouvre
- **Alors** il voit « Votre accès a été retiré, contactez votre gérant » (APP_FLOW §2.3 et F-S2)
- **Alors** il n'a accès à aucune donnée du salon, ni par l'interface, ni par l'API, ni par le canal temps réel

### 6. Clients qui demandaient le coiffeur désactivé
- **Étant donné** des clients en attente qui demandaient Sam, qu'ils aient coché « Me prévenir » ou non
- **Quand** Sam est désactivé
- **Alors** chacun reçoit une notification `stylist_change_required` (variante `no_wait`) lui demandant de choisir : c'est un message indispensable (PRD §5.1, E17) ; sans push actif, par SMS dans la limite du plafond
- **Alors** sa page de suivi ne lui propose que « Premier disponible » ou « Annuler ma place », sans « Attendre » (PRD §5.1, E7 ; APP_FLOW F-C5 et F-M4)
- **Alors** ces tickets sont marqués « en attente de réponse » sur le dashboard

### 6 bis. Pas de réponse en 10 min
- **Étant donné** un client qui demandait Sam et qui doit choisir depuis sa désactivation
- **Quand** 10 min passent sans réponse (tolérance des tests ±60 s, TRD §10.1, K7)
- **Alors** son ticket passe en « premier disponible » (PRD §5.2 transition 8)

### 6 ter. Client appelé par le coiffeur désactivé
- **Étant donné** Sam, qui a appelé Léo (compteur de 10 min en cours)
- **Quand** Sam est désactivé
- **Alors** le ticket de Léo passe en tête de file (PRD §5.1, E6)
- **Alors** Léo est pris par le premier coiffeur libre
- La transition exacte (retour à « En attente », compteur annulé, marqueur `priority_since`) attend la réponse d'Ely à E36.

### 6 quater. Client en prestation chez le coiffeur désactivé
- **Étant donné** Sam, qui coiffe Inès au moment de sa désactivation
- **Quand** le gérant clique sur « Terminer la prestation » dans le panneau du ticket d'Inès et confirme
- **Alors** la commande `complete_service` est envoyée au nom du gérant (E6, E15)
- **Alors** l'action est inscrite au journal du ticket avec l'acteur `manager`

### 6 quinquies. Rendez-vous restants du coiffeur désactivé
- **Étant donné** Sam, avec des rendez-vous plus tard dans la journée
- **Quand** Sam est désactivé
- **Alors** ses rendez-vous restants sont présentés au gérant comme « à réaffecter » (F-M4)
- **Alors** chaque client de ces rendez-vous reçoit la même demande de choix que les autres : « Premier disponible » ou « Annuler ma place » (PRD §5.1, E18, E7)
- **Alors** sans réponse en 10 min, son rendez-vous passe en « premier disponible » (transition 8)
- **Quand** le gérant réaffecte un de ces rendez-vous par « Changer de coiffeur » (`reassign_ticket`)
- **Alors** la règle de S-13 s'applique (non-recul, sinon accord du client, E27) et `assigned_member_id` change une fois la réaffectation faite (K39)

### 7. Renoncer à l'action
- **Étant donné** la confirmation de « Déconnecter ses appareils » ou de « Désactiver » affichée
- **Quand** le gérant la ferme sans confirmer
- **Alors** les sessions et le statut du coiffeur ne changent pas

### 8. Dernier gérant du salon
- **Étant donné** un salon qui n'a qu'un gérant
- **Quand** une désactivation de ce gérant est demandée
- **Alors** la désactivation est refusée avec l'erreur `team.last_manager` (au moins un gérant par salon, BACKEND_SCHEMA §4.4 ; TRD §6.2)

### 8 bis. Coiffeur déjà désactivé ou introuvable
- **Étant donné** Sam déjà désactivé
- **Quand** une nouvelle désactivation de Sam est demandée
- **Alors** elle est refusée avec l'erreur `team.already_deactivated` (TRD v0.5 §6.2)
- **Quand** une déconnexion ou une désactivation vise un membre inconnu
- **Alors** elle est refusée avec l'erreur `team.member_not_found`

### 9. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** il demande la déconnexion ou la désactivation d'un coiffeur du salon B
- **Alors** la demande est refusée

### 10. Seul le gérant coupe l'accès
- **Étant donné** un coiffeur connecté
- **Quand** il appelle `revoke-member-sessions` ou `deactivate-member` pour un autre coiffeur
- **Alors** la demande est refusée avec l'erreur `queue.forbidden` (code commun hors `queue-command`, TRD §6.2)
- **Alors** les sessions et le statut de l'autre coiffeur ne changent pas

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.team.menu.revoke_sessions` | « Déconnecter ses appareils » | Libellé indicatif (APP_FLOW F-M4) |
| `pro-manager.team.menu.deactivate` | « Désactiver » | Libellé indicatif (APP_FLOW F-M4) |
| `pro-manager.team.revoke_sessions.confirm` | « Toutes les sessions de ce compte seront coupées, par exemple sur un téléphone perdu ou changé. {stylist_name} pourra se reconnecter avec un lien reçu par e-mail. » | Rappelle que le coiffeur pourra se reconnecter par lien magique |
| `pro-manager.team.deactivate.confirm` | « L'accès sera retiré en 15 min au plus. {count, plural, =0 {Aucun client en attente ne demande ce coiffeur.} one {# client qui demandait {stylist_name} devra choisir « Premier disponible » ou annuler.} other {# clients qui demandaient {stylist_name} devront choisir « Premier disponible » ou annuler.}} Ses rendez-vous restants seront à réaffecter. » | Rappelle que l'accès est retiré et que les clients qui le demandaient devront choisir |
| `pro-manager.team.status.deactivated` | « Désactivé » | Valeur `deactivated` |
| `pro-stylist.signin.sessions_revoked` | « Votre session a été fermée. Reconnectez-vous avec votre e-mail. » | APP_FLOW §2.3 et F-S2 (libellé indicatif) ; sessions coupées, coiffeur toujours actif |
| `pro-stylist.signin.access_revoked` | « Votre accès a été retiré. Contactez votre gérant. » | APP_FLOW §2.3 et F-S2 ; coiffeur désactivé |
| `notifications.stylist_change_required.push` | Voir `notifications.stylist_change_required.push.*` dans le dictionnaire (2 textes) | Partagée avec S-11 ; sans « attendre » pour un coiffeur désactivé (E7) |
| `errors.queue.forbidden` | « Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. » | Code commun (TRD §6.2) : commande d'un membre révoqué |
| `notifications.stylist_change_required.no_wait.push` / `.sms` | Voir `notifications.stylist_change_required.no_wait.*` dans le dictionnaire (3 textes) | Coiffeur désactivé : « premier disponible » ou annuler (E7) ; SMS ≤ 160 caractères GSM-7 avec les valeurs maximales (K5), dans le plafond |
| `errors.team.already_deactivated` | « Ce coiffeur est déjà désactivé. » | TRD v0.5 §6.2 |
| `errors.team.member_not_found` | « Ce membre de l'équipe est introuvable. » | TRD v0.5 §6.2 |
| `errors.team.last_manager` | « Le salon doit garder au moins un gérant : ce compte ne peut pas être désactivé. » | Au moins un gérant par salon |

## Questions ouvertes
- **Résolu le 18/10** (correction APP_FLOW §2.3 et F-S2) : deux messages distincts, « Vous avez été déconnecté, reconnectez-vous avec votre e-mail » après une déconnexion, « Votre accès a été retiré, contactez votre gérant » après une désactivation.
- **Résolu le 18/10** (K3, TRD §6.1) : la désactivation passe par l'Edge Function `deactivate-member`, qui révoque les sessions, applique la règle « coiffeur indisponible » à ses clients et journalise `member_deactivated`.
- **Résolu le 18/10** (K4, TRD ADR-019 et §7) : jetons d'accès de 15 min, et refus côté serveur de toute commande ou lecture RPC dès la révocation ; l'écran de connexion apparaît au plus tard au rafraîchissement du jeton.
- **Résolu le 18/10** (E6, PRD §5.1) : le client en prestation est terminé par le gérant ; le client appelé passe en tête et est pris par le premier coiffeur libre.
- **Résolu le 18/10** (E7, PRD §5.1 et §5.2 transition 8) : un coiffeur désactivé est traité comme un coiffeur absent toute la journée ; seulement « premier disponible » ou annuler ; sans réponse en 10 min, premier disponible.
- **TRD / APP_FLOW** : TRD §7 dit « un coiffeur désactivé perd l'accès immédiatement », APP_FLOW F-M4 « Accès retiré en 15 min au plus ». Que voit le téléphone pendant ces 15 min au plus : la dernière file affichée (prénoms, prestations), un message d'erreur, une file vide ? Les données déjà affichées restent-elles visibles jusqu'au rafraîchissement du jeton (même question dans C-01) ?
- **Résolu le 19/10** (K41, TRD ADR-019) : le serveur ne ferme pas les canaux temps réel d'un membre révoqué ; un abonnement ouvert peut recevoir des messages jusqu'à l'expiration du jeton, mais ils ne portent que `{ version }`, et toute relecture est refusée.
- **Résolu le 19/10** (E18, E27, K39) : le client d'un rendez-vous du coiffeur désactivé choisit comme les autres (« premier disponible » ou annuler ; sans réponse, premier disponible) ; le gérant peut réaffecter par `reassign_ticket`, avec la règle de non-recul.
- **Résolu le 19/10** (E17) : la demande de choix part sans « Me prévenir ».
- **PRD** : une simple déconnexion (sessions coupées, coiffeur toujours actif) a-t-elle un effet sur ses clients en attente ou sur son client appelé ? Rien ne le dit ; on suppose que non.
- **APP_FLOW** : peut-on réactiver un coiffeur désactivé ? Un coiffeur désactivé compte-t-il dans la limite de 20 (S-04) ?
- **Résolu le 19/10** (constat 22, TRD v0.5 §6.2 « Hors `queue-command` ») : `revoke-member-sessions` renvoie `team.member_not_found` ; `deactivate-member` renvoie `team.member_not_found`, `team.already_deactivated`, `team.last_manager` ; plus les codes communs.
- **En attente de E36 (Ely)** : transition exacte du client appelé repris en tête (scénario 6 ter).
- **TRD (nouveau)** : un gérant qui vise un coiffeur d'un autre salon reçoit-il `team.member_not_found` ou `queue.forbidden` (scénario 9) ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
