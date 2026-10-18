# C-10 · Voir mon bilan du jour

**En tant que** coiffeur, **je veux** voir mon bilan du jour, **afin de** savoir combien de clients j'ai servis et si mes durées réelles collent aux durées prévues.

- Priorité : S (PRD §5.3)
- Règles appliquées : PRD §5.1 isolation par salon et « Aucune donnée client n'est stockée sur le téléphone du coiffeur » ; BACKEND_SCHEMA §4.13 (`is_test` exclu des statistiques)
- Parcours : F-S9 (APP_FLOW §4) ; ouverture automatique après « Fin de journée » (F-S3, C-02)
- Commandes et données : RPC `get_day_summary` (`salon_id`, `service_date`, `member_id`) · tables `tickets` (`assigned_member_id`, `status`, `service_id`, `planned_duration_minutes`, `actual_duration_minutes`, `is_test`), `services`

## Scénarios

### 1. Bilan du jour
- **Étant donné** Inès qui a terminé aujourd'hui 6 prestations, dont 4 « Coupe homme » et 2 « Barbe »
- **Quand** elle ouvre « Mon bilan du jour » (`/stylist/summary`)
- **Alors** elle voit 6 clients servis
- **Et** elle voit la durée moyenne réelle de « Coupe homme » et celle de « Barbe »
- **Et** elle voit l'écart entre prévu et réel
- **Et** un bouton « Retour à ma file » la ramène sur « Ma file »

### 2. Ouverture après « Fin de journée »
- **Étant donné** Inès « Disponible »
- **Quand** elle déclare et confirme sa fin de journée
- **Alors** « Mon bilan du jour » s'ouvre automatiquement

### 3. Tickets de test exclus
- **Étant donné** Inès qui a servi aujourd'hui 3 clients réels et le client fictif « Test » du gérant (`is_test`)
- **Quand** elle ouvre son bilan
- **Alors** elle voit 3 clients servis
- **Et** la durée du ticket de test n'entre dans aucune moyenne

### 4. Seulement les prestations terminées du jour
- **Étant donné** Inès avec, aujourd'hui, des tickets terminés, un ticket en cours et un ticket libéré pour absence, et des tickets terminés hier
- **Quand** elle ouvre son bilan
- **Alors** seuls les tickets terminés aujourd'hui par Inès sont comptés comme clients servis

### 5. Aucun client servi
- **Étant donné** Inès qui n'a terminé aucune prestation aujourd'hui
- **Quand** elle ouvre son bilan
- **Alors** l'écran affiche un état vide avec une phrase et l'action « Retour à ma file »

### 6. Seulement son propre bilan
- **Étant donné** Inès et Karim, coiffeurs du même salon
- **Quand** une demande `get_day_summary` est envoyée avec le compte d'Inès et le `member_id` de Karim
- **Alors** la demande est refusée
- **Et** aucun chiffre de Karim n'est renvoyé

### 7. Isolation entre salons
- **Étant donné** Inès, coiffeuse du salon A
- **Quand** une demande `get_day_summary` est envoyée avec son compte pour le salon B
- **Alors** la demande est refusée
- **Et** aucun chiffre du salon B n'est renvoyé

### 8. Rien conservé sur le téléphone
- **Étant donné** Inès qui a consulté son bilan
- **Quand** elle ferme Zelaté Pro, coupe le réseau et la rouvre
- **Alors** le bilan n'est pas affiché
- **Et** le stockage local du navigateur ne contient aucune donnée du bilan ni aucun prénom de client

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.summary.title` | « Mon bilan du jour » | Titre de page (APP_FLOW §2.2) |
| `pro-stylist.summary.clients_served` | « Clients servis » | APP_FLOW F-S9 ; pluriel ICU si le nombre est intégré au texte |
| `pro-stylist.summary.avg_duration_by_service` | « Durée moyenne par prestation » | APP_FLOW F-S9 |
| `pro-stylist.summary.planned_vs_actual` | « Écart prévu / réel » | APP_FLOW F-S9 ; sens à préciser (voir questions) |
| `pro-stylist.summary.back_to_queue` | « Retour à ma file » | APP_FLOW F-S9 |
| `pro-stylist.summary.empty` | À rédiger (REQ-3) | État vide : phrase et action suivante (APP_FLOW §8) |
| `common.units.minutes` | « {count} min » | Voir C-02 |

## Questions ouvertes
- [APP_FLOW / BACKEND_SCHEMA] Contenu du bilan : F-S9 donne « clients servis, durée moyenne par prestation, écart prévu / réel » ; `get_day_summary` renvoie « clients servis, attente annoncée et réelle, absences, annulations ». Lequel fait foi pour le coiffeur ? Faut-il ajouter les absences et annulations ?
- [APP_FLOW] « Écart prévu / réel » : écart de durée (`planned_duration_minutes` contre `actual_duration_minutes`) ou écart d'heure (heure annoncée contre début réel, comme l'indicateur principal du PRD §8) ? Par prestation ou global ? En minutes ou en pourcentage ? La durée prévue est-elle celle d'origine ou celle après ajustements (C-07) ?
- [APP_FLOW] Accès au bilan en dehors de l'ouverture automatique : y a-t-il une entrée de menu, et le bilan est-il consultable en cours de journée ?
- [APP_FLOW] Fin de journée déclarée « plus tard » : le bilan s'ouvre-t-il à la confirmation ou à l'heure de fin (voir aussi C-02) ?
- [APP_FLOW] Le bilan liste-t-il les clients par prénom, ou seulement des chiffres agrégés ?
- [PRD] « Clients servis » : compte-t-on une prestation commencée par Inès mais terminée par le gérant à sa place, ou l'inverse ?
