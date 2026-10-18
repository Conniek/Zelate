# S-15 · Gérer la fin de journée

**En tant que** gérant, **je veux** voir, à partir de 2 h avant la fermeture, les clients qui risquent de ne pas être pris, puis décider à la fermeture de « Servir » ou d'« Annuler avec excuses » les clients restants, **afin de** finir la journée à l'heure sans laisser de client sans réponse.

- Priorité : I (PRD §5.3)
- Règles appliquées : H9 ; PRD §5.2 Fin de journée (fenêtre à partir de 2 h avant la dernière fermeture de la journée, valeur par défaut réglable par salon après le pilote ; alerte unique, « Je reste » ou « J'annule » ; à la fermeture, le gérant voit tous les clients restants ; annulation automatique 15 min après la fermeture ; un client « servi » qui n'est pas pris avant la fin de la journée est annulé avec excuses ; aucun ticket ne passe d'un jour à l'autre) ; PRD §11 n° 19 et E5 ; nouveaux horaires du jour pris en compte (E16) ; PRD §5.4 (« Risque de fin de journée » : SMS dans la limite du plafond ; « Annulation par le salon » : push et SMS hors plafond ; sans « Me prévenir », seuls l'inscription et « votre tour » partent, K11) ; H6
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
- **Alors** aucune alerte ne lui est envoyée (notification `skipped`, `no_consent` ; BACKEND_SCHEMA §4.16, K11)
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

### 8 bis. Client « servi » qui n'est pas pris avant la fin de la journée
- **Étant donné** Léa, que le gérant a choisi de « Servir », toujours en attente
- **Quand** la journée se termine sans qu'un coiffeur l'ait appelée
- **Alors** son ticket est annulé (PRD §5.2, E5 ; TRD §6.2 `resolve_closing`)
- **Alors** Léa reçoit un message d'excuse
- **Alors** son ticket n'est pas actif le lendemain

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
- **Alors** le client reçoit une notification push et un SMS, même au-delà du plafond, avec un message d'excuse et des salons proches

### 13. Décision après l'annulation automatique
- **Étant donné** un ticket déjà annulé automatiquement 15 min après la fermeture
- **Quand** une commande `resolve_closing` est envoyée pour ce ticket
- **Alors** le message de l'erreur `queue.invalid_transition` s'affiche
- **Alors** le ticket reste annulé

### 14. Décision avant l'heure de fermeture
- **Étant donné** une file avant son heure de fermeture
- **Quand** une commande `resolve_closing` est envoyée
- **Alors** la commande est refusée (TRD §6.2 : « après l'heure de fermeture » ; code à préciser, voir les questions ouvertes)

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
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.end_of_day.banner.title` | « Fin de journée » | Libellé indicatif (APP_FLOW F-M12) |
| `pro-manager.end_of_day.response.stay` | « reste » | Libellé indicatif (APP_FLOW F-M12) |
| `pro-manager.end_of_day.response.cancel` | « annule » | Libellé indicatif (APP_FLOW F-M12) |
| `pro-manager.end_of_day.response.none` | « sans réponse » | Libellé indicatif (APP_FLOW F-M12) |
| `pro-manager.end_of_day.close_now` | « Fermer la file maintenant » | Libellé indicatif (APP_FLOW F-M12) |
| `pro-manager.end_of_day.closing.title` | « {count} clients attendent encore » | APP_FLOW F-M12 ; pluriel ICU |
| `pro-manager.end_of_day.closing.serve` | « Servir » | PRD §5.2 |
| `pro-manager.end_of_day.closing.cancel` | « Annuler avec excuses » | PRD §5.2 |
| `pro-manager.end_of_day.closing.all` | « Tous » | Libellé indicatif (APP_FLOW F-M12) |
| `notifications.end_of_day_risk.push` | « Vous risquez de ne pas être pris avant la fermeture » | PRD §5.2 ; boutons « Je reste » et « J'annule » |
| `notifications.end_of_day_risk.sms` | — (à rédiger, à partir de « Vous risquez de ne pas être pris avant la fermeture ») | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (TRD §9, K5) ; lien de suivi pour répondre |
| `notifications.cancelled_by_salon.end_of_day.push` | — (à rédiger) | Excuses et salons proches |
| `notifications.cancelled_by_salon.end_of_day.sms` | — (à rédiger) | **SMS : 160 caractères GSM-7 maximum**, mêmes valeurs maximales (K5) ; excuses et salons proches ; hors plafond |
| `errors.queue.invalid_transition` | — (à rédiger) | Partagée avec S-02, S-12, S-13 |
| `errors.queue.forbidden` | — (à rédiger) | Code commun (TRD §6.2) |

## Questions ouvertes
- **Résolu le 18/10** (correction PRD H9) : la fenêtre de 2 h est une valeur par défaut, réglable par salon après le pilote ; elle n'est pas modifiable par le gérant pendant le pilote.
- **Résolu le 18/10** (E5, PRD H9 et §5.2) : la fin de journée s'applique à la dernière plage de la journée.
- **Résolu le 18/10** (E5, PRD §5.2) : à la fermeture, le gérant voit tous les clients restants, qu'ils aient répondu ou non ; « Je reste » ne vaut pas « Servir ».
- **Résolu le 18/10** (E5, PRD §5.2) : un client « servi » qui n'est pas pris avant la fin de la journée est annulé avec un message d'excuse.
- **PRD / TRD** : à quelle heure exacte la « fin de la journée » annule-t-elle les clients « servis » non pris : minuit heure de Paris (journée de service, ADR-010) ? Par quelle tâche (`queue-tick`), avec quel motif (`end_of_day` ?) et quelle notification (`cancelled_by_salon` ?) ? `queue-tick` (TRD §6.1, BACKEND_SCHEMA §10) ne mentionne pas cette annulation.
- **PRD** : qui sont les « clients restants » à la fermeture ? Seulement les tickets en attente, ou aussi les tickets appelés ? Un client appelé juste avant la fermeture garde-t-il ses 10 min ?
- **APP_FLOW** : un client qui n'est plus à risque (son heure redevient sûre) disparaît-il du bandeau ?
- **TRD** : TRD §6.2 ne donne aucun code propre à `resolve_closing`. Quel code renvoie la commande envoyée avant l'heure de fermeture : `invalid_transition` ?
- **APP_FLOW / TRD** : comment des « salons proches » tiennent-ils dans un SMS de 160 caractères ? (Même question dans S-12 ; K5 fixe les longueurs, pas ce contenu.)
- **PRD (consentement, K11)** : sans « Me prévenir », `cancelled_by_salon` passe en `skipped` (BACKEND_SCHEMA §4.16). Un client annulé à la fermeture sans avoir coché la case n'est donc pas prévenu, alors que PRD §5.4 dit que l'annulation par le salon « part toujours ». Laquelle des deux règles l'emporte ? Même question pour un walk-in, qui ne peut pas cocher la case (S-10).
- **PRD (rendez-vous)** : les documents ne disent rien de particulier sur les rendez-vous en fin de journée. Un client avec rendez-vous reçoit-il l'alerte de fin de journée comme les autres ? Un rendez-vous encore « à confirmer » (`pending_confirmation`, hors calcul) à l'heure de fermeture figure-t-il dans la boîte de décision, ou est-il refusé ? Le gérant peut-il « Annuler avec excuses » un rendez-vous confirmé ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
