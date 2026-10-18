# P-02 · Consulter le journal d'audit

**En tant qu'**administrateur de la plateforme, **je veux** consulter le journal d'audit (qui, quand, quoi, motif) et le filtrer par salon, **afin de** tracer les incidents et trancher les litiges.

- Priorité : I (PRD §5.3)
- Règles appliquées : H5 (recul tracé au journal d'audit), H6 (aucun numéro de client affiché) (PRD §5.1) ; retrait et réorganisation toujours justifiés (PRD §5.1, décisions d'Ely) ; journal d'audit inaltérable (PRD §6 « Sécurité ») ; le journal ne contient ni prénom, ni téléphone, ni jeton, ni texte libre ; la précision d'un retrait est rangée dans `tickets.removal_note`, jamais dans le journal (K10, TRD §6.2 et §7) ; le gérant peut clore une prestation, l'action est inscrite au journal (E15, PRD §5.1) ; persona « Admin plateforme » : tracer les incidents (PRD §3)
- Parcours : F-A2 (`/admin/audit`) (APP_FLOW §6) ; garde « sans droit admin » (APP_FLOW §2.3)
- Commandes et données : RPC `get_audit_log(salon_id?, from, to, type?, cursor?)` (BACKEND_SCHEMA §8.1 ; voir questions ouvertes) · tables `ticket_events` (`reason_code`, `before`, `after`, `actor_type`), `salon_events` (dont `admin_viewed_client_data`), `platform_admins` · `remove_ticket` (`reason_code`, `note?` rangée dans `tickets.removal_note`), `take_next`, `complete_service`

## Scénarios

### 1. Consulter le journal global
- **Étant donné** que je suis connecté comme administrateur
- **Quand** j'ouvre `/admin/audit`
- **Alors** je vois les événements de tous les salons
- **Et** chaque événement indique qui a agi (type d'acteur et identité), quand, quoi (type d'action) et le motif s'il y en a un

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
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.admin.audit.columns.actor` | « Qui » | — |
| `pro-manager.admin.audit.columns.date` | « Quand » | Format fr-FR |
| `pro-manager.admin.audit.columns.action` | « Quoi » | — |
| `pro-manager.admin.audit.columns.reason` | « Motif » | — |
| `pro-manager.admin.audit.filters.salon` | « Salon » | — |
| `pro-manager.admin.audit.filters.period` | « Période » | — |
| `pro-manager.admin.audit.filters.type` | « Type d'action » | — |
| `pro-manager.admin.audit.filters.actor` | « Acteur » | — |
| `pro-manager.admin.audit.event_type.<type>` | _À rédiger (absent des docs)_ | Une clé par valeur de `ticket_event_type` et de `salon_event_type` |
| `pro-manager.admin.audit.actor_type.<type>` | _À rédiger (absent des docs)_ | Une clé par valeur de `actor_type` |
| `pro-manager.admin.audit.empty` | _À rédiger (absent des docs)_ | — |

## Questions ouvertes
- **APP_FLOW F-A2 / BACKEND_SCHEMA §8.1** : APP_FLOW prévoit un filtre « acteur », mais `get_audit_log` n'a pas de paramètre d'acteur (`salon_id?`, `from`, `to`, `type?`, `cursor?`).
- **TRD §6.3 / BACKEND_SCHEMA §8.1** : le TRD décrit `get_audit_log(salon_id?, from, to, cursor)`, sans `type?` ni `cursor` facultatif ; le schéma a `type?` et `cursor?`. Le filtre « type d'action » (APP_FLOW F-A2, scénario 3) est-il fait par la RPC ?
- **Résolu le 18/10** (K10) — Journal inaltérable et anonymisation à 12 mois : le journal ne contient ni prénom ni texte libre, l'anonymisation porte seulement sur `tickets` (prénom, client, `removal_note`) ; voir scénarios 4, 4 bis et 4 quater.
- **APP_FLOW F-A2 / BACKEND_SCHEMA §3** : qu'est-ce qu'une « consultation d'une donnée client » qui déclenche `admin_viewed_client_data` : afficher un prénom dans le journal, ouvrir le détail d'un ticket, autre chose ?
- **APP_FLOW F-A2 / BACKEND_SCHEMA §4.14** : pour « qui », quelle identité affiche-t-on selon le type d'acteur ? Le journal ne garde que `actor_member_id` ou `actor_profile_id` (K10) : l'écran affiche-t-il le nom d'un membre et le prénom d'un client lus dans `salon_members` et `profiles` (et alors, chaque affichage d'un prénom client déclenche-t-il `admin_viewed_client_data`) ? Que montre-t-il pour un client dont le compte est supprimé ou le ticket anonymisé ?
- **APP_FLOW F-A2** : quelle période est affichée par défaut ? Combien d'événements par page ?
- **Résolu le 18/10** (K12) — Journal du salon côté gérant : exigence S-17 ajoutée au PRD (`/dashboard/audit`, filtres par date, coiffeur et type) ; voir la story S-17.
- **Textes** : les libellés des types d'événements et d'acteurs et l'état vide ne figurent dans aucun document.
