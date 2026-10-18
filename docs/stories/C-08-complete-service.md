# C-08 · Terminer la prestation

**En tant que** coiffeur, **je veux** terminer la prestation d'un geste sûr, **afin que** la durée réelle soit enregistrée, que l'attente se recalcule pour tous et que mon prochain client s'affiche.

- Priorité : I (PRD §5.3)
- Règles appliquées : H2 ; PRD §5.2 transition 5 (« Coiffeur, ou gérant si le coiffeur a oublié ») ; PRD §5.1 « Le gérant peut clore une prestation qu'un coiffeur a oublié de terminer ; l'action est inscrite au journal » (E15), règle des 10 min ; PRD §7.1 principe 2 (les gestes critiques refusent le double déclenchement)
- Parcours : F-S7 → F-S4 (APP_FLOW §4) ; F-M6 « Panneau ticket : Terminer la prestation » (dashboard) ; F-C5 (écran de fin côté client)
- Commandes et données : `complete_service` (coiffeur attribué ; gérant, E15 ; code propre `queue.not_assigned_to_you`, code commun `queue.invalid_transition`, TRD §6.2) · tables `tickets` (`completed_at`, `actual_duration_minutes`), `stylist_presence`, `ticket_events` (`completed`, `actor_type` = `manager` quand c'est le gérant), `notifications` (et peut-être `salon_members.served_today_count`, voir questions)

## Scénarios

### 1. Terminer par un appui long
- **Étant donné** Inès en prestation avec Léa depuis 14h00, durée prévue 30 min
- **Quand** à 14h32, Inès maintient « Terminer » pendant 600 ms
- **Alors** le ticket passe de « En prestation » à « Terminé » (`completed`, `completed_at` renseigné)
- **Et** la durée réelle enregistrée est de 32 min (`actual_duration_minutes`)
- **Et** le statut d'Inès redevient « Disponible »
- **Et** Inès revient sur « Ma file », avec son prochain client en haut
- **Et** l'heure de passage des clients suivants est recalculée
- **Et** Léa voit l'écran de fin avec la raison et « Rejoindre une autre file »
- **Et** le journal du ticket enregistre un événement `completed`
- **Et** le dashboard affiche Inès « Disponible » en moins de 2 s

### 2. Appui trop bref
- **Étant donné** Inès en prestation
- **Quand** elle touche « Terminer » et relâche avant 600 ms
- **Alors** la prestation n'est pas terminée directement
- **Et** le ticket reste « En prestation »

### 3. Terminer au clavier
- **Étant donné** Inès en prestation, le focus sur « Terminer »
- **Quand** elle appuie sur Entrée puis confirme
- **Alors** le ticket passe à « Terminé »

### 4. Prestation plus courte que prévu
- **Étant donné** Inès en prestation depuis 14h00, durée prévue 45 min
- **Quand** elle termine à 14h25
- **Alors** la durée réelle enregistrée est de 25 min
- **Et** l'heure de passage des clients suivants avance
- **Et** chaque client dont l'heure avance de 20 min reçoit une notification push de changement d'heure, avec la raison
- **Et** aucun SMS n'est envoyé pour ce changement d'heure

### 5. Le prochain client n'est pas appelé automatiquement
- **Étant donné** Inès qui vient de terminer, avec un ticket éligible dans sa file
- **Quand** elle revient sur « Ma file »
- **Alors** le prochain client est affiché en haut, sans être appelé
- **Et** le bouton « Appeler » est actif

### 6. Double déclenchement
- **Étant donné** Inès en prestation
- **Quand** la commande `complete_service` est renvoyée avec le même `command_id` (réseau instable)
- **Alors** la prestation n'est terminée qu'une fois
- **Et** la réponse renvoyée est celle du premier traitement

### 7. Prestation déjà terminée
- **Étant donné** le ticket de Léa déjà « Terminé »
- **Quand** une nouvelle commande `complete_service` est envoyée pour ce ticket
- **Alors** la commande est refusée avec `queue.invalid_transition` (code commun, TRD §6.2)
- **Et** la durée réelle enregistrée ne change pas

### 8. Ticket d'un autre coiffeur
- **Étant donné** Léa en prestation chez Karim
- **Quand** une commande `complete_service` est envoyée avec le compte d'Inès pour ce ticket
- **Alors** la commande est refusée avec `queue.not_assigned_to_you`
- **Et** le ticket reste « En prestation » chez Karim

### 9. Connexion perdue
- **Étant donné** Inès en prestation, dont l'écran affiche « Connexion perdue »
- **Quand** elle veut terminer
- **Alors** « Terminer » est désactivé
- **Et** le ticket reste « En prestation » jusqu'au retour de la connexion

### 10. Le gérant termine une prestation oubliée (E15)
- **Étant donné** Inès qui a oublié de terminer la prestation de Léa, toujours « En prestation »
- **Quand** le gérant ouvre le ticket de Léa sur le dashboard, choisit « Terminer la prestation » et confirme
- **Alors** le ticket passe de « En prestation » à « Terminé » (`completed_at` renseigné)
- **Et** la durée réelle est enregistrée (`actual_duration_minutes`)
- **Et** le statut d'Inès redevient « Disponible »
- **Et** l'heure de passage des clients suivants est recalculée
- **Et** le journal du ticket enregistre un événement `completed` avec le gérant comme acteur (`actor_type` = `manager`)
- **Et** en moins de 2 s, l'écran d'Inès revient sur « Ma file », avec son prochain client en haut

### 11. Confirmation obligatoire côté gérant
- **Étant donné** le gérant sur le panneau du ticket de Léa, en prestation
- **Quand** il choisit « Terminer la prestation » puis ferme la confirmation sans valider
- **Alors** le ticket reste « En prestation »
- **Et** aucun événement `completed` n'est enregistré

### 12. Prestation déjà terminée par le coiffeur
- **Étant donné** le gérant qui a ouvert le panneau du ticket de Léa, et Inès qui termine la prestation juste avant lui
- **Quand** le gérant confirme « Terminer la prestation »
- **Alors** la commande est refusée avec `queue.invalid_transition`
- **Et** la durée réelle enregistrée par Inès ne change pas
- **Et** le journal ne contient qu'un seul événement `completed`, avec Inès comme actrice

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.service.complete` | « Terminer » | Appui long de 600 ms avec remplissage progressif (DESIGN_SYSTEM `HoldButton`) |
| `pro-stylist.service.complete_hint` | Maintenez pour terminer | Indication « maintenir pour terminer » pour l'utilisateur et le lecteur d'écran |
| `pro-stylist.service.complete_confirm` | Terminer la prestation de {first_name} ? | Confirmation après Entrée (alternative clavier) |
| `common.ticket_status.completed` | « Terminé » | PRD §5.2 |
| `notifications.estimate_changed.push.title` / `.body` |Titre : Votre heure de passage change<br>Corps : Passage prévu vers {time} chez {salon_name}. {reason}| Push seulement ; raison : prestation précédente terminée plus tôt |
| `errors.queue.invalid_transition` | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. | Voir C-04 |
| `errors.queue.not_assigned_to_you` | Ce client est pris en charge par un autre coiffeur. Seul ce coiffeur peut agir sur son ticket. | Voir C-06 |
| `pro-manager.ticket_panel.complete` | « Terminer la prestation » | APP_FLOW F-M6, panneau ticket (E15) |
| `pro-manager.ticket_panel.complete_confirm` | Terminer la prestation pour {first_name} ? L'action sera inscrite au journal à votre nom. | Confirmation avant `complete_service` au nom du gérant |

## Questions ouvertes
- [APP_FLOW / DESIGN_SYSTEM] APP_FLOW F-S7 : « appui long 600 ms, ou appui + confirmation » ; DESIGN_SYSTEM : la confirmation est l'alternative clavier (Entrée puis confirmation). Un appui bref au doigt ouvre-t-il une confirmation, ou ne fait-il rien ?
- [BACKEND_SCHEMA] Quand `salon_members.served_today_count` (critère d'égalité de la distribution, H1) augmente-t-il : à « Terminer », à « Commencer », à l'appel ? Comment `actual_duration_minutes` est-il arrondi (minute inférieure, supérieure) ?
- [PRD] Si l'heure de fin de journée du coiffeur (`shift_end_at`) passe pendant la prestation, son statut après « Terminer » est-il « Fin de journée » ou « Disponible » ?
- **Résolu le 18/10 (E15)** : le gérant peut clore une prestation oubliée depuis le dashboard, avec trace au journal (PRD §5.1, transition 5 ; TRD §6.2 `complete_service` ; APP_FLOW F-M6). Question d'origine : le gérant peut-il terminer à la place du coiffeur ?
- [PRD / BACKEND_SCHEMA] Prestation close tard par le gérant : la durée réelle enregistrée (`actual_duration_minutes`) est celle jusqu'à son geste, donc faussée, et fausse aussi les moyennes du bilan (C-10). Faut-il la marquer, l'exclure des statistiques, ou laisser le gérant corriger l'heure de fin ?
- [TRD §6.2] Un coiffeur qui n'est pas celui du ticket reçoit `not_assigned_to_you` ; un gérant d'un autre salon reçoit-il le code commun `forbidden` ? (`complete_service` n'a pas `ticket_other_salon`, contrairement à `remove_ticket`.)
