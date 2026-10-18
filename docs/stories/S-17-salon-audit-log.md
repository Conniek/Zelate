# S-17 · Consulter le journal de son salon

**En tant que** gérant, **je veux** consulter le journal de mon salon (qui, quand, quoi, motif) et le filtrer par date, coiffeur et type, **afin de** savoir qui a fait quoi dans la file et de répondre à un client ou à un coiffeur qui conteste une action.

- Priorité : I (PRD §5.3)
- Règles appliquées : H5 (recul tracé au journal) ; H6 (numéro jamais affiché) ; retrait et réorganisation toujours justifiés (PRD §5.1, décisions d'Ely) ; le gérant peut clore une prestation oubliée, action inscrite au journal (PRD §5.1, §5.2 transition 5, §11 E15) ; isolation par salon (PRD §5.1) ; journal d'audit inaltérable (PRD §6) ; journal sans prénom ni texte libre (PRD §11 K12, TRD §7 et §8, K10)
- Parcours : F-M11 (`/dashboard/audit`) ; accès gérant (APP_FLOW §2.2)
- Commandes et données : RPC `get_audit_log(salon_id?, from, to, type?, cursor?)` (BACKEND_SCHEMA §8.1, TRD §6.3) · tables `ticket_events`, `salon_events` (colonnes `type`, `actor_type`, `actor_member_id`, `actor_profile_id`, `reason_code`, `before`, `after`, `created_at`, `subject_member_id`), `salon_members` (identité de l'acteur), `tickets` (`removal_note`, jamais lue par le journal)

## Scénarios

### 1. Consulter le journal du jour
- **Étant donné** Nadia, gérante du salon « Démo Enghien », connectée au dashboard
- **Et** des actions faites aujourd'hui dans son salon : ouverture de la file, appels, retraits, changements de statut des coiffeurs
- **Quand** elle ouvre `/dashboard/audit`
- **Alors** elle voit la liste des événements de son salon, du plus récent au plus ancien
- **Et** chaque ligne indique qui a agi, quand, quoi (type d'action) et le motif s'il y en a un
- **Et** les événements des tickets (`ticket_events`) et ceux du salon (`salon_events`) figurent dans la même liste

### 2. Qui a agi
- **Étant donné** un appel fait par Inès, une ouverture de file faite par Nadia, une libération automatique à 10 min faite par `queue-tick` et une annulation faite par un client
- **Quand** Nadia consulte ces événements
- **Alors** l'appel indique Inès comme actrice (coiffeur)
- **Et** l'ouverture de la file indique Nadia comme actrice (gérant)
- **Et** la libération indique le système comme acteur
- **Et** l'annulation indique un client comme acteur, sans son prénom

### 3. Prestation close par le gérant (E15)
- **Étant donné** qu'Inès a oublié de terminer une prestation et que Nadia l'a close depuis le panneau du ticket (F-M6, `complete_service`)
- **Quand** Nadia consulte le journal
- **Alors** l'événement `completed` de ce ticket apparaît
- **Et** il indique Nadia comme actrice, avec le type d'acteur « gérant » (`actor_type = 'manager'`)
- **Et** il se distingue d'une prestation terminée par le coiffeur lui-même

### 4. Motif d'un retrait, sans la précision libre (K10)
- **Étant donné** que Nadia a retiré un ticket avec le motif « urgence » et la précision « client malade »
- **Quand** elle consulte l'événement `cancelled` de ce ticket
- **Alors** le motif « urgence » est affiché (valeur de `removal_reason`, libellé du dictionnaire)
- **Et** la précision « client malade » n'apparaît pas dans le journal (elle reste dans `tickets.removal_note`)

### 5. Motif d'un recul (H5)
- **Étant donné** qu'Inès a choisi « Prendre le suivant » pour une cliente qui avait déclaré un retard
- **Quand** Nadia consulte l'événement `postponed`
- **Alors** la raison du recul est affichée
- **Et** le nombre de places reculées est affiché (2 au plus)

### 6. Ni prénom, ni téléphone, ni jeton (K10, H6)
- **Étant donné** des événements de tickets créés depuis l'app, par le QR, à l'accueil et par un rendez-vous saisi avec téléphone
- **Quand** Nadia consulte ces événements, valeurs avant et après comprises
- **Alors** aucun prénom de client n'apparaît
- **Et** aucun numéro de téléphone n'apparaît
- **Et** aucun jeton de suivi ni lien court n'apparaît
- **Et** aucun texte libre n'apparaît

### 7. Modification du prénom d'un rendez-vous
- **Étant donné** que Nadia a corrigé le prénom d'un rendez-vous (`update_appointment` avec `first_name`)
- **Quand** elle consulte l'événement `appointment_updated`
- **Alors** l'événement indique que le rendez-vous a été modifié
- **Et** ni l'ancien ni le nouveau prénom n'apparaissent

### 8. Filtrer par date
- **Étant donné** le journal affiché
- **Quand** Nadia choisit une période (du, au)
- **Alors** seuls les événements dont l'heure est dans cette période sont affichés, heures en heure de Paris

### 9. Filtrer par coiffeur
- **Étant donné** le journal affiché
- **Quand** Nadia choisit Inès dans le filtre « Coiffeur »
- **Alors** seuls les événements qui concernent Inès sont affichés (voir questions : acteur, membre concerné ou coiffeur du ticket)

### 10. Filtrer par type
- **Étant donné** le journal affiché
- **Quand** Nadia choisit un type d'action, par exemple les retraits
- **Alors** seuls les événements de ce type sont affichés

### 11. Filtres combinés
- **Étant donné** une période, un coiffeur et un type choisis
- **Quand** le journal se met à jour
- **Alors** seuls les événements qui correspondent aux trois filtres à la fois sont affichés

### 12. Pagination
- **Étant donné** une période qui contient plus d'événements qu'une page n'en affiche
- **Quand** Nadia demande la suite
- **Alors** les événements suivants s'affichent (`cursor`)
- **Et** aucun événement n'est affiché deux fois ni sauté

### 13. Aucun événement
- **Étant donné** des filtres pour lesquels aucun événement n'existe
- **Quand** le journal se met à jour
- **Alors** l'état vide s'affiche avec sa phrase (APP_FLOW §8)

### 14. Journal inaltérable
- **Étant donné** un événement du journal
- **Quand** Nadia regarde la ligne
- **Alors** aucune action de modification ni de suppression ne lui est proposée
- **Quand** une modification ou une suppression d'une ligne de `ticket_events` ou `salon_events` est tentée, par quiconque
- **Alors** elle est refusée
- **Et** l'événement reste identique

### 15. Isolation par salon
- **Étant donné** Nadia, gérante du salon A
- **Quand** une lecture `get_audit_log` est envoyée depuis son compte avec l'identifiant du salon B
- **Alors** aucun événement du salon B n'est renvoyé

### 16. Accès réservé au gérant
- **Étant donné** Inès, coiffeuse connectée sur son téléphone
- **Quand** elle regarde son espace coiffeur
- **Alors** aucun accès au journal du salon ne lui est proposé
- **Quand** une lecture `get_audit_log` pour son salon est envoyée depuis son compte
- **Alors** la lecture est refusée
- **Et** aucun événement ne lui est montré

### 17. Gérant révoqué ou désactivé
- **Étant donné** un compte de membre désactivé ou dont les sessions ont été coupées
- **Quand** une lecture `get_audit_log` est envoyée depuis ce compte
- **Alors** la lecture est refusée (ADR-019)

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.audit.title` | « Journal du salon » | Libellé indicatif (APP_FLOW §2.2) |
| `pro-manager.audit.columns.actor` | « Qui » | PRD §5.3 S-17 |
| `pro-manager.audit.columns.date` | « Quand » | PRD §5.3 S-17 ; format fr-FR, heure de Paris |
| `pro-manager.audit.columns.action` | « Quoi » | PRD §5.3 S-17 |
| `pro-manager.audit.columns.reason` | « Motif » | PRD §5.3 S-17 |
| `pro-manager.audit.filters.date` | Période | Filtre par date (APP_FLOW F-M11) |
| `pro-manager.audit.filters.stylist` | Coiffeur | Filtre par coiffeur (APP_FLOW F-M11) |
| `pro-manager.audit.filters.type` | Type d'action | Filtre par type (APP_FLOW F-M11) |
| `pro-manager.audit.event_type.<type>` | _À rédiger (clé absente du dictionnaire)_ | Une clé par valeur de `ticket_event_type` et de `salon_event_type` ; à partager avec P-02 (`pro-manager.audit.event_type.<type>`) ? |
| `pro-manager.audit.actor_type.<type>` | _À rédiger (clé absente du dictionnaire)_ | Une clé par valeur de `actor_type` ; le client sans prénom |
| `pro-manager.audit.reason.<reason_code>` | _À rédiger (clé absente du dictionnaire)_ | Reprend `pro-manager.remove.reason.<removal_reason>` (S-12) pour les retraits |
| `pro-manager.audit.load_more` | Afficher plus | Pagination |
| `pro-manager.audit.empty` | Aucune action pour ces filtres. Élargissez la période ou retirez un filtre. | État vide (APP_FLOW §8) |

## Questions ouvertes
- **BACKEND_SCHEMA §8.1 / TRD §6.3 / PRD §5.3** : S-17 et F-M11 demandent un filtre par coiffeur, mais `get_audit_log` n'a aucun paramètre de membre (`salon_id?`, `from`, `to`, `type?`, `cursor?`). Par ailleurs TRD §6.3 omet `type?`, que BACKEND_SCHEMA §8.1 contient.
- **APP_FLOW F-M11** : « filtre par coiffeur » = événements dont il est l'acteur (`actor_member_id`), dont il est le sujet (`subject_member_id`, ex. coiffeur déclaré absent), ou des tickets qui lui sont attribués ? Les trois ?
- **BACKEND_SCHEMA §8.1** : `type?` est une seule valeur, alors qu'il existe deux enums (`ticket_event_type`, `salon_event_type`). Le filtre porte-t-il sur une valeur précise ou sur une famille (« retraits », « rendez-vous », « équipe ») ? Plusieurs types à la fois ?
- **APP_FLOW F-M11** : sans prénom de client (K10), comment le gérant reconnaît-il le ticket d'un événement ? Par le code du ticket (`short_code`) ? Le code peut-il être affiché ?
- **APP_FLOW F-M11** : quelle identité afficher pour « qui » : prénom et nom du membre (`salon_members`), prénom seul ? Et pour un membre désactivé depuis ?
- **APP_FLOW F-M11** : période affichée par défaut (journée en cours ?), période maximale, nombre d'événements par page.
- **BACKEND_SCHEMA §3 / §7.2** : `admin_viewed_client_data` est un `salon_events`, donc lisible par le gérant (« L son salon »). Le gérant doit-il voir que l'équipe Zelaté a consulté les données de ses clients ?
- **TRD §6.3 / BACKEND_SCHEMA §4.15** : les tables de configuration (horaires, prestations, équipe, infos du salon) sont écrites directement sous RLS, sans `queue-command`. Ces modifications sont-elles journalisées (`settings_updated`), par quel mécanisme, et sans les textes libres qu'elles contiennent (`salon_closures.reason`, `welcome_message`) ?
- **BACKEND_SCHEMA §4.14** : les événements `estimate_changed` peuvent être très nombreux (chaque recalcul). Sont-ils affichés au gérant, ou masqués par défaut ?
- **APP_FLOW F-M11 / TRD §6.4** : le journal se met-il à jour en temps réel quand il est ouvert, ou seulement au rechargement ? Aucun événement temps réel n'est prévu pour lui.
- **APP_FLOW §2.3** : aucune garde n'est décrite pour un coiffeur qui ouvre une route `/dashboard/*` (dont `/dashboard/audit`). Où est-il redirigé ?
- **TRD §6.3** : quelle erreur renvoie `get_audit_log` hors `queue-command` (pas de code `queue.*`) quand le droit manque ?
- **P-02** : la question « l'anonymisation à 12 mois supprime les événements textuels libres » est réglée par K10 (TRD §8, BACKEND_SCHEMA §10) ; la story P-02 garde son ancienne formulation et son scénario 4 affiche encore « la précision éventuelle » d'un retrait, contraire à K10.
- **Textes** : libellés des filtres, des types d'événements, des acteurs, des motifs et de l'état vide absents des documents.
