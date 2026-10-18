# C-06 · Commencer la prestation

**En tant que** coiffeur, **je veux** commencer la prestation en confirmant la prestation et sa durée, **afin que** l'heure de passage des clients suivants se calcule sur ce que je fais vraiment.

- Priorité : I (PRD §5.3)
- Règles appliquées : H2, H7 ; PRD §5.2 transition 4 et « Calcul de l'heure de passage » ; PRD §5.1 règle des 10 min
- Parcours : F-S5 → F-S6 → F-S7 (APP_FLOW §4)
- Commandes et données : `start_service` · tables `tickets` (`service_id`, `planned_duration_minutes`, `started_at`), `stylist_presence`, `services`, `ticket_events`, `notifications`

## Scénarios

### 1. Commencer avec la prestation et la durée prévues
- **Étant donné** Inès qui a appelé Léa, arrivée validée par son code, pour la prestation « Coupe homme » de durée prédéfinie 30 min
- **Quand** Inès touche « Commencer »
- **Alors** la feuille « Commencer la prestation » s'ouvre avec « Coupe homme » et 30 min pré-remplis
- **Quand** Inès touche « Commencer » dans la feuille
- **Alors** le ticket passe de « Appelé » à « En prestation » (`in_service`, `started_at` renseigné)
- **Et** la durée prévue enregistrée est de 30 min (`planned_duration_minutes`)
- **Et** le statut d'Inès devient « En prestation »
- **Et** la carte « En cours » affiche le prénom Léa, la prestation, le temps écoulé sur 30 min prévues et la fin estimée
- **Et** l'heure de passage des clients suivants est recalculée
- **Et** le journal du ticket enregistre un événement `service_started`
- **Et** le dashboard affiche Léa comme cliente en cours d'Inès, avec sa fin estimée, en moins de 2 s

### 2. Modifier la durée avant de commencer
- **Étant donné** la feuille « Commencer la prestation » ouverte avec 30 min
- **Quand** Inès augmente la durée par pas de 5 min jusqu'à 45 min et touche « Commencer »
- **Alors** la durée prévue enregistrée est de 45 min
- **Et** chaque client suivant dont l'heure de passage bouge de 15 min reçoit une notification push de changement d'heure, avec la raison
- **Et** aucun SMS n'est envoyé pour ce changement d'heure

### 3. Modifier la prestation
- **Étant donné** la feuille ouverte avec « Coupe homme »
- **Quand** Inès choisit une autre prestation du salon
- **Alors** la durée proposée devient la durée prédéfinie de cette prestation
- **Et** à la confirmation, le ticket enregistre la prestation choisie (`service_id`)

### 4. Client qui ne savait pas encore
- **Étant donné** Léa inscrite avec « Je ne sais pas encore » (`service_id` vide, durée de calcul 30 min)
- **Quand** Inès ouvre la feuille « Commencer la prestation »
- **Alors** aucune prestation n'est pré-remplie
- **Et** Inès doit choisir une prestation avant de commencer (`service_id` obligatoire dans `start_service`)

### 5. Arrivée non validée
- **Étant donné** Léa appelée, dont l'arrivée n'a pas été validée par son code
- **Quand** Inès regarde la carte « Appel en cours »
- **Alors** le bouton « Commencer » est inactif
- **Et** une commande `start_service` envoyée malgré tout est refusée avec `queue.invalid_transition` (code commun, TRD §6.2 : condition de la transition 4 non remplie)
- **Et** le ticket reste « Appelé »

### 6. Ticket d'un autre coiffeur
- **Étant donné** Léa appelée par Karim
- **Quand** une commande `start_service` est envoyée avec le compte d'Inès pour le ticket de Léa
- **Alors** la commande est refusée avec `queue.not_assigned_to_you`
- **Et** le ticket reste « Appelé » chez Karim

### 7. Bornes de la durée
- **Étant donné** la feuille « Commencer la prestation » ouverte
- **Quand** Inès modifie la durée
- **Alors** la durée enregistrée reste comprise entre 5 et 240 min (contrainte `tickets.planned_duration_minutes`, à confirmer, voir questions)

### 8. Double appui
- **Étant donné** la feuille « Commencer la prestation » ouverte
- **Quand** Inès touche deux fois « Commencer » très vite
- **Alors** le bouton est désactivé pendant l'envoi
- **Et** la prestation ne commence qu'une fois (un seul événement `service_started`)

### 9. Connexion perdue
- **Étant donné** Inès dont l'écran affiche « Connexion perdue »
- **Quand** elle veut commencer la prestation
- **Alors** « Commencer » est désactivé
- **Et** aucune prestation n'est enregistrée comme commencée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.start.open` | « Commencer » | Bouton de la carte « Appel en cours », actif quand le client est arrivé |
| `pro-stylist.start.sheet_title` | « Commencer la prestation » | APP_FLOW F-S6 |
| `pro-stylist.start.service_label` | À rédiger (REQ-3) | Champ prestation |
| `pro-stylist.start.duration_label` | À rédiger (REQ-3) | Durée modifiable par pas de 5 min |
| `pro-stylist.start.confirm` | « Commencer » | Bouton de la feuille |
| `common.presence_status.in_service` | « En prestation » | Voir C-02 |
| `common.ticket_status.in_service` | « En prestation » | PRD §5.2 |
| `errors.queue.not_assigned_to_you` | À rédiger (REQ-3) | Aucun texte dans les documents |
| `errors.queue.invalid_transition` | À rédiger (REQ-3) | Voir C-04 |
| `notifications.estimate_changed.push.title` / `.body` | À rédiger (REQ-3) | Voir C-02 ; push seulement |

## Questions ouvertes
- [PRD / BACKEND_SCHEMA] Bornes de la durée à la feuille « Commencer » : `tickets.planned_duration_minutes` va de 5 à 240 min, `services.duration_minutes` de 15 à 180 min. Le PRD ne dit rien. Lesquelles s'appliquent à la saisie du coiffeur ?
- [PRD] Le coiffeur peut-il choisir une prestation dont il ne maîtrise pas la spécialité requise ?
- [APP_FLOW] Quand le coiffeur change de prestation, la durée est-elle remplacée par la durée prédéfinie de la nouvelle prestation, même s'il l'avait déjà modifiée ?
- [PRD / APP_FLOW] Client déjà arrivé et en tête : « l'appel et le début s'enchaînent ». Faut-il deux gestes (« Appeler » puis « Commencer ») ou un seul ? La transition 4 ne part que de « Appelé ».
- [APP_FLOW] Que voit le client quand la prestation commence ? Aucune ligne de F-C5 ou F-C7 ne le décrit.
- **Résolu le 18/10 (K1)** : TRD §6.2 rattache les codes aux commandes ; `start_service` a pour code propre `not_assigned_to_you`, et une arrivée non validée relève du code commun `invalid_transition`. Question d'origine : les codes d'erreur n'étaient pas rattachés aux commandes.
- [PRD / TRD] Rendez-vous : un rendez-vous ne commence jamais avant son heure, sauf si le coiffeur est libre et que cela ne retarde personne (PRD §5.2). `start_service` sur un rendez-vous appelé avant son heure est-il toujours accepté, ou le moteur peut-il le refuser ?
