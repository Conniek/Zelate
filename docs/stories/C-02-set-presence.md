# C-02 · Changer mon statut : disponible, pause, fin de journée

**En tant que** coiffeur, **je veux** me déclarer disponible, en pause (type et durée) ou en fin de journée, **afin que** la file et l'heure annoncée aux clients tiennent compte immédiatement de ma présence réelle.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1, H2, H10 ; PRD §5.2 « Statuts du coiffeur », « Calcul de l'heure de passage » (t0 = fin de pause), transition 8 ; PRD §5.1 « Toute variation d'heure de 10 min ou plus et tout recul sont expliqués au client » (écart mesuré par rapport à la dernière heure annoncée, E11), « Coiffeur indisponible » (E6, E7 ; rendez-vous compris, E18 ; une pause ne déclenche pas le choix, E25), « Me prévenir » (E17 : le changement d'heure est un message d'anticipation, le choix de coiffeur un message indispensable) ; PRD §5.4 (changement d'heure, choix de coiffeur)
- Parcours : F-S3 (APP_FLOW §4) ; F-C5 (bandeau « Votre coiffeur n'est plus disponible », pas pour une pause) ; ouverture du bilan F-S9 après « Fin de journée »
- Commandes et données : `set_presence` ; codes communs `queue.forbidden`, `queue.invalid_transition` (TRD §6.2, aucun code propre) · tables `stylist_presence` (`status`, `break_type`, `expected_back_at`, `shift_end_at`), `salon_events`, `tickets` (`stylist_change_pending_since`, `last_notified_start_at`, `priority_since` 🟡 E36), `notifications` (`estimate_changed` avec une raison de `estimate_change_reason`, `stylist_change_required`) · canal `salon:{salon_id}` (`presence_changed`)

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
- **Et** chaque client qui a coché « Me prévenir » et dont l'heure de passage bouge de 10 min ou plus par rapport à la dernière heure qui lui a été annoncée (`last_notified_start_at`, E11) reçoit une notification push de changement d'heure, avec la nouvelle heure et la raison `stylist_break` (« Le coiffeur prévu fait une pause. »)
- **Et** aucun SMS n'est envoyé pour ce changement d'heure

### 4 bis. Client sans « Me prévenir » pendant la pause (E17)
- **Étant donné** Karim, client d'Inès, qui n'a pas coché « Me prévenir », et dont l'heure recule de 30 min avec la pause repas d'Inès
- **Quand** Inès confirme sa pause
- **Alors** aucune notification de changement d'heure ne part vers Karim (ligne `skipped`, `no_consent`)
- **Et** la nouvelle heure et le bandeau de raison s'affichent sur son ticket (APP_FLOW F-C5)

### 4 ter. Une pause ne déclenche pas le choix de coiffeur (E25)
- **Étant donné** Léa, qui a demandé Inès
- **Quand** Inès prend une pause de 30 min
- **Alors** Léa ne reçoit pas la notification « choix de coiffeur »
- **Et** le bandeau « Votre coiffeur n'est plus disponible » ne s'affiche pas sur son ticket
- **Et** `stylist_change_pending_since` reste vide pour son ticket

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
- **Et** chaque client qui a coché « Me prévenir » et dont l'heure avance de 10 min ou plus reçoit une notification push de changement d'heure, avec la raison `stylist_break_ended` (« Le coiffeur prévu a repris plus tôt. »)

### 7. Fin de journée : confirmation
- **Étant donné** un coiffeur « Disponible » avec des clients dans sa file
- **Quand** il touche « Fin de journée » et choisit une heure de fin (maintenant ou plus tard)
- **Alors** une confirmation liste les clients concernés, par leur prénom seulement, y compris ses rendez-vous restants (APP_FLOW F-S3)
- **Et** son statut ne change pas tant qu'il n'a pas confirmé

### 8. Fin de journée maintenant : effets
- **Étant donné** un coiffeur qui a choisi « Fin de journée » maintenant, avec des tickets sans préférence pressentis chez lui et des tickets qui le demandent
- **Quand** il confirme
- **Alors** son statut devient « Fin de journée » (`off_duty`, `shift_end_at` renseigné)
- **Et** il ne reçoit plus de nouveaux clients
- **Et** les tickets sans préférence sont redistribués aux autres coiffeurs, avec une nouvelle heure de passage
- **Et** chaque client qui le demandait reçoit la notification « choix de coiffeur » : « attendre » ou « premier disponible » (U-12)
- **Et** cette notification part par push, ou par SMS si le client n'a pas de push actif, dans la limite de 3 SMS par ticket, que le client ait coché « Me prévenir » ou non (message indispensable, E17)
- **Et** les clients sans préférence dont l'heure bouge de 10 min ou plus et qui ont coché « Me prévenir » reçoivent un changement d'heure avec la raison `stylist_unavailable` (« Un coiffeur n'est plus disponible aujourd'hui. »)
- **Et** son bilan du jour s'ouvre automatiquement (C-10)

### 8 bis. Choix proposé aux clients qui le demandaient (E7)
- **Étant donné** Léa, qui a demandé Inès, et Inès qui confirme sa fin de journée maintenant
- **Quand** Léa ouvre son ticket
- **Alors** le bandeau « Votre coiffeur n'est plus disponible » lui propose « Attendre Inès » et « Premier disponible » (APP_FLOW F-C5, coiffeur « partant plus tôt »)
- **Et** ce n'est pas le choix réduit à « Premier disponible » ou « Annuler ma place », réservé à un coiffeur absent toute la journée ou désactivé (E7)
- **Et** sans réponse de Léa en 10 min, son ticket continue d'attendre Inès (transition 8 ; voir questions)

### 8 ter. Fin de journée avec des rendez-vous restants (E18)
- **Étant donné** Inès qui a encore aujourd'hui le rendez-vous de Marc à 17h30, saisi avec le téléphone de Marc
- **Quand** elle choisit « Fin de journée » maintenant
- **Alors** la confirmation affiche aussi « Rendez-vous restant : Marc. Le gérant le réaffectera. »
- **Quand** elle confirme
- **Alors** le rendez-vous de Marc n'est pas redistribué automatiquement aux autres coiffeurs
- **Et** Marc reçoit le choix « attendre » ou « premier disponible », comme les autres clients qui demandaient Inès (E18)
- **Et** le gérant voit le rendez-vous de Marc parmi les rendez-vous touchés, qu'il peut réaffecter s'il le souhaite (E18 ; où il le voit : voir questions)

### 8 quater. Client sans « Me prévenir » : le choix part quand même (E17)
- **Étant donné** Karim, qui demandait Inès et n'a pas coché « Me prévenir », sans push actif, dont le ticket a reçu 1 SMS
- **Quand** Inès confirme sa fin de journée maintenant
- **Alors** Karim reçoit le SMS « choix de coiffeur » (message indispensable, E17)
- **Et** ce SMS compte dans le plafond de 3 SMS du ticket
- **Et** le bandeau de choix s'affiche sur son ticket (`/ticket` ou `/t/:shortCode`)

### 8 quinquies. Plafond de 3 SMS déjà atteint
- **Étant donné** Karim, qui demandait Inès, sans push actif, dont le ticket a déjà reçu 3 SMS comptés dans le plafond
- **Quand** Inès confirme sa fin de journée maintenant
- **Alors** aucun SMS « choix de coiffeur » ne part vers Karim (ligne `skipped`, `sms_cap_reached`)
- **Et** le bandeau de choix s'affiche sur son ticket

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

### 10 bis. Statut réservé envoyé malgré tout
- **Étant donné** un coiffeur connecté
- **Quand** une commande `set_presence` est envoyée avec son compte et le statut `absent` ou `late`
- **Alors** la commande est refusée avec `queue.forbidden` (droit insuffisant, TRD §6.2)
- **Et** son statut ne change pas

### 11. Le coiffeur ne change que son propre statut
- **Étant donné** un coiffeur connecté
- **Quand** une commande `set_presence` est envoyée avec son compte pour le `member_id` d'un autre coiffeur
- **Alors** la commande est refusée avec `queue.forbidden` (droit insuffisant, TRD §6.2)
- **Et** le statut de l'autre coiffeur ne change pas

### 12. Connexion perdue
- **Étant donné** un coiffeur dont l'écran affiche le bandeau rouge « Connexion perdue »
- **Quand** il essaie de toucher « Je suis prêt », « Pause », « Reprendre » ou « Fin de journée »
- **Alors** ces boutons sont désactivés
- **Et** aucun changement de statut n'est enregistré

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-stylist.presence.ready` | Je suis disponible | PRD §5.2 et APP_FLOW F-S3 disent « Je suis prêt » (voir questions) |
| `pro-stylist.presence.break` | Pause | APP_FLOW F-S3 |
| `pro-stylist.presence.break_sheet_title` | Prendre une pause | Feuille de choix du type et de la durée |
| `pro-stylist.presence.break_type_label` | Type | Repas, courte, imprévu |
| `pro-stylist.presence.break_duration_label` | Durée | 5, 10, 15, 30, 45, 60 min |
| `pro-stylist.presence.break_start` | Partir en pause | Validation de la feuille |
| `pro-stylist.presence.resume` | Reprendre | APP_FLOW F-S3 |
| `pro-stylist.presence.end_of_day` | Fin de journée | APP_FLOW F-S3 |
| `pro-stylist.presence.end_of_day_time_label` | Heure de fin | Choix de l'heure de fin |
| `pro-stylist.presence.end_of_day_now` | Maintenant | APP_FLOW F-S3 |
| `pro-stylist.presence.end_of_day_later` | Plus tard | APP_FLOW F-S3 |
| `pro-stylist.presence.end_of_day_confirm` | {count, plural, =0 {Aucun client n'attend chez vous.} one {{first_names} passera chez un collègue ou choisira de vous attendre.} other {{first_names} passeront chez vos collègues ou choisiront de vous attendre.}} | Confirmation listant les prénoms des clients concernés ; pluriel ICU |
| `pro-stylist.presence.end_of_day_appointments` | {count, plural, one {Rendez-vous restant : {first_names}. Le gérant le réaffectera.} other {Rendez-vous restants : {first_names}. Le gérant les réaffectera.}} | Rendez-vous restants dans la confirmation (F-S3, E18) |
| `pro-stylist.presence.end_of_day_submit` | Terminer ma journée | Bouton de confirmation |
| `pro-stylist.presence.break_countdown` | Pause · encore {minutes} min | Compte à rebours de la pause |
| `common.presence_status.offline` | Hors ligne | PRD §5.2 ; partagé avec le dashboard |
| `common.presence_status.available` | Disponible | PRD §5.2 |
| `common.presence_status.in_service` | En prestation | PRD §5.2 |
| `common.presence_status.on_break` | En pause | PRD §5.2 |
| `common.presence_status.late` | En retard | PRD §5.2 (posé par le gérant) |
| `common.presence_status.absent` | Absent | PRD §5.2 (posé par le gérant) |
| `common.presence_status.off_duty` | Fin de journée | PRD §5.2 |
| `common.break_type.meal` | Repas | APP_FLOW F-S3 |
| `common.break_type.short` | Courte | APP_FLOW F-S3 |
| `common.break_type.unexpected` | Imprévu | APP_FLOW F-S3 |
| `common.units.minutes` | {count} min | Durées 5, 10, 15, 30, 45, 60 |
| `common.change_reason.stylist_break` | Le coiffeur prévu fait une pause. | Raison `{reason}` d'une pause (K26) |
| `common.change_reason.stylist_break_ended` | Le coiffeur prévu a repris plus tôt. | Raison d'une reprise avant la fin de la pause |
| `common.change_reason.stylist_unavailable` | Un coiffeur n'est plus disponible aujourd'hui. | Raison d'une fin de journée |
| `notifications.estimate_changed.push.title` / `.body` |Titre : Votre heure de passage change<br>Corps : Passage prévu vers {time} chez {salon_name}. {reason}| Push seulement, pas de SMS ; message d'anticipation, seulement avec « Me prévenir » (E17) ; raison `common.change_reason.<code>` ; partagé avec U-10 |
| `notifications.stylist_change_required.push.title` / `.body` |Titre : Votre coiffeur n'est plus disponible<br>Corps : Attendre {stylist_first_name} ou prendre le premier coiffeur disponible ? Sans réponse, rien ne change.| « attendre » ou « premier disponible » ; message indispensable, part sans « Me prévenir » (E17) ; partagé avec U-12 |
| `notifications.stylist_change_required.sms` | {salon_name} : {stylist_first_name} a un empêchement. Attendre ou premier disponible ? Choisissez : {link} | SMS ≤ 160 caractères GSM-7, testé avec les valeurs de longueur maximale (prénom du coiffeur ≤ 30, nom du salon tronqué à 40, caractères hors GSM-7 translittérés, lien court `zelate.fr/t/xxxxxxxx`, TRD §9, K5, K20) ; seulement sans push actif, dans le plafond de 3 SMS ; part sans « Me prévenir » (E17) |
| `client.ticket.stylist_unavailable.wait` | Attendre {first_name} | APP_FLOW F-C5 ; partagé avec U-12 |
| `client.ticket.stylist_unavailable.first_available` | Premier disponible | APP_FLOW F-C5 ; partagé avec U-12 |
| `errors.queue.forbidden` | Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. | Code commun (TRD §6.2) ; voir C-01 |

## Questions ouvertes
- [PRD / APP_FLOW / BACKEND_SCHEMA] **E32 (en attente d'Ely)** : quand la durée de pause est écoulée sans « Reprendre », retour automatique à « Disponible », ou le coiffeur reste « En pause » ? Même question pour le passage à « Fin de journée » à l'heure `shift_end_at` choisie « plus tard ».
- [PRD / TRD] Peut-on prendre une pause ou déclarer la fin de journée pendant un appel en cours ou une prestation en cours ? `set_presence` n'a aucun code propre (TRD §6.2) : si c'est refusé, est-ce `queue.invalid_transition` ? Si c'est accepté, TRD §6.2 reprend le client appelé en tête (E6, marqueur `tickets.priority_since`), transition encore **en attente d'Ely (E36)** ; ce cas vaut-il aussi pour une pause, qui n'est pas une indisponibilité (E25) ?
- [PRD] Transition 8 et décision n° 15 : sans réponse en 10 min, le client « attend » ; E7 ne retire « attendre » que pour un coiffeur absent toute la journée ou désactivé. Pour un coiffeur en fin de journée maintenant, le client attendrait un coiffeur qui ne revient pas aujourd'hui : est-ce voulu ?
- **Résolu le 18/10** : la transition 8 cite désormais « Système, gérant, coiffeur (fin de journée) » (PRD §5.2). Question d'origine : acteurs de la transition 8 à aligner avec F-S3.
- [PRD] « Tickets qui dépasseraient » l'heure de fin : la prestation commencerait après `shift_end_at`, ou finirait après ?
- [APP_FLOW] « Fin de journée » plus tard : par quel pas se choisit l'heure ? Le bilan (F-S9) s'ouvre-t-il à la confirmation ou à l'heure de fin ? Le coiffeur peut-il annuler ou modifier une fin de journée déjà déclarée ?
- **Résolu le 18/10 (K1)** : `set_presence` n'a pas de code propre ; un `member_id` d'un autre coiffeur ou un statut réservé au gérant relève du code commun `queue.forbidden` (droit insuffisant, TRD §6.2). Question d'origine : code d'erreur de ces deux cas.
- **Résolu le 18/10** : `tickets.stylist_change_pending_since` décrit maintenant la règle tranchée (BACKEND_SCHEMA §4.13). Question d'origine : le schéma la disait « à valider en PLN-1 ».
- **Résolu le 18/10 (E7)** : quand le coiffeur demandé est absent toute la journée ou désactivé, « attendre » n'est pas proposé, seulement « premier disponible » ou annuler ; la fin de journée garde les deux choix (APP_FLOW F-C5). Question d'origine : « attendre » est-il proposé quand le coiffeur demandé ne revient pas ?
- **Résolu le 19/10 (E25)** : une pause du coiffeur ne déclenche pas le choix « attendre / premier disponible » ; APP_FLOW F-C5 est corrigé. Voir scénario 4 ter. Question d'origine : une pause déclenche-t-elle le choix du client ?
- **Résolu le 19/10 (E18)** en partie : le client avec rendez-vous choisit comme les autres, et le gérant voit les rendez-vous touchés pour les réaffecter s'il le souhaite. Voir scénario 8 ter. Reste [APP_FLOW] : où le gérant voit-il les rendez-vous touchés par une fin de journée déclarée par le coiffeur lui-même (F-M8 ne montre « rendez-vous à réaffecter » que dans l'aperçu d'une absence déclarée par le gérant) ?
- **Résolu le 19/10 (E17)** : le choix de coiffeur est un message indispensable, il part sans « Me prévenir ». Voir scénarios 8 quater et 8 quinquies. Question d'origine : sans consentement, la notification « choix de coiffeur » ne partait pas.
- [PRD / APP_FLOW / dictionnaire] Le bouton de mise en disponibilité s'appelle « Je suis prêt » dans PRD §5.2 et APP_FLOW F-S3, « Je suis disponible » dans `pro-stylist.presence.ready`. Lequel retenir ? Les scénarios gardent le libellé du PRD.
