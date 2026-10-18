# S-16 · Déconnecter à distance le compte d'un coiffeur

**En tant que** gérant, **je veux** déconnecter à distance tous les appareils d'un coiffeur (téléphone perdu ou changé) ou désactiver son compte (départ du salon), **afin qu'**aucune donnée client ne reste accessible sur un téléphone qui n'est plus sous contrôle.

- Priorité : I (PRD §5.3)
- Règles appliquées : aucune donnée client stockée sur le téléphone du coiffeur ; affichage seulement, rien en cache ; déconnexion à distance par le gérant (PRD §5.1, PRD §6 « Appareil du coiffeur ») ; PRD §11 n° 18 ; PRD §5.2 transition 8 (clients qui demandaient le coiffeur) ; isolation par salon (PRD §5.1)
- Parcours : F-M4 `/dashboard/team` ; côté coiffeur F-S2 et gardes de navigation (APP_FLOW §2.3) ; côté client F-C5 (story U-12)
- Commandes et données : `revoke-member-sessions` · tables `salon_members` (`status` = `deactivated`), `salon_events` (`member_sessions_revoked`, `member_deactivated`, `subject_member_id`), `tickets` (`requested_member_id`, `stylist_change_pending_since`), `notifications` (`stylist_change_required`)

## Scénarios

### 1. Déconnecter les appareils d'un coiffeur
- **Étant donné** le coiffeur Léa, actif, connecté sur son téléphone
- **Quand** le gérant ouvre le menu de Léa sur `/dashboard/team`, choisit « Déconnecter ses appareils » et confirme
- **Alors** la fonction `revoke-member-sessions` est appelée
- **Alors** toutes les sessions de Léa sont coupées
- **Alors** le téléphone de Léa affiche l'écran de connexion avec le message « Votre accès a été retiré »
- **Alors** le statut de Léa reste « actif »
- **Alors** l'événement `member_sessions_revoked` est inscrit au journal du salon, avec Léa comme membre concerné

### 2. Plus aucune donnée client sur le téléphone coupé
- **Étant donné** les sessions de Léa coupées
- **Quand** quelqu'un rouvre Zelaté Pro sur son ancien téléphone, ou utilise le bouton retour du navigateur
- **Alors** aucun prénom, aucune prestation et aucun code de ticket ne s'affiche

### 3. Le coiffeur se reconnecte après un changement de téléphone
- **Étant donné** Léa, active, dont les sessions ont été coupées
- **Quand** elle demande un lien magique sur son nouveau téléphone et l'ouvre
- **Alors** elle retrouve sa file

### 4. Désactiver un coiffeur qui quitte le salon
- **Étant donné** le coiffeur Sam, actif
- **Quand** le gérant choisit « Désactiver » dans le menu de Sam et confirme
- **Alors** le statut de Sam devient `deactivated`
- **Alors** toutes les sessions de Sam sont coupées
- **Alors** Sam ne reçoit plus de clients
- **Alors** Sam n'apparaît plus parmi les coiffeurs de la fiche salon
- **Alors** l'événement `member_deactivated` est inscrit au journal du salon, avec Sam comme membre concerné

### 5. Un coiffeur désactivé ne peut plus se reconnecter
- **Étant donné** Sam désactivé
- **Quand** il demande un lien magique et l'ouvre
- **Alors** il voit « Votre accès a été retiré, contactez votre gérant »
- **Alors** il n'a accès à aucune donnée du salon, ni par l'interface, ni par l'API, ni par le canal temps réel

### 6. Clients qui demandaient le coiffeur désactivé
- **Étant donné** des clients en attente qui demandaient Sam
- **Quand** Sam est désactivé
- **Alors** chacun reçoit une notification lui demandant de choisir « attendre » ou « premier disponible »
- **Alors** ces tickets sont marqués « en attente de réponse » sur le dashboard

### 7. Renoncer à l'action
- **Étant donné** la confirmation de « Déconnecter ses appareils » ou de « Désactiver » affichée
- **Quand** le gérant la ferme sans confirmer
- **Alors** les sessions et le statut du coiffeur ne changent pas

### 8. Dernier gérant du salon
- **Étant donné** un salon qui n'a qu'un gérant
- **Quand** une désactivation de ce gérant est demandée
- **Alors** la désactivation est refusée (au moins un gérant par salon, BACKEND_SCHEMA §4.4)

### 9. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** il demande la déconnexion ou la désactivation d'un coiffeur du salon B
- **Alors** la demande est refusée

### 10. Seul le gérant coupe l'accès
- **Étant donné** un coiffeur connecté
- **Quand** il demande la déconnexion d'un autre coiffeur par l'API
- **Alors** la demande est refusée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.team.menu.revokeSessions` | « Déconnecter ses appareils » | Libellé indicatif (APP_FLOW F-M4) |
| `pro-manager.team.menu.deactivate` | « Désactiver » | Libellé indicatif (APP_FLOW F-M4) |
| `pro-manager.team.revokeSessions.confirm` | — (à rédiger) | Rappelle que le coiffeur pourra se reconnecter par lien magique |
| `pro-manager.team.deactivate.confirm` | — (à rédiger) | Rappelle que l'accès est retiré et que les clients qui le demandaient devront choisir |
| `pro-manager.team.status.deactivated` | — (à rédiger) | Valeur `deactivated` |
| `pro-stylist.signin.accessRevoked` | « Votre accès a été retiré » / « Votre accès a été retiré, contactez votre gérant » | APP_FLOW §2.3 et F-S2 ; texte unique à choisir ; espace `pro-stylist` (story C-01 / F-S2) |
| `notifications.stylist_change_required.push` | — (à rédiger) | Partagée avec S-11 |
| `errors.team.lastManager` | — (à rédiger) | Au moins un gérant par salon |

## Questions ouvertes
- **APP_FLOW (contradiction)** : le message du coiffeur coupé n'est pas le même partout. APP_FLOW §2.3 dit « Votre accès a été retiré », F-S2 dit « Votre accès a été retiré, contactez votre gérant ». Après une simple déconnexion (téléphone perdu), le coiffeur reste actif et peut se reconnecter : « contactez votre gérant » l'induit en erreur. Faut-il deux messages, un pour la déconnexion et un pour la désactivation ?
- **TRD** : le TRD (§6.1) ne prévoit une fonction que pour la déconnexion (`revoke-member-sessions`). Aucune commande ni fonction n'est prévue pour la désactivation, et BACKEND_SCHEMA §7.2 réserve le changement de statut au serveur. Qui fait passer le statut à `deactivated` ?
- **TRD** : couper les sessions Supabase ne rend pas invalides les jetons d'accès déjà émis, qui restent valables jusqu'à leur expiration. Combien de temps, au plus, un téléphone coupé garde-t-il l'accès ? Faut-il un délai cible écrit dans le PRD ou le TRD (« immédiatement », TRD §7) ?
- **PRD** : que devient le client qu'un coiffeur a appelé ou qu'il coiffe au moment où il est désactivé ou déconnecté ? Le gérant peut-il terminer la prestation à sa place depuis le dashboard (PRD §9, parade « le gérant peut agir à sa place ») ?
- **PRD** : la règle des 10 min sans réponse (transition 8) distingue « absent toute la journée » et les autres cas. Dans quel cas range-t-on un coiffeur désactivé ?
- **APP_FLOW** : peut-on réactiver un coiffeur désactivé ? Un coiffeur désactivé compte-t-il dans la limite de 20 (S-04) ?
- **TRD** : les codes d'erreur de `revoke-member-sessions` et de la désactivation ne sont pas listés.
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
