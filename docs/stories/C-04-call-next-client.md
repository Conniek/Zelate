# C-04 · Appeler le prochain client

**En tant que** coiffeur, **je veux** appeler en un geste le prochain client éligible, **afin qu'**il soit prévenu tout de suite et arrive pendant que je me libère.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1, H3, H4, H6 ; PRD §5.2 transition 2 et « Distribution » règle 4 ; PRD §5.4 « Votre tour » ; PRD §7.1 principe 2 (refus du double déclenchement)
- Parcours : F-S4 → F-S5 (APP_FLOW §4) ; événement « Votre tour » (APP_FLOW §7)
- Commandes et données : `call_ticket` · tables `tickets`, `ticket_events`, `notifications`, `private.processed_commands` · canaux `salon:{salon_id}`, `ticket:{ticket_id}`

## Scénarios

### 1. Appel nominal
- **Étant donné** Inès « Disponible », sans client appelé ni en prestation
- **Et** le premier ticket éligible pour elle est celui de Léa (code AF2K9), sans préférence
- **Quand** Inès touche « Appeler »
- **Alors** le ticket de Léa passe de « En attente » à « Appelé » (`status` = `called`, `called_at` renseigné)
- **Et** le ticket est attribué définitivement à Inès (`assigned_member_id`)
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
- **Alors** la commande est refusée (code d'erreur à confirmer, voir questions)
- **Et** aucun second ticket n'est appelé
- **Et** l'appel en cours et son compteur ne changent pas

### 6. Deux coiffeurs appellent au même moment
- **Étant donné** Inès et Karim, tous deux « Disponibles », pour qui le même ticket est le seul éligible
- **Quand** ils touchent « Appeler » au même instant
- **Alors** le ticket est appelé par un seul des deux
- **Et** l'autre voit un message d'erreur du dictionnaire `errors` (code à confirmer, voir questions)
- **Et** aucun ticket n'est appelé pour l'autre

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

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.queue.call` | « Appeler » | Bouton `xl`, état de chargement pendant l'envoi |
| `pro-stylist.call.title` | « Appel en cours » | APP_FLOW F-S5 |
| `pro-stylist.call.countdown` | À rédiger (REQ-3) | Compteur de 10 min |
| `common.ticket_status.waiting` | « En attente » | PRD §5.2 |
| `common.ticket_status.called` | « Appelé » | PRD §5.2 |
| `notifications.your_turn.push.title` / `.body` | À rédiger (REQ-3) | Push de priorité haute ; prénom du coiffeur, adresse, code du ticket, compteur de 10 min ; partagé avec les stories client |
| `notifications.your_turn.sms` | À rédiger (REQ-3) | SMS ≤ 160 caractères GSM-7, testé avec les valeurs de longueur maximale (TRD §9) ; prénom du coiffeur, adresse, code ; envoyé même si le push est actif |
| `errors.queue.no_eligible_ticket` | À rédiger (REQ-3) | Aucun texte dans les documents |
| `errors.queue.invalid_transition` | À rédiger (REQ-3) | Aucun texte dans les documents |

## Questions ouvertes
- [PRD / BACKEND_SCHEMA] PRD §5.4 : « Votre tour » part « Toujours (SMS 3) ». Mais le plafond est de 3 SMS par ticket, et des SMS « choix de coiffeur » ou « risque de fin de journée » peuvent partir avant. BACKEND_SCHEMA §4.16 passe la ligne en `skipped` à 3 SMS. Si le plafond est déjà atteint, le SMS « Votre tour » part-il ?
- [TRD] Deux coiffeurs appellent en même temps : TRD §14 attend `invalid_transition` pour le perdant, mais `call_ticket` n'a pas de `ticket_id` et le serveur choisit sous verrou : le second devrait recevoir le ticket éligible suivant, ou `no_eligible_ticket`. Quel comportement ?
- [TRD §6.2] Code d'erreur quand un coiffeur appelle alors qu'il a déjà un client appelé ou en prestation.
- [PRD §5.2] File du salon « En pause » : « les tickets en cours restent et sont traités à la reprise ». Un coiffeur peut-il appeler pendant la pause de la file ? Si non, quel code (`queue_closed`) ? Et quand la file est « Fermée » : F-M5 dit que les inscrits sont servis, l'appel reste donc possible ?
- [PRD] Client déjà arrivé et en tête : envoie-t-on quand même le push et le SMS « Votre tour » à un client présent au salon (coût SMS) ?
- [PRD / TRD] « Votre tour envoyé en moins de 5 s » : mesuré jusqu'à la remise au fournisseur, ou jusqu'à la réception (TRD §14 : « réception < 5 s ») ?
- [BACKEND_SCHEMA / TRD §9] Le test « SMS ≤ 160 caractères avec des valeurs de longueur maximale » est impossible tant que `salon_members.first_name`, `salons.address_line` et `salons.city` n'ont pas de longueur maximale. Et une adresse ou un prénom avec un caractère hors GSM-7 (ê, â, î, ô, û, « », ’…) fait passer le SMS en UCS-2, limité à 70 caractères : faut-il translittérer ?
