# S-14 · Récapitulatif de fin de journée

**En tant que** gérant, **je veux** recevoir un récapitulatif de la journée par e-mail et le retrouver sur le dashboard, **afin de** savoir combien de clients ont été servis, si l'attente annoncée était juste et combien de clients ont été perdus.

- Priorité : S (PRD §5.3)
- Règles appliquées : H6 (aucun numéro de téléphone) ; isolation par salon (PRD §5.1) ; tickets de test exclus des statistiques (BACKEND_SCHEMA §4.13) ; métriques PRD §8 calculées à partir de `tickets` et `ticket_events`
- Parcours : F-M11 `/dashboard/summary`
- Commandes et données : `salon-daily-summary` (tâche planifiée toutes les 15 min, salons fermés depuis le dernier passage, K37) · RPC `get_day_summary` · tables `tickets`, `ticket_events`, `notifications` (`daily_summary`, canal `email`, `recipient_member_id`, `dedupe_key` = `daily_summary:<date>`, index unique `(salon_id, channel, dedupe_key)` sans ticket, K37)

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

### 2 bis. Un seul e-mail par salon et par jour

- **Étant donné** un salon dont le récapitulatif du jour est déjà parti
- **Quand** la tâche `salon-daily-summary` repasse 15 min plus tard, ou que deux envois tournent en même temps
- **Alors** aucun second e-mail n'est envoyé pour ce salon et cette date (clé `daily_summary:<date>`, K37)

### 2 ter. Le récapitulatif n'est pas soumis aux règles des clients

- **Étant donné** un récapitulatif adressé au gérant (`recipient_member_id` renseigné)
- **Quand** `send-notifications` l'envoie
- **Alors** ni le consentement « Me prévenir » ni le plafond de SMS ne s'appliquent (BACKEND_SCHEMA §4.16, K37)

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

| Clé (anglais)                               | Texte (français)                                                                                                                                                                                                                                                                                                                                                                  | Contrainte                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `pro-manager.summary.title`                 | « Récapitulatif du jour »                                                                                                                                                                                                                                                                                                                                                         | Page `/dashboard/summary`     |
| `pro-manager.summary.served`                | « {count, plural, =0 {Aucun client servi} one {# client servi} other {# clients servis}} »                                                                                                                                                                                                                                                                                        | Pluriel ICU                   |
| `pro-manager.summary.announced_wait`        | « Attente annoncée : ~{minutes} min »                                                                                                                                                                                                                                                                                                                                             | Minutes                       |
| `pro-manager.summary.actual_wait`           | « Attente réelle : ~{minutes} min »                                                                                                                                                                                                                                                                                                                                               | Minutes                       |
| `pro-manager.summary.no_shows`              | « {count, plural, =0 {Aucune absence} one {# absence} other {# absences}} »                                                                                                                                                                                                                                                                                                       | Pluriel ICU                   |
| `pro-manager.summary.cancellations`         | « {count, plural, =0 {Aucune annulation} one {# annulation} other {# annulations}} »                                                                                                                                                                                                                                                                                              | Pluriel ICU                   |
| `notifications.daily_summary.email.subject` | « Récapitulatif de votre journée du {date} »                                                                                                                                                                                                                                                                                                                                      | E-mail                        |
| `notifications.daily_summary.email.body`    | « Bonjour {first_name}, ↵ ↵ Voici la journée du {date} chez {salon_name}. ↵ ↵ Clients servis : {served_count} ↵ Attente annoncée : {announced_wait_minutes} min en moyenne ↵ Attente réelle : {actual_wait_minutes} min en moyenne ↵ Absences : {no_show_count} ↵ Annulations : {cancellation_count} ↵ ↵ Le détail est sur votre tableau de bord : ↵ {link} ↵ ↵ L'équipe Zelaté » | Mêmes indicateurs que la page |

## Questions ouvertes

- **Résolu en partie le 19/10** (K37, TRD v0.5 §6.1, BACKEND_SCHEMA §10) : les deux documents disent maintenant « toutes les 15 min, pour les salons fermés depuis le dernier passage ». **Reste ouvert (TRD / BACKEND_SCHEMA)** : que veut dire « fermé » ? Est-ce à l'heure de la dernière fermeture des horaires (E5), au passage de la file à `closed`, après l'annulation automatique 15 min après la fermeture, ou quand le dernier client servi a terminé ? Des clients « servis » après la fermeture (S-15) peuvent encore être en prestation, et ceux qui ne sont pas pris sont annulés seulement à minuit, heure de Paris (E24) : le récapitulatif les compte-t-il ?
- **PRD / APP_FLOW (rendez-vous)** : le récapitulatif distingue-t-il les rendez-vous des clients de dernière minute (clients servis, retard moyen sur l'heure du rendez-vous) ? Les rendez-vous refusés (`appointment_rejected`) et les rendez-vous annulés par le salon comptent-ils dans les annulations ?
- **PRD** : comment calcule-t-on « attente annoncée et réelle » ? Moyenne par ticket, ou écart ? Annoncée à l'inscription ou à T-30 ? Le récapitulatif doit-il montrer l'indicateur principal du pilote (80 % des tickets à ±10 min de l'heure annoncée à T-30) ?
- **PRD** : les annulations sont-elles détaillées par motif (client, salon, fin de journée) ?
- **PRD** : faut-il envoyer un e-mail les jours sans aucun ticket, ou les jours où la file n'a pas ouvert ?
- **APP_FLOW** : `/dashboard/summary` montre-t-il seulement aujourd'hui, ou aussi les jours passés ?
- **APP_FLOW** : le récapitulatif montre-t-il des prénoms de clients, ou seulement des chiffres ? Et les chiffres par coiffeur (`get_day_summary` accepte `member_id`) ?
- **Résolu le 19/10** (K37, BACKEND_SCHEMA §4.16) : index unique `(salon_id, channel, dedupe_key)` pour les lignes sans ticket, clé `daily_summary:<date>` ; un seul e-mail par salon et par jour.
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
