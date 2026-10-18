# U-08 · Annuler ma place

**En tant que** client inscrit dans une file, **je veux** annuler ma place sans pénalité, **afin de** libérer la place pour les suivants si je ne viens plus.

- Priorité : I (PRD §5.3)
- Règles appliquées : le client annule sans pénalité, même une fois appelé ; ce n'est pas compté comme une absence (E3, PRD §5.1 « Autres règles », décision n° 10, PRD §11) ; transition 6 « En attente ou Appelé → Annulé » (PRD §5.2) ; un seul ticket actif (PRD §5.1)
- Parcours : F-C8, depuis F-C5 (`/ticket`, y compris l'écran « C'est votre tour ! ») ou F-C10 (`/t/:shortCode`) (APP_FLOW §3)
- Commandes et données : `cancel_ticket` (`ticket_id` ; code `queue.already_resolved` et codes communs, TRD §6.2) · tables `tickets` (`status`, `cancelled_at`, `cancel_reason` = `client_cancelled`), `ticket_events` (`cancelled`), `private.ticket_contacts` (`is_active`, `closed_at`), `private.no_show_records` (inchangée)

## Scénarios

### 1. Annuler un ticket en attente
- **Étant donné** que mon ticket est « En attente »
- **Quand** je touche « Annuler ma place »
- **Alors** une boîte de confirmation s'ouvre avec le texte « Votre place sera donnée au suivant »
- **Quand** je touche « Oui, annuler »
- **Alors** mon ticket passe au statut « Annulé » avec le motif `client_cancelled`
- **Et** un événement `cancelled` est ajouté au journal du ticket
- **Et** l'écran de fin s'affiche avec « Rejoindre une autre file »
- **Et** mon ticket disparaît de l'espace coiffeur et passe en annulé sur le dashboard

### 2. Garder ma place
- **Étant donné** que la boîte de confirmation d'annulation est ouverte
- **Quand** je touche « Garder ma place »
- **Alors** la boîte se ferme
- **Et** mon ticket reste « En attente », au même rang

### 3. Les suivants avancent
- **Étant donné** que d'autres clients sont inscrits après moi
- **Quand** j'annule ma place
- **Alors** les heures de passage des tickets suivants sont recalculées
- **Et** les clients dont l'heure change de 10 min ou plus reçoivent la notification de changement d'heure (voir U-10)

### 4. Sans pénalité
- **Étant donné** que mon ticket est « En attente »
- **Quand** je l'annule
- **Alors** aucune absence n'est enregistrée pour mon numéro (`private.no_show_records` inchangée)
- **Et** je peux tout de suite rejoindre une autre file sans recevoir l'erreur `queue.already_has_active_ticket`

### 4 bis. Annuler une fois appelé, sans pénalité (E3)
- **Étant donné** que le coiffeur m'a appelé (statut « Appelé ») et que l'écran « C'est votre tour ! » est affiché
- **Quand** je touche « Annuler ma place » puis « Oui, annuler »
- **Alors** mon ticket passe au statut « Annulé » avec le motif `client_cancelled`, et non « Absent »
- **Et** aucune absence n'est enregistrée pour mon numéro (`private.no_show_records` inchangée)
- **Et** la libération automatique à 10 min ne s'applique plus à mon ticket
- **Et** mon ticket disparaît de l'espace coiffeur et passe en annulé sur le dashboard

### 5. Annuler depuis le lien SMS
- **Étant donné** que je suis mon ticket par `/t/:shortCode`, sans session
- **Quand** je touche « Annuler ma place » puis « Oui, annuler »
- **Alors** mon ticket passe au statut « Annulé » avec le motif `client_cancelled`
- **Et** l'écran de fin s'affiche

### 6. Erreur `queue.invalid_transition` pendant la prestation
- **Étant donné** que ma prestation a commencé (statut « En prestation »)
- **Quand** une commande `cancel_ticket` est envoyée pour mon ticket
- **Alors** l'annulation est refusée
- **Et** le ticket reste « En prestation »
- **Et** le message d'erreur `queue.invalid_transition` s'affiche

### 7. Erreur `queue.already_resolved` sur un ticket déjà annulé
- **Étant donné** que mon ticket a déjà été annulé (depuis un autre appareil, par le lien SMS ou par le salon)
- **Quand** j'essaie de l'annuler depuis une page restée ouverte
- **Alors** l'annulation est refusée et le ticket n'est pas modifié
- **Et** le message d'erreur `queue.already_resolved` s'affiche

### 7 bis. Ticket « Terminé » ou « Absent »
- **Étant donné** que mon ticket est déjà « Terminé » ou « Absent »
- **Quand** j'essaie de l'annuler depuis une page restée ouverte
- **Alors** l'annulation est refusée et le ticket n'est pas modifié
- **Et** un message d'erreur s'affiche (`queue.already_resolved` ou `queue.invalid_transition` : voir questions ouvertes)

### 8. Double appui sur « Oui, annuler »
- **Étant donné** que la boîte de confirmation est ouverte
- **Quand** je touche deux fois de suite « Oui, annuler »
- **Alors** un seul événement `cancelled` est ajouté au journal

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.ticket.actions.cancel` | « Annuler ma place » | Partagé avec U-06 |
| `client.cancel_dialog.body` | « Votre place sera donnée au suivant » | — |
| `client.cancel_dialog.confirm` | « Oui, annuler » | — |
| `client.cancel_dialog.keep` | « Garder ma place » | — |
| `client.ticket.end.reason.client_cancelled` | Vous avez annulé votre place. Elle a été donnée au client suivant. | — |
| `client.ticket.end.rejoin` | « Rejoindre une autre file » | Partagé avec U-06 |
| `errors.queue.invalid_transition` | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. | Partagé avec U-07, U-11, U-12 |
| `errors.queue.already_resolved` | Une décision a déjà été enregistrée à ce sujet. Vérifiez l'état affiché à l'écran. | Partagé avec U-11, U-12 |

## Questions ouvertes
- **Résolu le 18/10** (E3) — Annuler une fois appelé : annulation libre, sans absence comptée, bouton proposé aussi une fois appelé (APP_FLOW F-C8) ; voir scénario 4 bis.
- **TRD §6.2** : pour `cancel_ticket`, le code propre `already_resolved` couvre-t-il tout ticket clos (« Terminé », « Absent ») ou seulement un ticket déjà annulé, les autres renvoyant le code commun `invalid_transition` ? Voir scénarios 6, 7 et 7 bis.
- **PRD §5.4** : aucune notification n'est prévue quand le client annule lui-même. Faut-il une confirmation (push ou SMS), ou l'écran de fin suffit-il ?
- **Textes** : la raison affichée sur l'écran de fin et le message d'erreur ne figurent dans aucun document.
