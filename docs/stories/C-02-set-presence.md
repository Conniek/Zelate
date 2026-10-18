# C-02 · Changer mon statut : disponible, pause, fin de journée

**En tant que** coiffeur, **je veux** me déclarer disponible, en pause (type et durée) ou en fin de journée, **afin que** la file et l'heure annoncée aux clients tiennent compte immédiatement de ma présence réelle.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1, H2 ; PRD §5.2 « Statuts du coiffeur », « Calcul de l'heure de passage » (t0 = fin de pause), transition 8 ; PRD §5.1 « Toute variation d'heure de 10 min ou plus et tout recul sont expliqués au client » ; PRD §5.4 (changement d'heure, choix de coiffeur)
- Parcours : F-S3 (APP_FLOW §4) ; ouverture du bilan F-S9 après « Fin de journée »
- Commandes et données : `set_presence` · tables `stylist_presence`, `salon_events`, `tickets`, `notifications` · canal `salon:{salon_id}` (`presence_changed`)

## Scénarios

### 1. Début de journée : hors ligne
- **Étant donné** un coiffeur actif qui n'a pas encore changé son statut aujourd'hui
- **Quand** il ouvre « Ma file »
- **Alors** sa barre de statut indique « Hors ligne »
- **Et** il ne reçoit aucun client
- **Et** il est exclu du calcul de l'attente
- **Et** le bouton « Je suis prêt » lui est proposé

### 2. Se déclarer prêt
- **Étant donné** un coiffeur « Hors ligne »
- **Quand** il touche « Je suis prêt »
- **Alors** son statut du jour devient « Disponible » (`stylist_presence.status` = `available`)
- **Et** il reçoit des clients selon la distribution (H1)
- **Et** l'attente des clients est recalculée immédiatement
- **Et** le dashboard affiche son nouveau statut en moins de 2 s
- **Et** le journal du salon enregistre un événement `presence_changed`

### 3. Choix proposés pour une pause
- **Étant donné** un coiffeur « Disponible »
- **Quand** il touche « Pause »
- **Alors** il choisit un type parmi exactement : repas, courte, imprévu
- **Et** il choisit une durée parmi exactement : 5, 10, 15, 30, 45, 60 min

### 4. Prendre une pause
- **Étant donné** un coiffeur « Disponible », sans client appelé ni en prestation
- **Quand** il choisit « Pause », le type repas et la durée 30 min
- **Alors** son statut devient « En pause » (`on_break`, `break_type` = `meal`, `expected_back_at` = maintenant + 30 min)
- **Et** un compte à rebours de la pause s'affiche dans sa barre de statut
- **Et** le bouton « Appeler » est désactivé
- **Et** l'heure de passage de ses clients est calculée à partir de la fin de la pause
- **Et** chaque client dont l'heure de passage bouge de 10 min ou plus reçoit une notification push de changement d'heure, avec la nouvelle heure et la raison
- **Et** aucun SMS n'est envoyé pour ce changement d'heure

### 5. Pause courte sans notification
- **Étant donné** un coiffeur « Disponible » dont les clients reculeraient de 5 min au plus avec une pause de 5 min
- **Quand** il prend une pause courte de 5 min
- **Alors** son statut devient « En pause »
- **Et** aucune notification de changement d'heure n'est envoyée aux clients

### 6. Reprendre avant la fin de la pause
- **Étant donné** un coiffeur « En pause » depuis 10 min sur une pause de 30 min
- **Quand** il touche « Reprendre »
- **Alors** son statut redevient « Disponible »
- **Et** le compte à rebours de la pause disparaît
- **Et** l'attente des clients est recalculée immédiatement
- **Et** chaque client dont l'heure avance de 10 min ou plus reçoit une notification push de changement d'heure

### 7. Fin de journée : confirmation
- **Étant donné** un coiffeur « Disponible » avec des clients dans sa file
- **Quand** il touche « Fin de journée » et choisit une heure de fin (maintenant ou plus tard)
- **Alors** une confirmation liste les clients concernés, par leur prénom seulement
- **Et** son statut ne change pas tant qu'il n'a pas confirmé

### 8. Fin de journée maintenant : effets
- **Étant donné** un coiffeur qui a choisi « Fin de journée » maintenant, avec des tickets sans préférence pressentis chez lui et des tickets qui le demandent
- **Quand** il confirme
- **Alors** son statut devient « Fin de journée » (`off_duty`, `shift_end_at` renseigné)
- **Et** il ne reçoit plus de nouveaux clients
- **Et** les tickets sans préférence sont redistribués aux autres coiffeurs, avec une nouvelle heure de passage
- **Et** chaque client qui le demandait reçoit la notification « choix de coiffeur » : « attendre » ou « premier disponible » (U-12)
- **Et** cette notification part par push, ou par SMS si le client n'a pas de push actif, dans la limite de 3 SMS par ticket
- **Et** son bilan du jour s'ouvre automatiquement (C-10)

### 9. Fin de journée à une heure plus tardive
- **Étant donné** un coiffeur « Disponible » à 15h00
- **Quand** il déclare et confirme une fin de journée à 17h00
- **Alors** il continue de recevoir des clients avant 17h00
- **Et** il ne reçoit plus de clients après 17h00
- **Et** les tickets qui dépasseraient 17h00 chez lui sont redistribués s'ils sont sans préférence, ou soumis au choix du client s'ils le demandent (sens de « dépasser » : voir questions)

### 10. Statuts réservés au gérant
- **Étant donné** un coiffeur connecté à l'espace coiffeur
- **Quand** il ouvre sa barre de statut
- **Alors** il ne trouve que « Je suis prêt », « Pause », « Reprendre » (en pause) et « Fin de journée »
- **Et** aucune action ne lui permet de se déclarer « Absent » ou « En retard » (statuts posés par le gérant, PRD §5.2)

### 11. Le coiffeur ne change que son propre statut
- **Étant donné** un coiffeur connecté
- **Quand** une commande `set_presence` est envoyée avec son compte pour le `member_id` d'un autre coiffeur
- **Alors** la commande est refusée (code d'erreur à confirmer, voir questions)
- **Et** le statut de l'autre coiffeur ne change pas

### 12. Connexion perdue
- **Étant donné** un coiffeur dont l'écran affiche le bandeau rouge « Connexion perdue »
- **Quand** il essaie de toucher « Je suis prêt », « Pause », « Reprendre » ou « Fin de journée »
- **Alors** ces boutons sont désactivés
- **Et** aucun changement de statut n'est enregistré

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.presence.ready` | « Je suis prêt » | Libellé indicatif (APP_FLOW F-S3) |
| `pro-stylist.presence.break` | « Pause » | Libellé indicatif |
| `pro-stylist.presence.resume` | « Reprendre » | Libellé indicatif |
| `pro-stylist.presence.end_of_day` | « Fin de journée » | Libellé indicatif |
| `pro-stylist.presence.end_of_day_now` | « maintenant » | Choix de l'heure de fin (APP_FLOW F-S3) |
| `pro-stylist.presence.end_of_day_later` | « plus tard » | Choix de l'heure de fin |
| `pro-stylist.presence.end_of_day_confirm` | À rédiger (REQ-3) | Confirmation listant les prénoms des clients concernés ; pluriel ICU |
| `pro-stylist.presence.break_countdown` | À rédiger (REQ-3) | Compte à rebours de la pause |
| `common.presence_status.offline` | « Hors ligne » | PRD §5.2 ; partagé avec le dashboard |
| `common.presence_status.available` | « Disponible » | PRD §5.2 |
| `common.presence_status.in_service` | « En prestation » | PRD §5.2 |
| `common.presence_status.on_break` | « En pause » | PRD §5.2 |
| `common.presence_status.late` | « En retard » | PRD §5.2 (posé par le gérant) |
| `common.presence_status.absent` | « Absent » | PRD §5.2 (posé par le gérant) |
| `common.presence_status.off_duty` | « Fin de journée » | PRD §5.2 |
| `common.break_type.meal` | « repas » | APP_FLOW F-S3 ; casse à valider |
| `common.break_type.short` | « courte » | APP_FLOW F-S3 |
| `common.break_type.unexpected` | « imprévu » | APP_FLOW F-S3 |
| `common.units.minutes` | « {count} min » | Durées 5, 10, 15, 30, 45, 60 |
| `notifications.estimate_changed.push.title` / `.body` | À rédiger (REQ-3) | Push seulement, pas de SMS ; nouvelle heure et raison (pause, fin de journée du coiffeur) ; partagé avec U-10 |
| `notifications.stylist_change_required.push.title` / `.body` | À rédiger (REQ-3) | « attendre » ou « premier disponible » ; partagé avec U-12 |
| `notifications.stylist_change_required.sms` | À rédiger (REQ-3) | SMS ≤ 160 caractères GSM-7, testé avec les valeurs de longueur maximale (TRD §9) ; seulement sans push actif, dans le plafond de 3 SMS |

## Questions ouvertes
- [PRD / APP_FLOW] Quand la durée de pause est écoulée sans « Reprendre » : retour automatique à « Disponible », ou le coiffeur reste « En pause » ?
- [PRD] Peut-on prendre une pause ou déclarer la fin de journée pendant un appel en cours ou une prestation en cours ? Si non, quel code d'erreur ?
- [PRD] Transition 8 et décision n° 15 : sans réponse en 10 min, le client « attend » sauf si le coiffeur est absent toute la journée. Pour un coiffeur en fin de journée, le client attendrait un coiffeur qui ne revient pas : est-ce voulu ?
- [PRD] La transition 8 cite comme acteurs « Système, gérant », alors que F-S3 laisse le coiffeur déclencher lui-même la fin de journée avec choix des clients. À aligner.
- [PRD] « Tickets qui dépasseraient » l'heure de fin : la prestation commencerait après `shift_end_at`, ou finirait après ?
- [APP_FLOW] « Fin de journée » plus tard : par quel pas se choisit l'heure ? Le bilan (F-S9) s'ouvre-t-il à la confirmation ou à l'heure de fin ? Le coiffeur peut-il annuler ou modifier une fin de journée déjà déclarée ?
- [TRD §6.2] Code d'erreur quand un coiffeur envoie `set_presence` pour un autre membre, ou avec un statut réservé au gérant (`late`, `absent`).
- [BACKEND_SCHEMA] `tickets.stylist_change_pending_since` décrit la règle sans réponse en 10 min comme « règle proposée, à valider en PLN-1 », alors que PRD §11 n° 15 l'a tranchée (A). Mettre le schéma à jour.
