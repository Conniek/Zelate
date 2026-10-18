# C-05 · Valider l'arrivée par le code du ticket

**En tant que** coiffeur, **je veux** valider l'arrivée de mon client en saisissant le code de son ticket, **afin de** confirmer que c'est bien lui et de pouvoir commencer sans risque d'erreur.

- Priorité : I (PRD §5.3)
- Règles appliquées : H7, H4, H6 ; PRD §5.2 transition 4 (condition : arrivée validée par le code) et « L'arrivée au salon n'est pas un état mais un horodatage »
- Parcours : F-S5 (APP_FLOW §4) ; F-C7 côté client
- Commandes et données : `confirm_arrival` (codes propres `queue.unknown_code`, `queue.ticket_other_salon` ; codes communs `queue.forbidden`, `queue.invalid_transition`, `queue.rate_limited`, `queue.invalid_payload`, TRD §6.2) · tables `tickets` (`short_code`, `arrived_at`), `ticket_events`

## Scénarios

### 1. Arrivée validée
- **Étant donné** Inès qui a appelé Léa (code AF2K9) il y a 4 min
- **Quand** Léa donne son code, Inès touche « Saisir le code » et saisit AF2K9
- **Alors** l'arrivée de Léa est horodatée (`arrived_at` renseigné)
- **Et** la carte « Appel en cours » affiche « Arrivé »
- **Et** le bouton « Commencer » devient actif
- **Et** Léa voit l'écran « Installez-vous » (F-C7)
- **Et** le journal du ticket enregistre un événement `arrival_confirmed`
- **Et** le dashboard affiche le statut d'approche « arrivé » en moins de 2 s

### 2. Arrivée avant le rappel
- **Étant donné** Léa appelée, dont l'arrivée est validée 4 min après l'appel
- **Quand** 5 min se sont écoulées depuis l'appel
- **Alors** aucun rappel n'est envoyé à Léa

### 3. Arrivée juste avant la libération
- **Étant donné** Léa appelée, dont l'arrivée est validée 9 min après l'appel
- **Quand** 10 min se sont écoulées depuis l'appel
- **Alors** la place de Léa n'est pas libérée
- **Et** son ticket reste au statut « Appelé », prêt à commencer

### 4. Code inconnu
- **Étant donné** Inès sur le pavé de saisie du code
- **Quand** elle saisit un code de 5 caractères qui ne correspond à aucun ticket de son salon
- **Alors** la commande est refusée avec `queue.unknown_code`
- **Et** un message clair du dictionnaire `errors` s'affiche
- **Et** aucun ticket ne change

### 5. Code d'un autre salon
- **Étant donné** un code qui ne correspond à aucun ticket du salon d'Inès mais à un ticket actif d'un autre salon
- **Quand** Inès le saisit
- **Alors** la commande est refusée avec `queue.ticket_other_salon`
- **Et** un message clair du dictionnaire `errors` s'affiche
- **Et** aucun ticket d'aucun salon ne change
- **Et** aucune information sur le ticket de l'autre salon (prénom, prestation) n'est montrée à Inès

### 6. Code d'un ticket clos
- **Étant donné** Léa, dont la place a été libérée 10 min après l'appel (statut « Absent »), qui arrive au salon
- **Quand** Inès saisit le code de Léa
- **Alors** la commande est refusée (code d'erreur à confirmer, voir questions)
- **Et** un message clair du dictionnaire `errors` s'affiche
- **Et** le ticket de Léa reste « Absent »

### 7. Code déjà utilisé
- **Étant donné** Léa dont l'arrivée a déjà été validée par son code
- **Quand** un coiffeur saisit à nouveau ce code
- **Alors** la commande est refusée (code d'erreur à confirmer, voir questions)
- **Et** l'horodatage d'arrivée de Léa ne change pas

### 8. Confidentialité
- **Étant donné** Inès qui valide l'arrivée de Léa
- **Quand** l'arrivée est confirmée
- **Alors** l'écran ne montre que le prénom de Léa
- **Et** aucun numéro de téléphone n'est affiché

### 9. Connexion perdue
- **Étant donné** Inès dont l'écran affiche « Connexion perdue »
- **Quand** elle veut saisir un code
- **Alors** « Saisir le code » est désactivé
- **Et** aucune arrivée n'est enregistrée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.arrival.enter_code` | « Saisir le code » | Libellé indicatif (APP_FLOW F-S5) |
| `pro-stylist.arrival.code_pad_label` | À rédiger (REQ-3) | Pavé de 5 caractères ; nom accessible pour lecteur d'écran |
| `pro-stylist.arrival.arrived` | « Arrivé » | APP_FLOW F-S5 |
| `errors.queue.unknown_code` | À rédiger (REQ-3) | « Message clair, aucun changement » (APP_FLOW F-S5) |
| `errors.queue.ticket_other_salon` | À rédiger (REQ-3) | Ne doit rien révéler du ticket de l'autre salon |
| `errors.queue.invalid_transition` | À rédiger (REQ-3) | Ticket clos ou code déjà utilisé, si ce code est retenu |

## Questions ouvertes
- [TRD §6.2] Reste ouvert après K1 : le tableau des codes donne à `confirm_arrival` seulement `unknown_code` et `ticket_other_salon`, et dit qu'il « refuse un code […] d'un ticket clos » sans nommer le code. Code pour un ticket clos (terminé, annulé, absent) et pour un code « déjà utilisé » (PRD C-05) : le code commun `invalid_transition`, ou `unknown_code` ?
- [TRD] Le code n'est unique que par salon et par journée (`unique (salon_id, service_date, short_code)`) : la recherche porte-t-elle seulement sur les tickets du jour du salon ? Un code d'hier qui correspond à un ticket d'aujourd'hui serait accepté pour ce ticket.
- [PRD / TRD] Un coiffeur peut-il valider l'arrivée d'un client appelé par un autre coiffeur, ou d'un client encore « En attente » (H8 : il reprend la tête de file à son arrivée) ? `confirm_arrival` est autorisé à « Coiffeur, gérant » sans `not_assigned_to_you`. Si oui, où se trouve le pavé de saisie hors de la carte « Appel en cours » (F-S5) ?
- [TRD] `queue.rate_limited` est désormais un code commun à toutes les commandes (TRD §6.2, K1), mais aucun seuil n'est fixé pour `confirm_arrival` (essai de codes au hasard). Quel plafond, par coiffeur ou par salon ?
- [PRD / APP_FLOW] Rendez-vous : APP_FLOW F-M13 affiche un rendez-vous « arrivé », et les règles 7 et 8 du PRD §5.2 supposent de savoir si le client avec rendez-vous est là. Peut-on valider l'arrivée d'un rendez-vous avant son appel, et depuis quel écran ? Que renvoie `confirm_arrival` pour le code d'un rendez-vous encore « À confirmer » (`pending_confirmation`) ?
- [APP_FLOW / DESIGN_SYSTEM] Le pavé de saisie : ne propose-t-il que les caractères du code (`A-H`, `J-N`, `P-Z`, `2-9`, sans 0, O, 1, I) ? La saisie en minuscules est-elle acceptée ? L'envoi est-il automatique au 5e caractère ?
