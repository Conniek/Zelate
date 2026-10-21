# P-02 · Consulter le journal d'audit

**En tant qu'**administrateur de la plateforme, **je veux** consulter le journal d'audit (qui, quand, quoi, motif) et le filtrer par salon, **afin de** tracer les incidents et trancher les litiges.

- Priorité : I (PRD §5.3)
- Règles appliquées : H5 (recul tracé au journal d'audit), H6 (aucun numéro de client affiché) (PRD §5.1) ; retrait et réorganisation toujours justifiés (PRD §5.1, décisions d'Ely) ; journal d'audit inaltérable (PRD §6 « Sécurité ») ; le journal ne contient ni prénom, ni téléphone, ni jeton, ni texte libre ; la précision d'un retrait est rangée dans `tickets.removal_note`, jamais dans le journal (K10, TRD §6.2 et §7) ; le gérant peut clore une prestation, l'action est inscrite au journal (E15, PRD §5.1) ; persona « Admin plateforme » : tracer les incidents (PRD §3)
- Parcours : F-A2 (`/admin/audit`) (APP_FLOW §6) ; garde « sans droit admin » (APP_FLOW §2.3)
- Commandes et données : RPC `get_audit_log(salon_id?, from, to, type?, member_id?, cursor?)` (7 derniers jours par défaut ; prénom du membre qui a agi et code du ticket, jamais le prénom du client, K25 ; TRD §6.3, BACKEND_SCHEMA §8.1) · tables `ticket_events` (`reason_code`, `before`, `after`, `actor_type`), `salon_events` (dont `admin_viewed_client_data`), `platform_admins` · `remove_ticket` (`reason_code`, `note?` rangée dans `tickets.removal_note`), `take_next`, `complete_service`

## Scénarios

### 1. Consulter le journal global

- **Étant donné** que je suis connecté comme administrateur
- **Quand** j'ouvre `/admin/audit`
- **Alors** je vois les événements de tous les salons des 7 derniers jours (période par défaut, K25)
- **Et** chaque événement indique qui a agi (type d'acteur, et prénom du membre quand c'est un gérant ou un coiffeur), quand, quoi (type d'action), le code du ticket concerné et le motif s'il y en a un
- **Et** aucun événement n'affiche le prénom d'un client (K25)

### 2. Filtrer par salon

- **Étant donné** que le journal contient des événements de plusieurs salons
- **Quand** je choisis un salon dans le filtre « Salon »
- **Alors** seuls les événements de ce salon sont affichés

### 3. Filtrer par période, type d'action et acteur

- **Étant donné** que le journal est affiché
- **Quand** je choisis une période, un type d'action ou un acteur
- **Alors** seuls les événements qui correspondent à tous les filtres choisis sont affichés

### 4. Motif d'un retrait et d'un recul

- **Étant donné** qu'un gérant a retiré un ticket avec le motif `emergency` et une précision facultative, et qu'un coiffeur a choisi « Prendre le suivant » pour un client qui avait déclaré un retard
- **Quand** je consulte ces événements
- **Alors** le retrait affiche son motif structuré (`reason_code`)
- **Et** la précision saisie par le gérant n'apparaît pas dans le journal (elle reste dans `tickets.removal_note`, K10)
- **Et** le recul affiche sa raison

### 4 bis. Ni prénom ni texte libre dans le journal (K10)

- **Étant donné** des événements de tickets (création, retrait avec précision, recul, réponse à T-30) et de salon
- **Quand** je les consulte, avec leurs valeurs avant et après
- **Alors** aucun prénom de client n'apparaît dans le contenu des événements
- **Et** aucun texte libre n'apparaît : seuls des motifs structurés (`reason_code`) sont affichés

### 4 ter. Prestation close par le gérant (E15)

- **Étant donné** qu'un gérant a terminé depuis le dashboard la prestation qu'un coiffeur avait oublié de terminer
- **Quand** je consulte cet événement
- **Alors** il apparaît comme un événement `completed` dont l'acteur est de type gérant (`actor_type` = `manager`)

### 4 ter bis. Motifs des rendez-vous et des réaffectations (E27, E29)

- **Étant donné** un rendez-vous annulé par un coiffeur avec le motif `client_request`, un rendez-vous signalé refusé avec le motif `other`, et une demande de réaffectation restée sans réponse
- **Quand** je consulte ces événements
- **Alors** l'annulation (`cancelled`) affiche son motif `client_request`
- **Et** le refus (`appointment_rejected`) affiche son motif `other`
- **Et** la fin de la demande (`reassignment_resolved`) affiche le résultat `expired`

### 4 quater. Anonymisation à 12 mois sans toucher au journal (K10)

- **Étant donné** un ticket de plus de 12 mois, anonymisé par la tâche quotidienne (prénom, client et précision du retrait effacés)
- **Quand** je consulte les événements de ce ticket
- **Alors** ils sont toujours présents et identiques à ce qu'ils étaient avant l'anonymisation

### 5. Pagination

- **Étant donné** que la période choisie contient plus d'événements qu'une page n'en affiche
- **Quand** je demande la page suivante
- **Alors** les événements suivants s'affichent, sans doublon ni trou avec la page précédente

### 6. Journal inaltérable

- **Étant donné** un événement du journal
- **Quand** quiconque, administrateur compris, tente de le modifier ou de le supprimer
- **Alors** l'opération est refusée
- **Et** l'événement reste identique

### 7. Consultation de données client journalisée

- **Étant donné** que je suis administrateur
- **Quand** je consulte une donnée d'un client
- **Alors** un événement `admin_viewed_client_data` est ajouté au journal avec mon identité et l'heure
- **Et** l'événement porte le ticket consulté (`salon_events.ticket_id`, BACKEND_SCHEMA §4.15)

### 8. Confidentialité : ni numéro ni jeton

- **Étant donné** des événements de tickets créés depuis l'app, par QR et à l'accueil
- **Quand** je les consulte, avec leurs valeurs avant et après
- **Alors** aucun numéro de téléphone n'apparaît
- **Et** aucun jeton de suivi (`tracking_token`) n'apparaît

### 9. Accès réservé aux administrateurs

- **Étant donné** que je suis connecté avec un compte qui n'est pas administrateur de la plateforme
- **Quand** j'ouvre `/admin/audit`
- **Alors** je suis redirigé vers `/signin`
- **Et** aucun événement ne m'est montré

## Textes à prévoir

| Clé (anglais)                                           | Texte (français)                                                                                                                                                                                                                                                                                           | Contrainte                                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pro-manager.admin.audit.title`                         | Journal global                                                                                                                                                                                                                                                                                             | Titre de `/admin/audit`                                                                                                          |
| `pro-manager.admin.audit.columns.*`                     | Salon · Qui · Quand · Quoi · Motif                                                                                                                                                                                                                                                                         | Colonnes ; « Quand » au format fr-FR                                                                                             |
| `pro-manager.admin.audit.filters.salon` / `.all_salons` | Salon / Tous les salons                                                                                                                                                                                                                                                                                    | —                                                                                                                                |
| `pro-manager.admin.audit.filters.period`                | Période                                                                                                                                                                                                                                                                                                    | 7 derniers jours par défaut (K25)                                                                                                |
| `pro-manager.admin.audit.filters.type`                  | Type d'action                                                                                                                                                                                                                                                                                              | —                                                                                                                                |
| `pro-manager.admin.audit.filters.actor` / `.all_actors` | Acteur / Tous les acteurs                                                                                                                                                                                                                                                                                  | Voir questions (paramètre de la RPC)                                                                                             |
| `pro-manager.audit.event_type.<type>`                   | Exemples : `completed` « Prestation terminée », `postponed` « Client reculé dans la file », `admin_viewed_client_data` « Données client consultées par l'équipe Zelaté » (42 textes au dictionnaire)                                                                                                       | Une clé par valeur de `ticket_event_type` et de `salon_event_type` ; **manque `appointment_merged`** (43 valeurs dans les enums) |
| `pro-manager.audit.actor_type.<type>`                   | Client · Coiffeur · Gérant · Zelaté (automatique) · Équipe Zelaté                                                                                                                                                                                                                                          | Une clé par valeur de `actor_type`                                                                                               |
| `pro-manager.audit.reason.<code>`                       | `client_cancelled` « Annulé par le client » · `removed_by_salon` « Retiré par le salon » · `stylist_unavailable` « Coiffeur indisponible » · `end_of_day` « Fin de journée » · `appointment_rejected` « Rendez-vous refusé par le salon » · `take_next` « Retard déclaré : le coiffeur a pris le suivant » | Motifs affichés ; textes des valeurs de `removal_reason` et de `reassignment_choice` absents (voir questions)                    |
| `pro-manager.audit.postponed_places`                    | {count, plural, one {Reculé de # place} other {Reculé de # places}}                                                                                                                                                                                                                                        | Recul (H5)                                                                                                                       |
| `pro-manager.audit.load_more`                           | Afficher plus                                                                                                                                                                                                                                                                                              | Pagination                                                                                                                       |
| `pro-manager.admin.audit.empty`                         | Aucun événement pour ces filtres. Élargissez la période ou retirez un filtre.                                                                                                                                                                                                                              | État vide                                                                                                                        |

## Questions ouvertes

- **Résolu le 19/10 (TRD §6.3 et BACKEND_SCHEMA §8.1 v0.5)** en partie : `get_audit_log(salon_id?, from, to, type?, member_id?, cursor?)` dans les deux documents ; `type?` porte le filtre « Type d'action », `member_id?` (acteur ou membre concerné) le filtre par membre. Reste [APP_FLOW F-A2 / BACKEND_SCHEMA §8.1] : le filtre « Acteur » de l'admin vise-t-il aussi un type d'acteur (client, système, équipe Zelaté), que la RPC ne sait pas filtrer ?
- **Résolu le 18/10** (K10) — Journal inaltérable et anonymisation à 12 mois : le journal ne contient ni prénom ni texte libre, l'anonymisation porte seulement sur `tickets` (prénom, client, `removal_note`) ; voir scénarios 4, 4 bis et 4 quater.
- **APP_FLOW F-A2 / BACKEND_SCHEMA §3** : qu'est-ce qu'une « consultation d'une donnée client » qui déclenche `admin_viewed_client_data` : afficher un prénom dans le journal, ouvrir le détail d'un ticket, autre chose ?
- **Résolu le 19/10 (K25, TRD §6.3)** : chaque ligne porte le prénom du membre qui a agi et le code du ticket, jamais le prénom du client (scénario 1) ; un client apparaît comme « Client », le système comme « Zelaté (automatique) ». Question d'origine : pour « qui », quelle identité affiche-t-on selon le type d'acteur ? Le journal ne garde que `actor_member_id` ou `actor_profile_id` (K10) : l'écran affiche-t-il le nom d'un membre et le prénom d'un client lus dans `salon_members` et `profiles` (et alors, chaque affichage d'un prénom client déclenche-t-il `admin_viewed_client_data`) ? Que montre-t-il pour un client dont le compte est supprimé ou le ticket anonymisé ?
- **Résolu le 19/10 (K25)** en partie : 7 derniers jours par défaut. Reste [APP_FLOW F-A2] : combien d'événements par page (« Afficher plus ») ?
- **Résolu le 18/10** (K12) — Journal du salon côté gérant : exigence S-17 ajoutée au PRD (`/dashboard/audit`, filtres par date, coiffeur et type) ; voir la story S-17.
- **Résolu le 19/10 (dictionnaire `pro-manager.json`)** en partie : types d'événements, types d'acteurs, motifs d'annulation et état vide ont leur texte. Reste [dictionnaire] : `pro-manager.audit.event_type.appointment_merged` manque, ainsi que les libellés des motifs de retrait (`removal_reason`, scénario 4) et des résultats de réaffectation (`reassignment_choice`, scénario 4 ter bis) dans `pro-manager.audit.reason`.
