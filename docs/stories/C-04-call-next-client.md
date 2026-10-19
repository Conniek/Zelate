# C-04 · Appeler le prochain client

**En tant que** coiffeur, **je veux** appeler en un geste le prochain client éligible, **afin qu'**il soit prévenu tout de suite et arrive pendant que je me libère.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1, H3, H4, H6, H10 ; PRD §5.2 transitions 1b et 2, « Distribution » règles 4 et 6 à 8 ; PRD §5.1 « Le SMS « votre tour » part toujours, même si le plafond de 3 SMS est atteint » (E1), « File en pause : plus de nouvelles inscriptions, mais les coiffeurs continuent d'appeler les clients déjà inscrits » (E4) ; PRD §5.4 « Votre tour » (message indispensable, hors plafond, E17, E28) ; PRD §7.1 principe 2 (refus du double déclenchement)
- Parcours : F-S4 → F-S5 (APP_FLOW §4) ; événement « Votre tour » (APP_FLOW §7)
- Commandes et données : `call_ticket` (codes `queue.no_eligible_ticket`, `queue.call_already_in_progress`, TRD §6.2 ; verrou par salon du module `queue-transaction`, ADR-003, K38) · tables `tickets` (`assigned_member_id` fixé à l'appel, K39 ; `call_count`, K31 ; `called_at`, `release_due_at`, `declared_arrival_at`), `ticket_events`, `notifications` (`dedupe_key` `your_turn:<call_count>`), `private.processed_commands` · canaux `salon:{salon_id}`, `ticket:{ticket_id}`, `ticket-token:{token_key}`

## Scénarios

### 1. Appel nominal
- **Étant donné** Inès « Disponible », sans client appelé ni en prestation
- **Et** le premier ticket éligible pour elle est celui de Léa (code AF2K9), sans préférence
- **Quand** Inès touche « Appeler »
- **Alors** le ticket de Léa passe de « En attente » à « Appelé » (`status` = `called`, `called_at` renseigné)
- **Et** le ticket est attribué définitivement à Inès (`assigned_member_id`, K39)
- **Et** le nombre d'appels du ticket passe à 1 (`call_count`, K31)
- **Et** l'heure de libération est fixée à l'appel + 10 min (`release_due_at`), Léa n'ayant déclaré aucune heure d'arrivée plus tardive (`declared_arrival_at` vide ; cas du retard : C-09)
- **Et** la carte « Appel en cours » affiche le prénom Léa et un compteur de 10 min
- **Et** la notification « Votre tour » part en moins de 5 s
- **Et** Léa voit l'écran plein « C'est votre tour ! » avec le compteur de 10 min (F-C5)
- **Et** le dashboard affiche le ticket au statut « appelé » en moins de 2 s
- **Et** le journal du ticket enregistre un événement `called` avec Inès comme actrice

### 2. « Votre tour » part toujours par les deux canaux
- **Étant donné** Léa, qui a le push actif
- **Quand** Inès l'appelle
- **Alors** Léa reçoit une notification push de priorité haute
- **Et** Léa reçoit aussi un SMS, avec le prénom du coiffeur, l'adresse du salon et le code du ticket
- **Et** aucun numéro de téléphone n'est montré à Inès : le SMS part de la plateforme

### 2 bis. Plafond de 3 SMS déjà atteint (E1)
- **Étant donné** Léa, dont le ticket a déjà reçu 3 SMS (par exemple inscription, « Préparez-vous », « choix de coiffeur »)
- **Quand** Inès l'appelle
- **Alors** le SMS « Votre tour » part quand même
- **Et** ce SMS ne compte pas dans le plafond de 3 SMS (BACKEND_SCHEMA §4.16, E28)

### 2 ter. Client sans « Me prévenir »
- **Étant donné** Léa, qui n'a pas coché « Me prévenir »
- **Quand** Inès l'appelle
- **Alors** Léa reçoit quand même le SMS « Votre tour » (message indispensable, PRD §5.1, E17)
- **Et** elle reçoit aussi la notification push « Votre tour » si elle a le push actif

### 3. Le serveur choisit le client
- **Étant donné** Inès « Disponible », dont la liste « Ensuite » contient plusieurs clients
- **Quand** elle touche « Appeler »
- **Alors** c'est le premier ticket éligible de la file qui est appelé (il la demande, ou il est sans préférence et elle maîtrise la prestation)
- **Et** les tickets qui demandent un autre coiffeur sont sautés sans perdre leur rang

### 4. Double appui
- **Étant donné** Inès « Disponible » avec un ticket éligible
- **Quand** elle touche deux fois « Appeler » très vite
- **Alors** le bouton est désactivé pendant l'envoi
- **Et** un seul ticket est appelé
- **Et** une seule notification « Votre tour » est créée pour ce ticket

### 5. Deux appels simultanés impossibles pour un même coiffeur
- **Étant donné** Inès qui a déjà un client appelé
- **Quand** une seconde commande `call_ticket` est envoyée avec son compte
- **Alors** la commande est refusée avec `queue.call_already_in_progress`
- **Et** aucun second ticket n'est appelé
- **Et** l'appel en cours et son compteur ne changent pas

### 5 bis. Appel pendant une prestation en cours
- **Étant donné** Inès en prestation avec Léa
- **Quand** une commande `call_ticket` est envoyée avec son compte
- **Alors** la commande est refusée avec `queue.call_already_in_progress`
- **Et** aucun ticket n'est appelé

### 6. Deux coiffeurs appellent au même moment, un seul ticket éligible
- **Étant donné** Inès et Karim, tous deux « Disponibles », pour qui le même ticket est le seul éligible
- **Quand** ils touchent « Appeler » au même instant
- **Alors** le ticket est appelé par un seul des deux
- **Et** la commande de l'autre est refusée avec `queue.no_eligible_ticket`, jamais avec `queue.invalid_transition` (TRD §14)
- **Et** aucun ticket n'est appelé pour l'autre

### 6 bis. Deux coiffeurs appellent au même moment, deux tickets éligibles
- **Étant donné** Inès et Karim, tous deux « Disponibles », et les tickets de Léa puis de Paul, éligibles pour les deux
- **Quand** ils touchent « Appeler » au même instant
- **Alors** le ticket de Léa est appelé par l'un des deux
- **Et** le ticket de Paul est appelé par l'autre (ticket éligible suivant, TRD §14)
- **Et** aucun ticket n'est appelé deux fois

### 7. Plus aucun ticket éligible
- **Étant donné** Inès dont l'écran affiche encore un prochain client, déjà appelé par un autre coiffeur
- **Quand** elle touche « Appeler »
- **Alors** la commande est refusée avec `queue.no_eligible_ticket`
- **Et** un message du dictionnaire `errors` s'affiche
- **Et** aucun ticket ne change de statut

### 8. Coiffeur non disponible
- **Étant donné** Inès « En pause », « En prestation », « Fin de journée » ou « Hors ligne »
- **Quand** elle regarde la barre du bas
- **Alors** le bouton « Appeler » est désactivé

### 9. Client déjà arrivé et en tête
- **Étant donné** Léa, premier ticket éligible pour Inès, dont l'arrivée au salon est déjà horodatée (`arrived_at`)
- **Quand** Inès touche « Appeler »
- **Alors** le ticket de Léa passe au statut « Appelé »
- **Et** le bouton « Commencer » est actif tout de suite, sans saisie du code (l'appel et le début s'enchaînent, PRD §5.2)

### 10. Connexion perdue
- **Étant donné** Inès dont l'écran affiche « Connexion perdue »
- **Quand** elle regarde la barre du bas
- **Alors** le bouton « Appeler » est désactivé
- **Et** aucune commande `call_ticket` n'est envoyée

### 11. File du salon en pause (E4)
- **Étant donné** la file du salon « En pause » (`queue_status` = `paused`), Inès « Disponible » et Léa, inscrite avant la pause, premier ticket éligible pour elle
- **Et** le bouton « Appeler » d'Inès est actif (APP_FLOW F-S4)
- **Quand** Inès touche « Appeler »
- **Alors** le ticket de Léa passe au statut « Appelé »
- **Et** Léa reçoit « Votre tour » comme dans le scénario 1

### 12. L'appel respecte un rendez-vous à venir (règle 6)
- **Étant donné** il est 14h00, Inès « Disponible », et Marc a rendez-vous avec elle à 14h30
- **Et** la file contient, dans l'ordre d'inscription : Karim, sans préférence, prestation de 45 min ; Léa, sans préférence, prestation de 20 min ; tous deux éligibles pour Inès
- **Quand** Inès touche « Appeler »
- **Alors** c'est Léa qui est appelée (fin prévue 14h20, avant le rendez-vous)
- **Et** Karim n'est pas appelé et garde son rang (fin prévue 14h45, après le rendez-vous)

### 13. Appel du rendez-vous à son heure
- **Étant donné** il est 14h30, Inès « Disponible », Marc a rendez-vous avec elle à 14h30 et des tickets sans préférence éligibles pour elle sont inscrits avant
- **Quand** Inès touche « Appeler »
- **Alors** c'est le ticket de Marc qui est appelé
- **Et** la carte « Appel en cours » affiche Marc et le compteur

### 14. Rendez-vous en retard de 10 min au plus (règle 7)
- **Étant donné** Marc, rendez-vous à 14h30 avec Inès, pas encore pris, et Léa, sans préférence, éligible pour Inès et inscrite avant
- **Quand** Inès touche « Appeler » à 14h38
- **Alors** c'est le ticket de Marc qui est appelé

### 15. Rendez-vous à confirmer jamais appelé (transition 1b)
- **Étant donné** Inès « Disponible », dont le seul ticket possible est le rendez-vous signalé de Paul, encore « À confirmer » (`pending_confirmation`)
- **Quand** une commande `call_ticket` est envoyée avec son compte
- **Alors** la commande est refusée avec `queue.no_eligible_ticket`
- **Et** le ticket de Paul reste « À confirmer »

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.queue.call` | Appeler | Bouton `xl`, état de chargement pendant l'envoi |
| `pro-stylist.call.title` | Appel en cours | APP_FLOW F-S5 |
| `pro-stylist.call.countdown` | {minutes, plural, =0 {Place libérée dans moins d'1 min} other {Place libérée dans # min}} | Compteur de 10 min |
| `common.ticket_status.waiting` | « En attente » | PRD §5.2 |
| `common.ticket_status.called` | « Appelé » | PRD §5.2 |
| `notifications.your_turn.push.title` / `.body` |Titre : C'est votre tour !<br>Corps : {stylist_first_name} vous attend, {address}. Code {code}. Vous avez 10 min pour arriver.| Push de priorité haute ; prénom du coiffeur, adresse, code du ticket, compteur de 10 min ; partagé avec les stories client |
| `notifications.your_turn.sms` | Zelaté : c'est votre tour ! {stylist_first_name} vous attend, {address}. Code {code}. Venez sous 10 min : {link} | SMS ≤ 160 caractères GSM-7, testé avec les valeurs de longueur maximale (TRD §9, K5 : nom du salon tronqué à 40, caractères hors GSM-7 translittérés ; longueurs du prénom du coiffeur et de l'adresse : voir questions) ; prénom du coiffeur, adresse, code ; envoyé même si le push est actif, même plafond atteint (E1), même sans « Me prévenir » |
| `errors.queue.no_eligible_ticket` | Aucun client à appeler pour l'instant. Il a peut-être été pris par un collègue : vérifiez votre file. | Aucun texte dans les documents |
| `errors.queue.call_already_in_progress` | Vous avez déjà un client appelé ou en prestation. Finissez avec lui avant d'appeler le suivant. | Un client déjà appelé ou en prestation (TRD §6.2) |
| `errors.queue.invalid_transition` | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. | Code commun (TRD §6.2) ; scénario 6 si TRD §14 est confirmé |

## Questions ouvertes
- **Résolu le 18/10 (E1)** : le SMS « Votre tour » part toujours, hors plafond, comme les annulations par le salon (PRD §5.1, §5.4 ; BACKEND_SCHEMA §4.16). Question d'origine : si le plafond de 3 SMS est déjà atteint, le SMS « Votre tour » part-il ?
- [TRD] Deux coiffeurs appellent en même temps : TRD §14 attend toujours `invalid_transition` pour le perdant, mais `call_ticket` n'a pas de `ticket_id` et le serveur choisit sous verrou : le second devrait recevoir le ticket éligible suivant, ou `no_eligible_ticket`. Quel comportement ?
- **Résolu le 18/10 (K1)** : `queue.call_already_in_progress` (un client déjà appelé ou en prestation, TRD §6.2). Question d'origine : code d'erreur quand un coiffeur appelle alors qu'il a déjà un client appelé ou en prestation.
- **Résolu le 18/10 (E4)** : file en pause, les coiffeurs continuent d'appeler les inscrits ; seules les nouvelles inscriptions sont bloquées (PRD §5.1, TRD §6.2 `call_ticket`, APP_FLOW F-S4, F-M5). Question d'origine : un coiffeur peut-il appeler pendant la pause de la file ?
- [PRD §5.2] Contradiction restante : le tableau « États de la file du salon » dit encore, pour « En pause », « les tickets en cours restent et sont traités à la reprise », contraire à E4 (PRD §5.1). À corriger dans le PRD.
- [PRD / TRD] File « Fermée » : F-M5 dit que les inscrits « seront servis jusqu'à la fin de journée », mais ni PRD §5.2 ni TRD §6.2 (`call_ticket`) ne disent explicitement que l'appel reste possible quand la file est fermée. À confirmer.
- [PRD] Client déjà arrivé et en tête : envoie-t-on quand même le push et le SMS « Votre tour » à un client présent au salon (coût SMS, maintenant hors plafond) ?
- [PRD / TRD] « Votre tour envoyé en moins de 5 s » : mesuré jusqu'à la remise au fournisseur, ou jusqu'à la réception (TRD §14 : « réception < 5 s ») ?
- **Résolu le 18/10 (K5)** en partie : prénom ≤ 30, nom du salon tronqué à 40 dans les SMS, translittération des caractères hors GSM-7, lien court `zelate.fr/t/xxxxxxxx` (TRD §9). Question d'origine : longueurs maximales et caractères hors GSM-7.
- [BACKEND_SCHEMA / TRD §9] Reste ouvert après K5 : « Votre tour » contient le prénom du coiffeur et l'adresse du salon, or `salon_members.first_name`, `salons.address_line` et `salons.city` n'ont toujours pas de longueur maximale, et « prénom ≤ 30 » ne vise que le prénom du client (`tickets.display_name`). Quelles valeurs de longueur maximale utiliser pour le test des 160 caractères ?
- [PRD / TRD] Règles 6 à 8 : quand le seul ticket qui reste est un client sans rendez-vous qui finirait après le prochain rendez-vous d'Inès, et que ce rendez-vous n'est pas encore à son heure, `call_ticket` renvoie-t-il `no_eligible_ticket`, ou appelle-t-il le rendez-vous en avance (règle 8 : « si cela ne retarde personne ») ?
- [PRD / BACKEND_SCHEMA] Rendez-vous saisi par le salon sans téléphone (`create_appointment` sans `phone`) : le ticket n'a ni compte ni contact. « Votre tour » ne peut partir vers personne ; est-ce attendu, et l'écran d'Inès doit-il le signaler ?
