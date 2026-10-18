# U-12 · Choisir quand mon coiffeur demandé devient indisponible

**En tant que** client qui a demandé un coiffeur, **je veux** choisir « attendre » ou « premier disponible » quand ce coiffeur devient indisponible, **afin de** garder la main sur mon heure de passage.

- Priorité : I (PRD §5.3)
- Règles appliquées : H1 (coiffeur demandé en option) (PRD §5.1) ; changer le coiffeur d'un client ne le fait jamais reculer, sauf accord du client (PRD §5.1 « Autres règles ») ; transition 8 et statuts du coiffeur « En retard », « Absent », « Fin de journée » (PRD §5.2) ; décision n° 15 : sans réponse en 10 min, premier disponible si le coiffeur est absent toute la journée, sinon le client attend (PRD §11) ; notification « Choix de coiffeur » (push, SMS si pas de push dans la limite du plafond) (PRD §5.4)
- Parcours : F-C5 (bandeau « Votre coiffeur n'est plus disponible ») et F-C10 (APP_FLOW §3) ; déclenché par F-S3 (« Fin de journée »), F-M4 (« Désactiver ») et F-M8 (absence, retard, départ anticipé) ; événement « Choix demandé » (APP_FLOW §7)
- Commandes et données : `resolve_stylist_change` (`ticket_id`, `choice` = `wait` | `first_available`) · déclencheurs `set_presence` (`absent`, `late`, `off_duty`) et désactivation du membre · `queue-tick` (délai de 10 min) · tables `tickets` (`requested_member_id`, `stylist_change_pending_since`, `estimated_start_at`, `queue_rank`), `stylist_presence` (`status`, `expected_back_at`, `shift_end_at`), `ticket_events` (`stylist_change_requested`, `stylist_change_resolved`), `notifications` (`stylist_change_required`)

## Scénarios

### 1. Coiffeur demandé déclaré en retard
- **Étant donné** que mon ticket demande Léa et que le gérant la déclare en retard, avec une heure d'arrivée prévue
- **Quand** la déclaration est confirmée
- **Alors** je reçois une notification push « Choix de coiffeur »
- **Et** si je n'ai pas de push actif, je la reçois par SMS, dans la limite de 3 SMS par ticket
- **Et** ma page de suivi affiche le bandeau « Votre coiffeur n'est plus disponible » avec « Attendre Léa » et sa nouvelle heure, et « Premier disponible » et son heure
- **Et** le dashboard marque mon ticket « en attente de réponse »
- **Et** un événement `stylist_change_requested` est ajouté au journal

### 2. Choisir « Premier disponible »
- **Étant donné** que le bandeau de choix est affiché
- **Quand** je touche « Premier disponible »
- **Alors** mon ticket ne demande plus Léa et sera pris par le premier coiffeur qui se libère et maîtrise ma prestation
- **Et** mon rang d'inscription ne change pas
- **Et** ma nouvelle heure de passage est affichée
- **Et** un événement `stylist_change_resolved` est ajouté au journal
- **Et** le dashboard ne marque plus mon ticket « en attente de réponse »

### 3. Choisir « Attendre »
- **Étant donné** que le bandeau de choix est affiché et que Léa est en retard
- **Quand** je touche « Attendre Léa »
- **Alors** mon ticket demande toujours Léa
- **Et** mon heure de passage est calculée à partir de son heure d'arrivée prévue
- **Et** un événement `stylist_change_resolved` est ajouté au journal

### 4. Sans réponse en 10 min, coiffeur absent toute la journée
- **Étant donné** que Léa est déclarée absente pour la journée et que je n'ai pas répondu au choix
- **Quand** 10 min se sont écoulées depuis la demande de choix
- **Alors** mon ticket passe automatiquement en « Premier disponible »
- **Et** mon rang d'inscription ne change pas
- **Et** un événement `stylist_change_resolved` est ajouté au journal

### 5. Sans réponse en 10 min, coiffeur en retard ou partant plus tôt
- **Étant donné** que Léa est déclarée en retard (ou partant plus tôt) et que je n'ai pas répondu au choix
- **Quand** 10 min se sont écoulées depuis la demande de choix
- **Alors** mon ticket demande toujours Léa

### 6. Réponse juste avant l'échéance
- **Étant donné** que la demande de choix date de 9 min et que Léa est absente pour la journée
- **Quand** je touche « Attendre Léa »
- **Alors** mon choix est enregistré
- **Et** le passage automatique en « Premier disponible » ne s'applique pas à mon ticket

### 7. Coiffeur qui part plus tôt
- **Étant donné** que Léa déclare sa fin de journée à 17h00 et que plusieurs tickets la demandent
- **Quand** la fin de journée est confirmée
- **Alors** seuls les tickets qui la demandent et dépasseraient 17h00 reçoivent le choix
- **Et** les tickets qui la demandent et seraient servis avant 17h00 ne reçoivent pas de choix

### 8. Coiffeur désactivé
- **Étant donné** que mon ticket demande Léa
- **Quand** le gérant désactive le compte de Léa (départ du salon)
- **Alors** je reçois la demande de choix « attendre » ou « premier disponible »

### 9. Pause : pas de choix demandé
- **Étant donné** que mon ticket demande Léa
- **Quand** Léa se met en pause
- **Alors** aucun choix de coiffeur ne m'est demandé
- **Et** si mon heure bouge de 10 min ou plus, je reçois seulement la notification de changement d'heure (U-10)

### 10. Tickets sans préférence redistribués sans choix
- **Étant donné** un ticket « Premier disponible » dont le coiffeur pressenti est Léa
- **Quand** Léa est déclarée absente
- **Alors** le ticket est redistribué automatiquement
- **Et** aucun choix n'est demandé à ce client

### 11. Choix depuis le lien SMS
- **Étant donné** que je suis mon ticket par `/t/:trackingToken`, sans session
- **Quand** je touche « Premier disponible » dans le bandeau
- **Alors** mon choix est enregistré comme depuis l'app

### 12. Erreur `queue.invalid_transition`
- **Étant donné** qu'aucun choix n'est en attente pour mon ticket (déjà répondu, échéance passée) ou que mon ticket est clos
- **Quand** une commande `resolve_stylist_change` est envoyée
- **Alors** elle est refusée et le ticket n'est pas modifié
- **Et** le message d'erreur `queue.invalid_transition` s'affiche

### 13. Plafond SMS atteint sans push
- **Étant donné** que je n'ai pas de push actif et que 3 SMS ont déjà été envoyés pour mon ticket
- **Quand** le choix de coiffeur m'est demandé
- **Alors** aucun SMS n'est envoyé (marqué `skipped`, motif `sms_cap_reached`)
- **Et** le bandeau de choix s'affiche à l'ouverture de ma page de suivi

### 14. Confidentialité côté salon
- **Étant donné** que mon ticket est marqué « en attente de réponse »
- **Quand** le gérant consulte le dashboard
- **Alors** il voit mon prénom et l'état « en attente de réponse »
- **Et** il ne voit pas mon numéro de téléphone

### 15. Le SMS de choix tient en un seul SMS
- **Étant donné** le modèle de SMS « Choix de coiffeur »
- **Quand** il est rempli avec un prénom de coiffeur et un lien de suivi de longueur maximale
- **Alors** le texte fait 160 caractères GSM-7 au plus

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.ticket.stylist_change.banner` | « Votre coiffeur n'est plus disponible » | — |
| `client.ticket.stylist_change.wait` | « Attendre {firstName} » | Nouvelle heure affichée à côté |
| `client.ticket.stylist_change.first_available` | « Premier disponible » | Heure affichée à côté |
| `notifications.stylist_change_required.push` | _À rédiger (absent des docs)_ | Choix « attendre » ou « premier disponible » |
| `notifications.stylist_change_required.sms` | _À rédiger (absent des docs)_ | SMS : 160 caractères GSM-7 au plus ; dans le plafond de 3 SMS |
| `pro-manager.board.ticket.awaiting_client_answer` | « en attente de réponse » | Dashboard |

## Questions ouvertes
- **PRD §5.2 transition 8 / APP_FLOW F-C5** : « Attendre *Prénom* » est-il proposé quand le coiffeur est absent toute la journée ou désactivé, alors qu'il ne viendra pas ? Si oui, que devient le ticket d'un client qui a choisi d'attendre ?
- **PRD §11 décision 15 / APP_FLOW F-M4** : un coiffeur désactivé compte-t-il comme « absent toute la journée » pour la règle des 10 min ?
- **BACKEND_SCHEMA §4.13 / PRD §11** : le schéma appelle la règle des 10 min sans réponse « règle proposée, à valider en PLN-1 », alors que le PRD l'a validée (décision n° 15). Il faut mettre le schéma à jour.
- **PRD §5.2** : si je choisis « Premier disponible » et qu'aucun autre coiffeur présent ne maîtrise ma prestation, que se passe-t-il (file complète pour moi, retour au choix) ?
- **PRD §5.2** : si j'ai choisi « Attendre » un coiffeur en retard et qu'il est ensuite déclaré absent pour la journée, un nouveau choix m'est-il demandé ?
- **PRD §5.2 / APP_FLOW F-C5** : faut-il afficher sur le bandeau le temps restant avant l'échéance des 10 min ?
- **Textes** : la notification et le SMS « Choix de coiffeur » ne figurent dans aucun document.
