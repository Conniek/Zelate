# S-15 · Gérer la fin de journée

**En tant que** gérant, **je veux** voir, à partir de 2 h avant la fermeture, les clients qui risquent de ne pas être pris, puis décider à la fermeture de « Servir » ou d'« Annuler avec excuses » les clients restants, **afin de** finir la journée à l'heure sans laisser de client sans réponse.

- Priorité : I (PRD §5.3)
- Règles appliquées : H9 ; PRD §5.2 Fin de journée (fenêtre à partir de 2 h avant la dernière fermeture de la journée, valeur par défaut réglable par salon après le pilote ; alerte unique, « Je reste » ou « J'annule » ; à la fermeture, le gérant voit tous les clients restants ; annulation automatique 15 min après la fermeture ; un client « servi » qui n'est pas pris avant la fin de la journée est annulé avec excuses ; aucun ticket ne passe d'un jour à l'autre) ; PRD §11 n° 19, E5 et E24 (client « servi » non pris annulé à minuit, heure de Paris ; rendez-vous restants traités comme les autres clients ; la coupure de midi n'annule rien) ; rendez-vous encore à confirmer annulés avec excuses à la fermeture (E19) ; nouveaux horaires du jour pris en compte (E16) ; PRD §5.4 (« Risque de fin de journée » : message d'anticipation, soumis à « Me prévenir », SMS dans la limite du plafond ; « Annulation par le salon » : message indispensable, push et SMS hors plafond, E17, E28) ; H6
- Parcours : F-M12 ; F-M5 (« Fermer ») ; côté client F-C5 bandeau « Risque de fin de journée » (story U-11)
- Commandes et données : `resolve_closing` (`ticket_ids`, `decision`) · `set_queue_status` (`closed`) · `respond_end_of_day` (réponse du client) · `queue-tick` · tables `salons` (`end_of_day_warning_minutes`, `closing_grace_minutes`), `tickets` (`end_of_day_warned_at`, `end_of_day_choice`, `closing_decision`, `cancel_reason` = `end_of_day`), `ticket_events` (`end_of_day_warned`, `end_of_day_responded`, `cancelled`), `salon_events` (`closing_resolved`), `notifications` (`end_of_day_risk`, `cancelled_by_salon`)

## Scénarios

### 1. Bandeau « Fin de journée » à partir de 2 h avant la fermeture

- **Étant donné** un salon qui ferme à 19:00, avec la fenêtre d'alerte par défaut de 120 min
- **Quand** il est 17:00
- **Alors** le bandeau « Fin de journée » s'affiche sur le dashboard
- **Alors** le bandeau liste les clients dont la fin estimée dépasse 19:00, avec leur réponse : « reste », « annule » ou « sans réponse »

### 2. Pas de bandeau avant la fenêtre

- **Étant donné** un salon qui ferme à 19:00, avec la fenêtre d'alerte par défaut de 120 min
- **Quand** il est 16:59
- **Alors** le bandeau « Fin de journée » n'est pas affiché

### 2 bis. Journée en plusieurs plages : seule la dernière compte

- **Étant donné** un salon ouvert de 09:00 à 12:00 puis de 14:00 à 19:00, avec la fenêtre d'alerte par défaut de 120 min
- **Quand** il est 10:00
- **Alors** le bandeau « Fin de journée » n'est pas affiché, et aucune alerte n'est envoyée (H9 : « dernière fermeture de la journée », E5)
- **Quand** il est 12:15, avec des clients encore en attente
- **Alors** aucun client n'est annulé et la boîte de décision ne s'ouvre pas : la file reprend à 14:00 (PRD §5.2, E24)
- **Quand** il est 17:00
- **Alors** le bandeau « Fin de journée » s'affiche

### 3. Une seule alerte par client à risque

- **Étant donné** un client dont la fin estimée dépasse la fermeture pendant la fenêtre d'alerte
- **Quand** le moteur recalcule la file
- **Alors** le client reçoit une seule alerte « Vous risquez de ne pas être pris avant la fermeture » avec « Je reste » et « J'annule »
- **Alors** `end_of_day_warned_at` est renseigné
- **Quand** le moteur recalcule de nouveau et que le client est toujours à risque
- **Alors** aucune deuxième alerte ne lui est envoyée

### 4. Canal de l'alerte et plafond SMS

- **Étant donné** un client à risque sans push actif, qui a coché « Me prévenir »
- **Quand** l'alerte de fin de journée part
- **Alors** elle part par SMS si le ticket a reçu moins de 3 SMS
- **Alors** aucun SMS ne part si le ticket a déjà reçu 3 SMS (la notification est marquée `skipped`, `sms_cap_reached`)

### 4 bis. Client à risque sans consentement

- **Étant donné** un client à risque qui n'a pas coché « Me prévenir »
- **Quand** la fenêtre de fin de journée le détecte
- **Alors** aucune alerte ne lui est envoyée (notification `skipped`, `no_consent` : message d'anticipation ; BACKEND_SCHEMA §4.16, E17)
- **Alors** le bandeau « Risque de fin de journée » s'affiche sur sa page de suivi (F-C5)
- **Alors** le dashboard le montre « sans réponse » dans le bandeau « Fin de journée »

### 5. Réponse du client visible par le gérant

- **Étant donné** un client à risque affiché « sans réponse » dans le bandeau
- **Quand** le client répond « Je reste »
- **Alors** le bandeau affiche « reste » pour ce client
- **Quand** un autre client répond « J'annule »
- **Alors** son ticket passe au statut `cancelled`
- **Alors** le bandeau affiche « annule » pour ce client

### 6. Fermer la file avant l'heure

- **Étant donné** le bandeau « Fin de journée » affiché
- **Quand** le gérant clique sur « Fermer la file maintenant »
- **Alors** la commande `set_queue_status` (`closed`) est envoyée
- **Alors** aucun nouveau client ne peut rejoindre la file
- **Alors** les clients déjà inscrits restent dans la file, aucun n'est annulé (APP_FLOW F-M12 ; PRD §5.2)

### 6 bis. Fermeture du jour changée dans la journée

- **Étant donné** un salon qui devait fermer à 19:00, et dont le gérant avance la fermeture du jour à 18:00
- **Quand** il est 16:00
- **Alors** le bandeau « Fin de journée » s'affiche, calculé sur 18:00 (PRD §5.1, E16)

### 7. Boîte de décision à l'heure de fermeture : tous les clients restants

- **Étant donné** 3 clients encore en attente à 19:00, heure de fermeture : Léa a répondu « Je reste », Sam n'a pas répondu, et Inès n'a reçu aucune alerte faute d'avoir coché « Me prévenir »
- **Quand** l'heure de fermeture est atteinte
- **Alors** la boîte « 3 clients attendent encore » s'ouvre sur le dashboard, avec les 3 clients (PRD §5.2, E5)
- **Alors** chaque client est affiché avec sa réponse éventuelle à l'alerte (F-M12)
- **Alors** chaque client a les choix « Servir » et « Annuler avec excuses »
- **Alors** un choix « Tous » applique la même décision à tous les clients restants

### 8. Servir un client restant

- **Étant donné** la boîte de décision ouverte
- **Quand** le gérant choisit « Servir » pour Léa
- **Alors** la commande `resolve_closing` (`serve`) est envoyée pour son ticket
- **Alors** le ticket de Léa reste dans la file, avec la décision `serve`
- **Alors** il ne sera pas annulé automatiquement 15 min après la fermeture

### 8 bis. Client « servi » qui n'est pas pris avant minuit

- **Étant donné** Léa, que le gérant a choisi de « Servir », toujours en attente
- **Quand** il est minuit, heure de Paris, sans qu'un coiffeur l'ait appelée (tolérance des tests ±60 s, K7)
- **Alors** `queue-tick` annule son ticket avec le motif `end_of_day` (PRD §5.2, E24 ; TRD §6.1, §6.2 `resolve_closing`)
- **Alors** l'annulation est inscrite au journal avec l'acteur `system`
- **Alors** Léa reçoit un message d'excuse par push et SMS, hors plafond (`cancelled_by_salon`, variante `end_of_day`)
- **Alors** son ticket n'est pas actif le lendemain
- **Quand** il est 23:59
- **Alors** le ticket de Léa est toujours en attente

### 9. Annuler avec excuses

- **Étant donné** la boîte de décision ouverte
- **Quand** le gérant choisit « Annuler avec excuses » pour Sam
- **Alors** la commande `resolve_closing` (`cancel`) est envoyée pour son ticket
- **Alors** le ticket de Sam passe au statut `cancelled` avec le motif `end_of_day`
- **Alors** Sam reçoit une notification push et un SMS, même au-delà du plafond, avec un message d'excuse et des salons proches
- **Alors** l'événement `closing_resolved` est inscrit au journal du salon

### 10. Décision pour tous

- **Étant donné** la boîte de décision ouverte avec 3 clients
- **Quand** le gérant choisit « Tous » puis « Annuler avec excuses »
- **Alors** les 3 tickets passent au statut `cancelled` avec le motif `end_of_day`
- **Alors** chacun des 3 clients reçoit le message d'excuse et des salons proches

### 11. Décisions mélangées

- **Étant donné** la boîte de décision ouverte avec 3 clients
- **Quand** le gérant sert Léa et annule Sam, sans rien décider pour le troisième client
- **Alors** Léa reste dans la file
- **Alors** Sam est annulé avec excuses
- **Alors** le troisième client reste en attente d'une décision

### 12. Aucune décision du gérant : annulation 15 min après la fermeture

- **Étant donné** un client resté sans décision du gérant après une fermeture à 19:00
- **Quand** il est 19:15 (tolérance des tests ±60 s, TRD §10.1, K7)
- **Alors** son ticket est annulé automatiquement avec le motif `end_of_day`
- **Alors** l'annulation est inscrite au journal avec l'acteur `system`
- **Alors** le client reçoit une notification push et un SMS, même au-delà du plafond et même sans « Me prévenir », avec un message d'excuse et des salons proches (E17)

### 12 bis. Rendez-vous restants à la fermeture

- **Étant donné** le rendez-vous confirmé de Karim à 18:40, pas encore appelé à 19:00, heure de fermeture
- **Quand** l'heure de fermeture est atteinte
- **Alors** Karim figure dans la boîte de décision comme les autres clients restants (PRD §5.2, E24)
- **Alors** « Servir » et « Annuler avec excuses » s'appliquent à lui comme aux autres

### 12 ter. Rendez-vous encore à confirmer à la fermeture

- **Étant donné** Inès, qui s'est signalée pour un rendez-vous et que personne n'a confirmé à 19:00, dernière fermeture de la journée
- **Quand** l'heure de fermeture est atteinte
- **Alors** son ticket `pending_confirmation` est annulé avec excuses par `queue-tick`, motif `end_of_day` (PRD §5.1, E19 ; TRD §6.1)
- **Alors** il ne figure pas dans la boîte de décision
- **Alors** Inès reçoit un message d'excuse

### 13. Décision après l'annulation automatique

- **Étant donné** un ticket déjà annulé automatiquement 15 min après la fermeture
- **Quand** une commande `resolve_closing` est envoyée pour ce ticket
- **Alors** le message de l'erreur `queue.invalid_transition` s'affiche
- **Alors** le ticket reste annulé

### 14. Décision avant l'heure de fermeture

- **Étant donné** une file avant son heure de fermeture
- **Quand** une commande `resolve_closing` est envoyée
- **Alors** la commande est refusée avec l'erreur `queue.closing_not_reached` (TRD v0.5 §6.2)
- **Alors** le message « Ce choix sera possible à l'heure de fermeture. » s'affiche

### 14 bis. Seul le gérant décide

- **Étant donné** un coiffeur connecté
- **Quand** une commande `resolve_closing` est envoyée depuis son compte
- **Alors** la commande est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)

### 15. Aucun ticket ne passe au lendemain

- **Étant donné** la fin de la journée de service
- **Quand** la journée suivante commence
- **Alors** aucun ticket de la veille n'est actif dans la file

### 16. Aucun numéro de téléphone (confidentialité)

- **Étant donné** le bandeau et la boîte de décision
- **Quand** le gérant les consulte
- **Alors** seuls les prénoms et les réponses des clients sont affichés, sans numéro de téléphone

## Textes à prévoir

| Clé (anglais)                                      | Texte (français)                                                                                                                                                                                                                              | Contrainte                                                                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pro-manager.end_of_day.banner.title`              | « Fin de journée »                                                                                                                                                                                                                            | Libellé indicatif (APP_FLOW F-M12)                                                                                                                                                                                     |
| `pro-manager.end_of_day.banner.body`               | « {count, plural, =0 {Aucun client ne risque de passer après la fermeture de {time}.} one {# client risque de ne pas être pris avant la fermeture de {time}.} other {# clients risquent de ne pas être pris avant la fermeture de {time}.}} » | Pluriel ICU                                                                                                                                                                                                            |
| `pro-manager.end_of_day.response.stay`             | « Reste »                                                                                                                                                                                                                                     | Libellé indicatif (APP_FLOW F-M12)                                                                                                                                                                                     |
| `pro-manager.end_of_day.response.cancel`           | « Annule »                                                                                                                                                                                                                                    | Libellé indicatif (APP_FLOW F-M12)                                                                                                                                                                                     |
| `pro-manager.end_of_day.response.none`             | « Sans réponse »                                                                                                                                                                                                                              | Libellé indicatif (APP_FLOW F-M12)                                                                                                                                                                                     |
| `pro-manager.end_of_day.close_now`                 | « Fermer la file maintenant »                                                                                                                                                                                                                 | Libellé indicatif (APP_FLOW F-M12)                                                                                                                                                                                     |
| `pro-manager.end_of_day.closing.title`             | « {count, plural, one {# client attend encore} other {# clients attendent encore}} »                                                                                                                                                          | APP_FLOW F-M12 ; pluriel ICU                                                                                                                                                                                           |
| `pro-manager.end_of_day.closing.body`              | « Décidez pour chaque client. Sans décision de votre part, ils seront annulés avec excuses à {time}. »                                                                                                                                        | `{time}` = fermeture + 15 min                                                                                                                                                                                          |
| `pro-manager.end_of_day.closing.serve_hint`        | « Servir : le client reste dans la file. S'il n'est pas pris avant la fin de la journée, il est annulé avec excuses. »                                                                                                                        | E24 (minuit, heure de Paris)                                                                                                                                                                                           |
| `pro-manager.end_of_day.closing.serve`             | « Servir »                                                                                                                                                                                                                                    | PRD §5.2                                                                                                                                                                                                               |
| `pro-manager.end_of_day.closing.cancel`            | « Annuler avec excuses »                                                                                                                                                                                                                      | PRD §5.2                                                                                                                                                                                                               |
| `pro-manager.end_of_day.closing.all`               | « Tous »                                                                                                                                                                                                                                      | Libellé indicatif (APP_FLOW F-M12)                                                                                                                                                                                     |
| `notifications.end_of_day_risk.push`               | Voir `notifications.end_of_day_risk.push.*` dans le dictionnaire (2 textes)                                                                                                                                                                   | PRD §5.2 ; boutons `notifications.end_of_day_risk.actions.*` « Je reste » et « J'annule » ; message d'anticipation (E17)                                                                                               |
| `notifications.end_of_day_risk.sms`                | « {salon_name} : vous risquez de ne pas être pris avant la fermeture. Vous restez ? Répondez : {link} »                                                                                                                                       | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (TRD §9, K5) ; lien de suivi pour répondre |
| `notifications.cancelled_by_salon.end_of_day.push` | Voir `notifications.cancelled_by_salon.end_of_day.push.*` dans le dictionnaire (2 textes)                                                                                                                                                     | Excuses et salons proches                                                                                                                                                                                              |
| `notifications.cancelled_by_salon.end_of_day.sms`  | « {salon_name} ferme et n'a pas pu vous prendre aujourd'hui. Toutes nos excuses. Salons proches : {link} »                                                                                                                                    | **SMS : 160 caractères GSM-7 maximum**, mêmes valeurs maximales (K5) ; excuses et salons proches ; hors plafond                                                                                                        |
| `errors.queue.closing_not_reached`                 | « Ce choix sera possible à l'heure de fermeture. »                                                                                                                                                                                            | TRD v0.5 §6.2                                                                                                                                                                                                          |
| `errors.queue.invalid_transition`                  | « Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. »                                                                                                                                                            | Partagée avec S-02, S-12, S-13                                                                                                                                                                                         |
| `errors.queue.forbidden`                           | « Cette action ne vous est pas autorisée. Si vous pensez que c'est une erreur, reconnectez-vous puis réessayez. »                                                                                                                             | Code commun (TRD §6.2)                                                                                                                                                                                                 |

## Questions ouvertes

- **Résolu le 18/10** (correction PRD H9) : la fenêtre de 2 h est une valeur par défaut, réglable par salon après le pilote ; elle n'est pas modifiable par le gérant pendant le pilote.
- **Résolu le 18/10** (E5, PRD H9 et §5.2) : la fin de journée s'applique à la dernière plage de la journée.
- **Résolu le 18/10** (E5, PRD §5.2) : à la fermeture, le gérant voit tous les clients restants, qu'ils aient répondu ou non ; « Je reste » ne vaut pas « Servir ».
- **Résolu le 18/10** (E5, PRD §5.2) : un client « servi » qui n'est pas pris avant la fin de la journée est annulé avec un message d'excuse.
- **Résolu le 19/10** (E24, PRD §5.2 ; TRD §6.1, BACKEND_SCHEMA §10) : un client « servi » non pris est annulé à minuit, heure de Paris, par `queue-tick`, motif `end_of_day`, avec un message d'excuse.
- **PRD** : qui sont les « clients restants » à la fermeture ? Seulement les tickets en attente, ou aussi les tickets appelés ? Un client appelé juste avant la fermeture garde-t-il ses 10 min ?
- **APP_FLOW** : un client qui n'est plus à risque (son heure redevient sûre) disparaît-il du bandeau ?
- **Résolu le 19/10** (TRD v0.5 §6.2) : `resolve_closing` avant l'heure de fermeture renvoie `queue.closing_not_reached`.
- **Résolu en partie le 19/10** (dictionnaire REQ-3) : le SMS porte un lien « Salons proches : {link} ». **Reste ouvert (APP_FLOW / TRD)** : vers quelle page mène ce lien (même question dans S-12) ?
- **Résolu le 19/10** (E17, PRD §5.1 et §5.4) : `cancelled_by_salon` est un message indispensable ; un client annulé à la fermeture, walk-in compris, est prévenu sans avoir coché la case. L'alerte de risque, elle, reste un message d'anticipation.
- **Résolu le 19/10** (E24, E19 ; PRD §5.1, §5.2) : les rendez-vous restants à la fermeture sont traités comme les autres clients restants (« Servir » ou « Annuler avec excuses ») ; un rendez-vous encore « à confirmer » est annulé avec excuses à la dernière fermeture, hors de la boîte de décision.
- **Résolu le 19/10** (E24, PRD §5.2) : une coupure de midi n'annule rien ; la file reprend à la plage suivante.
- **TRD / dictionnaire (nouveau)** : pour l'annulation de minuit (E24) et celle d'un rendez-vous à confirmer à la fermeture (E19), aucun document ne nomme le modèle de notification ; cette story suppose `cancelled_by_salon`, variante `end_of_day`, dont le texte dit « ferme et n'a pas pu vous prendre aujourd'hui ». Est-ce bien ce texte pour un rendez-vous jamais confirmé ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
