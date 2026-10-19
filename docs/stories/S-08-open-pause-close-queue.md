# S-08 · Ouvrir, mettre en pause et fermer la file

**En tant que** gérant, **je veux** ouvrir, mettre en pause et fermer la file de mon salon en un clic, **afin de** maîtriser l'arrivée de nouveaux clients, avec un changement que les clients voient en moins de 2 s.

- Priorité : I (PRD §5.3)
- Règles appliquées : PRD §5.2 États de la file (Fermée, Ouverte, En pause, Complète) ; PRD §5.2 transition 1 (création seulement si la file est ouverte et non complète, sauf rendez-vous) ; file en pause : plus de nouvelles inscriptions, mais les coiffeurs continuent d'appeler les clients déjà inscrits (PRD §5.1, §11 E4) ; « Fermer la file » n'annule aucun ticket, seule la fin de journée (H9) annule ; propagation en moins de 2 s pour 95 % des événements, repli toutes les 30 s côté client et 10 s côté dashboard (PRD §6)
- Parcours : F-M5 ; F-M12 « Fermer la file maintenant » ; effets côté client F-C1 (filtre « Ouvert maintenant »), F-C2, F-C3 (erreurs) ; espace coiffeur F-S4 (« Appeler » actif aussi file en pause)
- Commandes et données : `set_queue_status` · `join_queue` et `register_walk_in` (refus) · `call_ticket` (file en pause) · tables `salons` (`queue_status`), `salon_events` (`queue_opened`, `queue_paused`, `queue_closed`) · messages temps réel `queue_status_changed` (canal `salon:{salon_id}`) et `salon_updated` (canal public `salon-public:{salon_id}`, ADR-018, K6)

## Scénarios

### 1. Ouvrir la file
- **Étant donné** un salon publié dont la file est fermée
- **Quand** le gérant clique sur « Ouvrir » dans le commutateur en haut du dashboard
- **Alors** la commande `set_queue_status` (`open`) est envoyée
- **Alors** le commutateur affiche l'état « Ouverte »
- **Alors** un visiteur sans compte qui a la fiche du salon ouverte voit le bouton « Rejoindre la file » s'activer en moins de 2 s (95 % des cas), par le canal public `salon-public:{salon_id}` (K6)
- **Alors** l'événement `queue_opened` est inscrit au journal du salon

### 1 bis. Ouvrir la file d'un salon non publié
- **Étant donné** un salon qui n'est pas encore publié
- **Quand** une commande `set_queue_status` (`open`) est envoyée
- **Alors** la commande est refusée avec l'erreur `queue.salon_not_published` (TRD §6.2)
- **Alors** la file reste fermée

### 2. Mettre la file en pause
- **Étant donné** une file ouverte avec des clients en attente
- **Quand** le gérant clique sur « Pause »
- **Alors** la commande `set_queue_status` (`paused`) est envoyée
- **Alors** aucun nouveau ticket n'est accepté
- **Alors** les tickets déjà en attente restent dans la file
- **Alors** la fiche salon affiche le bouton désactivé « File en pause, réessayez dans quelques minutes »
- **Alors** le salon disparaît de la liste quand le filtre « Ouvert maintenant » est activé
- **Alors** l'événement `queue_paused` est inscrit au journal du salon

### 2 bis. Les coiffeurs continuent d'appeler pendant la pause
- **Étant donné** une file en pause avec des clients en attente, et un coiffeur disponible
- **Quand** le coiffeur appuie sur « Appeler »
- **Alors** le premier ticket éligible passe au statut « appelé » (PRD §5.1, E4 ; TRD §6.2 `call_ticket`)
- **Alors** le client reçoit « votre tour » par push et par SMS

### 3. Reprendre après une pause
- **Étant donné** une file en pause avec des tickets en attente
- **Quand** le gérant clique sur « Ouvrir »
- **Alors** la file accepte de nouveau des tickets
- **Alors** les tickets en attente gardent leur ordre

### 4. Fermer la file
- **Étant donné** une file ouverte avec *n* clients en attente
- **Quand** le gérant clique sur « Fermer »
- **Alors** une confirmation s'affiche : « Les *n* clients en attente seront servis jusqu'à la fin de journée »
- **Quand** il confirme
- **Alors** la commande `set_queue_status` (`closed`) est envoyée
- **Alors** aucun nouveau ticket n'est accepté
- **Alors** aucun ticket en file n'est annulé : les clients en attente restent (PRD §5.2, BACKEND_SCHEMA `cancel_reason`)
- **Alors** la fiche salon affiche « Fermé » avec la prochaine ouverture
- **Alors** l'événement `queue_closed` est inscrit au journal du salon

### 5. Renoncer à la fermeture
- **Étant donné** la confirmation de fermeture affichée
- **Quand** le gérant la ferme sans confirmer
- **Alors** la file reste dans son état précédent

### 6. Rejoindre une file fermée
- **Étant donné** une file fermée
- **Quand** un client envoie `join_queue`, ou que le gérant envoie `register_walk_in`
- **Alors** la commande est refusée avec l'erreur `queue.queue_closed` (TRD §6.2)
- **Alors** le client voit le message et le lien « Salons proches » (F-C3)

### 6 bis. Rejoindre une file en pause
- **Étant donné** une file en pause
- **Quand** un client envoie `join_queue`, ou que le gérant envoie `register_walk_in`
- **Alors** la commande est refusée avec l'erreur `queue.queue_paused` (TRD §6.2)
- **Alors** le client voit le message et le lien « Salons proches » (F-C3)

### 7. File complète (état automatique)
- **Étant donné** une file ouverte dont la prochaine prestation finirait après la fermeture
- **Quand** un client envoie `join_queue`
- **Alors** la commande est refusée avec l'erreur `queue.queue_full`
- **Alors** la fiche salon affiche le bouton désactivé « Complet pour aujourd'hui » et le lien « Salons proches »

### 7 bis. Rendez-vous saisi avec la file fermée ou en pause
- **Étant donné** une file fermée ou en pause pendant les horaires d'ouverture
- **Quand** le gérant saisit un rendez-vous (`create_appointment`)
- **Alors** le rendez-vous est accepté : la condition « file ouverte et non complète » ne s'applique pas aux rendez-vous (PRD §5.2 transition 1 ; TRD §6.2 : ni `queue_closed` ni `queue_paused` pour `create_appointment`)

### 8. Repli sans temps réel
- **Étant donné** un client dont la page n'est pas mise à jour en temps réel
- **Quand** le gérant change l'état de la file
- **Alors** la page du client affiche le nouvel état au plus tard au rafraîchissement suivant, toutes les 30 s
- **Alors** un autre écran du dashboard affiche le nouvel état au plus tard 10 s après

### 9. Dashboard hors ligne
- **Étant donné** un dashboard qui a perdu la connexion
- **Quand** le gérant regarde le commutateur
- **Alors** le commutateur est désactivé et un bandeau signale la perte de connexion

### 10. Double clic
- **Étant donné** une file fermée
- **Quand** le gérant clique deux fois rapidement sur « Ouvrir »
- **Alors** un seul événement `queue_opened` est inscrit au journal

### 11. Seul le gérant change l'état de la file
- **Étant donné** un coiffeur connecté du salon
- **Quand** une commande `set_queue_status` est envoyée depuis son compte
- **Alors** la commande est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)
- **Alors** l'état de la file ne change pas

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.queue_status.open` | « Ouvrir » | Libellé indicatif (APP_FLOW F-M5) |
| `pro-manager.queue_status.pause` | « Pause » | Libellé indicatif (APP_FLOW F-M5) |
| `pro-manager.queue_status.close` | « Fermer » | Libellé indicatif (APP_FLOW F-M5) |
| `pro-manager.queue_status.close_confirm` | « Les {count} clients en attente seront servis jusqu'à la fin de journée » | APP_FLOW F-M5 ; pluriel ICU (0, 1, plusieurs) |
| `common.queue_status.closed` | « Fermée » | PRD §5.2 |
| `common.queue_status.open` | « Ouverte » | PRD §5.2 |
| `common.queue_status.paused` | « En pause » | PRD §5.2 |
| `common.queue_status.full` | « Complète » | PRD §5.2 |
| `pro-manager.board.offline_banner` | « Connexion perdue : les actions sont bloquées jusqu'au retour du réseau. » | Commun aux écrans du dashboard (APP_FLOW §8) |
| `errors.queue.queue_closed` | « La file est fermée : aucune nouvelle inscription n'est possible pour le moment. » | — |
| `errors.queue.queue_paused` | « La file est en pause : aucune nouvelle inscription pour le moment. Réessayez à sa reprise. » | TRD §6.2 |
| `errors.queue.queue_full` | « La file est complète pour aujourd'hui : les prochaines prestations finiraient après la fermeture. » | — |
| `errors.queue.salon_not_published` | « Votre salon n'est pas encore publié : la file ne peut pas être ouverte. Publiez-le d'abord. » | TRD §6.2 |
| `errors.queue.forbidden` | « Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. » | Code commun (TRD §6.2) |

## Questions ouvertes
- **Résolu le 18/10** : « Fermer la file » n'annule aucun ticket ; seule la fin de journée (H9) annule. PRD (transition 6, §5.4) et BACKEND_SCHEMA (`cancel_reason`) sont corrigés. Question d'origine : selon PRD §5.2 (transition 6), §5.4 (« Annulation par le salon : retrait, fermeture, fin de journée ») et `cancel_reason` = `queue_closed`, la fermeture annule les tickets en attente. Selon APP_FLOW F-M5 et F-M12, les clients en attente « seront servis » et « restent ». Lequel est juste ?
- **Résolu le 18/10** (E4, PRD §5.1) : pendant une pause de la file, les coiffeurs continuent d'appeler les clients déjà inscrits ; seules les nouvelles inscriptions sont bloquées.
- **Résolu le 18/10** (K1, TRD §6.2) : `join_queue` et `register_walk_in` sur une file en pause renvoient `queue.queue_paused` ; un compte sans droit reçoit `queue.forbidden`.
- **Résolu le 18/10** (K6, TRD ADR-018) : la fiche salon des visiteurs sans compte se met à jour par le canal public `salon-public:{salon_id}`, sans donnée personnelle.
- **PRD (contradiction interne)** : le tableau « États de la file » du PRD §5.2 dit toujours « En pause : les tickets en cours restent et sont traités à la reprise », alors que PRD §5.1 et E4 disent que les coiffeurs continuent d'appeler pendant la pause. Il faut corriger le tableau.
- **PRD / TRD** : PRD §5.2 transition 1 dit « File ouverte et non complète (sauf rendez-vous) ». Le scénario 7 bis lit l'exception comme valant aussi pour une file fermée ou en pause, ce que confirme l'absence de `queue_closed` et `queue_paused` pour `create_appointment` (TRD §6.2). Est-ce bien voulu ? `check_in_appointment`, lui, renvoie `queue_closed` mais pas `queue_paused` : un client peut-il se signaler pour son rendez-vous pendant une pause ?
- **PRD / APP_FLOW** : le PRD promet « en un clic », mais APP_FLOW F-M5 demande une confirmation pour « Fermer ». Faut-il accepter deux clics pour la fermeture ?
- **PRD / BACKEND_SCHEMA** : BACKEND_SCHEMA §10 dit que `queue-tick` ouvre et ferme la file « selon les horaires ». Le PRD et APP_FLOW ne décrivent qu'une action du gérant. La file s'ouvre-t-elle toute seule à l'heure d'ouverture ? Le gérant peut-il l'ouvrir hors des horaires ou pendant une fermeture exceptionnelle ?
- **PRD** : les clients déjà en attente sont-ils prévenus quand la file passe en pause ou se ferme ? PRD §5.4 n'en dit rien.
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
