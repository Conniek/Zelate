# S-12 · Retirer un ticket de la file

**En tant que** gérant, **je veux** retirer un ticket de la file en cas d'urgence, avec un motif obligatoire envoyé au client, **afin de** gérer une situation exceptionnelle sans laisser le client sans explication.

- Priorité : I (PRD §5.3)
- Règles appliquées : retrait de la file strictement encadré et toujours justifié au client (PRD §5.1, décisions d'Ely) ; PRD §5.2 transition 6 (En attente ou Appelé → Annulé, par le gérant avec motif) ; PRD §5.4 « Annulation par le salon » (push et SMS, hors plafond) ; aucun prénom ni texte libre dans le journal (TRD §7, K10) ; H6 (messages envoyés par la plateforme)
- Parcours : F-M9 ; F-M6 (clic sur un ticket) ; écran de fin côté client F-C5
- Commandes et données : `remove_ticket` (`ticket_id`, `reason_code`, `note?` ≤ 200, K10) · tables `tickets` (`status` = `cancelled`, `cancel_reason` = `removed_by_salon`, `removal_reason`, `removal_note`, `cancelled_at`), `ticket_events` (`cancelled`, `reason_code`, `actor_type` = `manager`), `notifications` (`cancelled_by_salon`, canaux `push` et `sms`)

## Scénarios

### 1. Retirer un ticket en attente
- **Étant donné** un ticket en attente, et le gérant qui a ouvert son panneau détail
- **Quand** il clique sur « Retirer de la file », choisit un motif dans la liste, ajoute une précision et clique sur « Retirer »
- **Alors** la commande `remove_ticket` est envoyée avec `reason_code` et `note`
- **Alors** le ticket passe au statut `cancelled` avec le motif `removed_by_salon`
- **Alors** le motif choisi est enregistré dans `removal_reason` et la précision dans `tickets.removal_note`
- **Alors** le ticket quitte la file et les clients suivants avancent
- **Alors** le client reçoit une notification push et un SMS avec le motif, des excuses et des salons proches
- **Alors** la page de suivi du client affiche l'écran de fin avec la raison
- **Alors** l'événement `cancelled` est inscrit au journal du ticket, avec le gérant et le motif (`reason_code`)
- **Alors** la précision n'est pas copiée dans le journal (TRD §6.2 et §7, K10)

### 1 bis. Précision effacée à l'anonymisation
- **Étant donné** un ticket retiré avec une précision, il y a plus de 12 mois
- **Quand** la tâche quotidienne de maintenance anonymise les tickets
- **Alors** `removal_note` est vidée (BACKEND_SCHEMA §10)
- **Alors** l'événement `cancelled` du journal reste inchangé

### 2. Retirer un ticket appelé
- **Étant donné** un ticket au statut « appelé », compteur de 10 min en cours
- **Quand** le gérant le retire avec un motif
- **Alors** le ticket passe au statut `cancelled`
- **Alors** le coiffeur qui l'avait appelé voit le ticket disparaître de son appel en cours

### 3. Motif obligatoire
- **Étant donné** le formulaire de retrait ouvert
- **Quand** aucun motif n'est choisi dans la liste
- **Alors** le bouton « Retirer » est inactif

### 4. Liste des motifs
- **Étant donné** le formulaire de retrait ouvert
- **Quand** le gérant ouvre la liste des motifs
- **Alors** il voit exactement 5 motifs : urgence, demande du client, doublon, comportement inapproprié, autre (`removal_reason`)

### 5. Précision facultative trop longue
- **Étant donné** le formulaire de retrait avec un motif choisi
- **Quand** la précision dépasse 200 caractères
- **Alors** le retrait est refusé avec un message sous le champ
- **Alors** une commande `remove_ticket` envoyée avec une `note` de plus de 200 caractères est refusée avec l'erreur `queue.invalid_payload` (TRD §6.2, codes communs)

### 6. Retrait sans précision
- **Étant donné** le formulaire de retrait avec un motif choisi et une précision vide
- **Quand** le gérant clique sur « Retirer »
- **Alors** le ticket est retiré

### 7. SMS envoyé même au-delà du plafond
- **Étant donné** un ticket qui a déjà reçu 3 SMS
- **Quand** le gérant le retire
- **Alors** le SMS d'annulation par le salon est quand même envoyé (hors plafond, PRD §5.4)

### 8. Ticket en prestation, terminé ou déjà annulé
- **Étant donné** un ticket en prestation, terminé, annulé ou absent
- **Quand** une commande `remove_ticket` est envoyée pour ce ticket
- **Alors** le message de l'erreur `queue.invalid_transition` s'affiche
- **Alors** le ticket ne change pas

### 9. Aucun numéro de téléphone (confidentialité)
- **Étant donné** le panneau détail et le formulaire de retrait ouverts
- **Quand** le gérant les consulte
- **Alors** aucun numéro de téléphone du client n'est affiché

### 10. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** une commande `remove_ticket` est envoyée pour un ticket du salon B
- **Alors** la commande est refusée avec l'erreur `queue.ticket_other_salon` (TRD §6.2)
- **Alors** le ticket ne change pas

### 11. Seul le gérant retire un ticket
- **Étant donné** un coiffeur connecté
- **Quand** une commande `remove_ticket` est envoyée depuis son compte
- **Alors** la commande est refusée avec l'erreur `queue.forbidden` (TRD §6.2, codes communs)

### 12. Double clic sur « Retirer »
- **Étant donné** le formulaire de retrait rempli
- **Quand** le gérant clique deux fois rapidement sur « Retirer »
- **Alors** un seul SMS et une seule notification push partent

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.ticket_panel.remove` | « Retirer de la file » | Libellé indicatif (APP_FLOW F-M9) |
| `pro-manager.remove.reason.emergency` | — (à rédiger) | Valeur `emergency` |
| `pro-manager.remove.reason.client_request` | — (à rédiger) | Valeur `client_request` |
| `pro-manager.remove.reason.duplicate` | — (à rédiger) | Valeur `duplicate` |
| `pro-manager.remove.reason.inappropriate_behaviour` | — (à rédiger) | Valeur `inappropriate_behaviour` |
| `pro-manager.remove.reason.other` | — (à rédiger) | Valeur `other` |
| `pro-manager.remove.note` | — (à rédiger) | Précision facultative, 200 caractères maximum |
| `pro-manager.remove.submit` | « Retirer » | Libellé indicatif (APP_FLOW F-M9) |
| `notifications.cancelled_by_salon.push` | — (à rédiger) | Motif, excuses, salons proches |
| `notifications.cancelled_by_salon.sms` | — (à rédiger) | **SMS : 160 caractères GSM-7 maximum** avec les valeurs les plus longues : prénom ≤ 30, nom du salon tronqué à 40, accents translittérés, lien court `zelate.fr/t/xxxxxxxx` (TRD §9, K5) ; motif, excuses, salons proches ; hors plafond |
| `notifications.cancelled_by_salon.reason.<removal_reason>` | — (à rédiger) | Motif tel que le client le lit, un par valeur |
| `errors.queue.invalid_transition` | — (à rédiger) | Partagée avec S-02 |
| `errors.queue.ticket_other_salon` | — (à rédiger) | TRD §6.2 ; ne nomme pas l'autre salon |
| `errors.queue.forbidden` | — (à rédiger) | Code commun (TRD §6.2) |
| `errors.queue.invalid_payload` | — (à rédiger) | Code commun (TRD §6.2) |
| `errors.validation.removal_note_length` | — (à rédiger) | 200 caractères maximum |

## Questions ouvertes
- **Résolu le 18/10** (K10, TRD §6.2 et §7) : `remove_ticket` prend `note?` (200 caractères au plus), rangée dans `tickets.removal_note` ; le journal ne garde que le motif structuré (`reason_code`), jamais de texte libre.
- **Résolu le 18/10** (K1, TRD §6.2) : un coiffeur reçoit `queue.forbidden` ; un gérant qui vise le ticket d'un autre salon reçoit `queue.ticket_other_salon`.
- **PRD** : comment chaque motif est-il formulé pour le client ? Par exemple, le motif « comportement inapproprié » lui est-il envoyé tel quel ?
- **PRD** : la précision (`removal_note`) écrite par le gérant est-elle envoyée au client, ou reste-t-elle interne au salon ? Si elle reste interne, qui la lit, puisqu'elle n'est pas dans le journal ?
- **PRD / APP_FLOW** : le motif « autre » oblige-t-il à remplir la précision ?
- **APP_FLOW / TRD** : comment des « salons proches » tiennent-ils dans un SMS de 160 caractères ? Faut-il un lien, et vers quelle page ? (K5 fixe les longueurs, pas ce contenu.)
- **PRD (consentement, K11)** : sans la case « Me prévenir », seuls l'inscription et « votre tour » partent ; `cancelled_by_salon` passe en `skipped` (BACKEND_SCHEMA §4.16). Or le retrait doit être « toujours justifié au client » (PRD §5.1, décisions d'Ely) et l'annulation par le salon « part toujours » (PRD §5.4). Un client retiré sans avoir coché la case est-il prévenu ?
- **PRD / TRD (rendez-vous)** : pour retirer un rendez-vous, le gérant utilise-t-il `remove_ticket` (motif obligatoire, F-M9) ou `cancel_appointment` (sans motif, F-M13) ? Le panneau ticket d'un rendez-vous propose-t-il « Retirer de la file » ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
