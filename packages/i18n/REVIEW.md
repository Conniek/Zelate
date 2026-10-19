# Relecture du dictionnaire (REQ-3)

Brouillon du 18/10/2026 : 860 textes dans 7 fichiers. Chaque clé citée par une story existe. Les 12 SMS tiennent en 160 caractères GSM-7 avec les variables à leur longueur maximale (le plus long : 159). Le JSON est valide et chaque texte passe dans `intl-messageformat`.

## Pour Ely : textes à valider

| Quoi | Où | Pourquoi |
| --- | --- | --- |
| Tous les push, SMS et e-mails | `notifications.json` | Validation exigée par la porte 2 |
| Raisons d'un changement d'heure (17 phrases courtes, 48 caractères au plus pour tenir dans le push) | `common.change_reason.*` | Aucune liste n'existait ; toujours dire pourquoi |
| Contenu de l'affiche A4 du salon, dont « J'ai rendez-vous » | `pro-manager.qr.poster.*` | Proposition |
| Suggestions de prestations du wizard (une par spécialité) | `pro-manager.setup.services.*` | Aucune liste dans les documents |
| « Appelé » côté Pro, « C'est votre tour » côté client | `common.ticket_status.called`, `common.client_ticket_status.called` | Le design system et le PRD divergeaient |
| « Dashboard » ou « Tableau de bord » dans les textes affichés | `pro-manager` | Le design system demande d'éviter le jargon |

## Textes écrits avec une proposition encore ouverte

| Question | Textes concernés | Proposition retenue |
| --- | --- | --- |
| E17 consentement | `legal.consent.*`, `pro-manager.remove.client_notice`, `notifications.ticket_created.sms` | Lien pour activer « Me prévenir » ; le salon dit que le client est prévenu |
| E19 rendez-vous non confirmé | `client.ticket.appointment.pending*`, `pro-manager.appointments.pending.reminder` | Rappel au salon après 10 min ; annulé à la fermeture |
| E23 alerte de retard | `notifications.appointment_delay.*` | « venez vers {time} », une alerte par palier |
| E29 motif d'annulation d'un rendez-vous | `pro-manager.appointments.cancel_dialog.*`, `notifications.appointment_rejected.*` | Même liste de motifs que le retrait ; pas de motif dans le refus |
| E30 « en retard de X min » | `common.appointment.badge_late`, `pro-stylist.appointments.status.late` | Retard du salon |

## Pour Koni : choix techniques

Tranchés le 19/10 (K20, K26, K27) : adresse tronquée à 30 caractères dans les SMS, raisons d'un changement d'heure en une seule liste (`common.change_reason.*`), ligne `@zelate.fr #{code}` dans le SMS de connexion. Restent à fusionner au lot DEV-0 les doublons `client.qr.choice.*` / `client.qr_entry.*`, `client.home.next_free_slot` / `client.salon.free_slot`, `client.join.stylist.first_available` / `common.first_available`, et à déplacer les textes de `/signin` de Zelaté Pro dans un espace partagé.

## Accords

Les textes évitent les accords quand le genre est inconnu (« Je suis disponible », « Votre session a été fermée »). Restent au masculin : « Absent », « Arrivé », « Appelé » (statuts) et « être pris » (PRD).
