# S-14 · Récapitulatif de fin de journée

**En tant que** gérant, **je veux** recevoir un récapitulatif de la journée par e-mail et le retrouver sur le dashboard, **afin de** savoir combien de clients ont été servis, si l'attente annoncée était juste et combien de clients ont été perdus.

- Priorité : S (PRD §5.3)
- Règles appliquées : H6 (aucun numéro de téléphone) ; isolation par salon (PRD §5.1) ; tickets de test exclus des statistiques (BACKEND_SCHEMA §4.13) ; métriques PRD §8 calculées à partir de `tickets` et `ticket_events`
- Parcours : F-M11 `/dashboard/summary`
- Commandes et données : `salon-daily-summary` (tâche planifiée) · RPC `get_day_summary` · tables `tickets`, `ticket_events`, `notifications` (`daily_summary`, canal `email`, `recipient_member_id`)

## Scénarios

### 1. Consulter le récapitulatif sur le dashboard
- **Étant donné** un salon qui a servi des clients aujourd'hui
- **Quand** le gérant ouvre `/dashboard/summary`
- **Alors** il voit le nombre de clients servis
- **Alors** il voit l'attente annoncée et l'attente réelle
- **Alors** il voit le nombre d'absences
- **Alors** il voit le nombre d'annulations

### 2. Recevoir le récapitulatif par e-mail
- **Étant donné** un salon dont la journée vient de se terminer
- **Quand** la tâche `salon-daily-summary` traite ce salon
- **Alors** un e-mail de récapitulatif est envoyé au gérant
- **Alors** l'e-mail contient les mêmes indicateurs que la page `/dashboard/summary`

### 3. Tickets de test exclus
- **Étant donné** une journée avec un ticket de test terminé (`is_test`)
- **Quand** le récapitulatif est calculé
- **Alors** le ticket de test n'est compté dans aucun indicateur

### 4. Aucun numéro de téléphone (confidentialité)
- **Étant donné** un récapitulatif sur le dashboard et par e-mail
- **Quand** le gérant le consulte
- **Alors** aucun numéro de téléphone de client n'y figure

### 5. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** il appelle `get_day_summary` avec l'identifiant du salon B
- **Alors** la lecture est refusée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.summary.title` | — (à rédiger) | Page `/dashboard/summary` |
| `pro-manager.summary.served` | — (à rédiger) | Pluriel ICU |
| `pro-manager.summary.announced_wait` | — (à rédiger) | Minutes |
| `pro-manager.summary.actual_wait` | — (à rédiger) | Minutes |
| `pro-manager.summary.no_shows` | — (à rédiger) | Pluriel ICU |
| `pro-manager.summary.cancellations` | — (à rédiger) | Pluriel ICU |
| `notifications.daily_summary.email.subject` | — (à rédiger) | E-mail |
| `notifications.daily_summary.email.body` | — (à rédiger) | Mêmes indicateurs que la page |

## Questions ouvertes
- **TRD / BACKEND_SCHEMA** : quand la journée est-elle « terminée » ? TRD §6.1 dit « à la fermeture », BACKEND_SCHEMA §10 dit « salons fermés depuis le dernier passage » (passage toutes les 15 min). Est-ce à l'heure de la dernière fermeture des horaires (E5), au passage de la file à `closed`, après l'annulation automatique 15 min après la fermeture, ou quand le dernier client servi a terminé ? Des clients « servis » après la fermeture (S-15) peuvent encore être en prestation, et ceux qui ne sont pas pris sont annulés seulement à la fin de la journée (E5).
- **PRD / APP_FLOW (rendez-vous)** : le récapitulatif distingue-t-il les rendez-vous des clients de dernière minute (clients servis, retard moyen sur l'heure du rendez-vous) ? Les rendez-vous refusés (`appointment_rejected`) et les rendez-vous annulés par le salon comptent-ils dans les annulations ?
- **PRD** : comment calcule-t-on « attente annoncée et réelle » ? Moyenne par ticket, ou écart ? Annoncée à l'inscription ou à T-30 ? Le récapitulatif doit-il montrer l'indicateur principal du pilote (80 % des tickets à ±10 min de l'heure annoncée à T-30) ?
- **PRD** : les annulations sont-elles détaillées par motif (client, salon, fin de journée) ?
- **PRD** : faut-il envoyer un e-mail les jours sans aucun ticket, ou les jours où la file n'a pas ouvert ?
- **APP_FLOW** : `/dashboard/summary` montre-t-il seulement aujourd'hui, ou aussi les jours passés ?
- **APP_FLOW** : le récapitulatif montre-t-il des prénoms de clients, ou seulement des chiffres ? Et les chiffres par coiffeur (`get_day_summary` accepte `member_id`) ?
- **BACKEND_SCHEMA** : l'e-mail n'a pas de `ticket_id`, donc la contrainte d'unicité `unique (ticket_id, channel, dedupe_key)` ne l'empêche pas d'être envoyé deux fois. Qu'est-ce qui garantit un seul e-mail par salon et par jour ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
