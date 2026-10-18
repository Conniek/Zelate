# U-13 · Gérer son compte

**En tant que** client connecté, **je veux** modifier mon prénom, gérer mon consentement aux notifications de suivi, télécharger mes données et supprimer mon compte, **afin de** garder la main sur ce que Zelaté sait de moi et sur les messages que je reçois.

- Priorité : I (PRD §5.3)
- Règles appliquées : H6 (numéro jamais affiché au salon) (PRD §5.1) ; case « Me prévenir » décochée par défaut, sans elle seulement l'inscription et « votre tour » (PRD §5.1 « Autres règles », §5.4, décision K11 PRD §11) ; consentements tracés, effacement après 12 mois à confirmer (PRD §6 « Données personnelles ») ; consentements distincts et horodatés, droits d'export et de suppression, suppression = anonymisation des tickets passés (TRD §8) ; ajout de U-13 (décision K12, PRD §11)
- Parcours : F-C11 (`/account`) ; route `/account` « Client connecté », arrivée depuis le menu (APP_FLOW §2.1) ; garde `/ticket` (APP_FLOW §2.3) ; états « Erreur réseau » (APP_FLOW §8)
- Commandes et données : aucune commande `queue-command` ; écriture directe de sa ligne `profiles` sous RLS (« L/É sa ligne (sauf `is_guest`) », BACKEND_SCHEMA §7.2) · tables `profiles` (`first_name`, `tracking_consent_at`, `marketing_consent_at`, `is_guest`), `tickets` (`client_id`, `display_name`, `removal_note`), `notifications` (`skip_reason` = `no_consent`), `push_subscriptions` (`profile_id`, on delete cascade), `auth.users` (`phone`), `private.ticket_contacts`, `private.no_show_records`

## Scénarios

### 1. Ouvrir mon compte
- **Étant donné** que je suis connecté
- **Quand** j'ouvre « Compte » depuis le menu
- **Alors** l'écran `/account` s'affiche avec mon prénom
- **Et** il affiche l'interrupteur « Notifications de suivi »
- **Et** il propose « Télécharger mes données », « Supprimer mon compte » et « Se déconnecter »

### 2. Modifier mon prénom
- **Étant donné** que mon prénom est « Awa »
- **Quand** je le remplace par « Awa-Marie » et que j'enregistre
- **Alors** mon prénom enregistré est « Awa-Marie » (`profiles.first_name`)
- **Et** l'écran affiche « Awa-Marie »

### 3. Prénom vide ou trop long
- **Étant donné** que je modifie mon prénom
- **Quand** je laisse le champ vide, ou que je saisis 31 caractères
- **Alors** l'enregistrement est refusé
- **Et** un message indique que le prénom doit faire de 1 à 30 caractères
- **Et** mon prénom enregistré ne change pas

### 4. Consentement affiché avec sa date
- **Étant donné** que j'ai coché « Me prévenir quand mon tour approche » le 12/11 à 14h05 en rejoignant une file
- **Quand** j'ouvre mon compte
- **Alors** l'interrupteur « Notifications de suivi » est activé
- **Et** la date de mon consentement est affichée (12/11, 14h05)

### 5. Retirer mon consentement
- **Étant donné** que l'interrupteur « Notifications de suivi » est activé et que j'ai un ticket actif
- **Quand** je le désactive
- **Alors** l'interrupteur s'affiche désactivé
- **Et** les notifications suivantes de mon ticket autres que l'inscription et « votre tour » ne partent plus (marquées `skipped`, motif `no_consent`)
- **Et** la notification « votre tour » part toujours quand le coiffeur m'appelle

### 6. Donner mon consentement depuis le compte
- **Étant donné** que l'interrupteur « Notifications de suivi » est désactivé
- **Quand** je l'active
- **Alors** la date et l'heure de mon consentement sont enregistrées (`profiles.tracking_consent_at`)
- **Et** cette date est affichée sous l'interrupteur

### 7. Interrupteur désactivé par défaut
- **Étant donné** que je n'ai jamais coché « Me prévenir »
- **Quand** j'ouvre mon compte
- **Alors** l'interrupteur « Notifications de suivi » est désactivé
- **Et** aucune date de consentement n'est affichée

### 8. Télécharger mes données
- **Étant donné** que j'ai eu deux tickets terminés et que j'ai donné mon consentement aux notifications de suivi
- **Quand** je touche « Télécharger mes données »
- **Alors** un fichier JSON est téléchargé sur mon appareil
- **Et** il contient mes deux tickets
- **Et** il contient mes consentements avec leur date

### 9. Le fichier exporté ne contient que mes données
- **Étant donné** qu'un autre client a eu un ticket dans le même salon le même jour
- **Quand** je télécharge mes données
- **Alors** le fichier ne contient aucun ticket, prénom ni consentement d'un autre client

### 10. Supprimer mon compte : confirmation en deux temps
- **Étant donné** que je suis sur mon compte
- **Quand** je touche « Supprimer mon compte »
- **Alors** une première confirmation s'affiche
- **Quand** je confirme
- **Alors** une seconde confirmation s'affiche
- **Et** mon compte n'est pas encore supprimé

### 11. Abandonner la suppression
- **Étant donné** qu'une des deux confirmations de suppression est affichée
- **Quand** je la ferme sans confirmer
- **Alors** mon compte n'est pas supprimé
- **Et** l'écran du compte reste affiché

### 12. Compte supprimé, tickets passés anonymisés
- **Étant donné** que j'ai eu des tickets terminés, annulés ou absents
- **Quand** je valide la seconde confirmation de suppression
- **Alors** mon compte est supprimé
- **Et** ma session prend fin
- **Et** mes tickets passés ne sont plus reliés à moi (`client_id` vide)
- **Et** mon prénom n'apparaît plus sur ces tickets (`display_name` vidé)
- **Et** la note de retrait éventuelle est effacée (`removal_note`)
- **Et** les horodatages et les durées de ces tickets restent enregistrés pour les statistiques
- **Et** mes abonnements push sont supprimés

### 13. Après la suppression, le salon ne retrouve rien de moi
- **Étant donné** que mon compte a été supprimé
- **Quand** le gérant d'un salon où j'ai eu un ticket consulte son récapitulatif ou son journal
- **Alors** il ne voit ni mon prénom ni mon numéro de téléphone

### 14. Se déconnecter
- **Étant donné** que je suis connecté
- **Quand** je touche « Se déconnecter »
- **Alors** ma session prend fin
- **Et** l'accueil (F-C1) s'affiche

### 15. Après la déconnexion, `/ticket` demande de se reconnecter
- **Étant donné** que je me suis déconnecté alors que j'avais un ticket actif
- **Quand** j'ouvre `/ticket`
- **Alors** je suis redirigé vers `/signin?next=/ticket`

### 16. Mon numéro n'est jamais montré au salon
- **Étant donné** que j'ai modifié mon prénom et que j'ai un ticket actif
- **Quand** le gérant consulte le dashboard et que mon coiffeur consulte sa file
- **Alors** ni l'un ni l'autre ne voit mon numéro de téléphone, ni sur l'écran ni dans les données reçues

### 17. Je ne modifie que mon propre compte
- **Étant donné** que je suis connecté
- **Quand** une écriture vise la ligne `profiles` d'un autre client
- **Alors** elle est refusée
- **Et** la ligne de l'autre client ne change pas

### 18. Je ne peux pas changer mon statut d'invité moi-même
- **Étant donné** que je suis connecté
- **Quand** une écriture vise ma colonne `is_guest`
- **Alors** elle est refusée

### 19. Erreur réseau pendant un export ou une suppression
- **Étant donné** que ma connexion est coupée
- **Quand** je touche « Télécharger mes données » ou que je valide la suppression
- **Alors** un message d'erreur s'affiche avec le bouton « Réessayer »
- **Et** mon compte n'est pas supprimé

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.account.title` | « Compte » (libellé indicatif APP_FLOW §2.1) | — |
| `client.account.first_name.label` | « Prénom » (libellé indicatif APP_FLOW F-C11) | 1 à 30 caractères |
| `client.account.first_name.save` | _À rédiger (absent des docs)_ | — |
| `errors.validation.first_name` | _À rédiger (absent des docs)_ | 1 à 30 caractères |
| `legal.consent.tracking_notifications.switch` | « Notifications de suivi » | Désactivé par défaut |
| `legal.consent.tracking_notifications.given_at` | _À rédiger (absent des docs)_ | Variable `date`, format fr-FR |
| `client.account.export` | « Télécharger mes données » | — |
| `client.account.delete.label` | « Supprimer mon compte » | — |
| `client.account.delete.confirm_first` | _À rédiger (absent des docs)_ | Première confirmation |
| `client.account.delete.confirm_second` | _À rédiger (absent des docs)_ | Seconde confirmation, bouton destructif à droite (`ConfirmDialog`) |
| `client.account.delete.done` | _À rédiger (absent des docs)_ | — |
| `client.account.sign_out` | « Se déconnecter » | — |
| `common.actions.retry` | « Réessayer » | APP_FLOW §8 |

## Questions ouvertes
- **TRD §6.1 / BACKEND_SCHEMA §8** : aucune Edge Function ni RPC ne réalise l'export et la suppression du compte. Faut-il ajouter par exemple `account-export` et `account-delete` (et leurs codes d'erreur) au TRD ?
- **TRD §8 / BACKEND_SCHEMA §4.13** : la suppression anonymise « les tickets passés ». Que devient un **ticket actif** au moment de la suppression : annulé (avec quel `cancel_reason` ?), suppression refusée tant qu'il est actif, ou ticket anonymisé laissé en file ?
- **BACKEND_SCHEMA §4.13** : la contrainte de clé étrangère `tickets.client_id → profiles(id)` ne précise pas son comportement à la suppression (alors que `profiles` est supprimé en cascade avec `auth.users`). Et `display_name` est `NN, ≤ 30` : l'anonymisation le « vide » (chaîne vide ?). Il faut préciser les deux.
- **TRD §8 / BACKEND_SCHEMA §5** : à la suppression du compte, faut-il effacer aussi les lignes `private.no_show_records` liées à mon numéro (purgées sinon après 30 jours) ? Faut-il journaliser la suppression (aucun type `ticket_event_type` ni `salon_event_type` ne la prévoit) ?
- **APP_FLOW F-C11 / TRD §8** : contenu exact du fichier JSON. Quelles colonnes des tickets (le `tracking_token` et le `tracking_short_code` sont des secrets, ADR-006) ? Les événements de mes tickets (`ticket_events`) et mon numéro de téléphone (`auth.users.phone`) en font-ils partie ? La note de retrait saisie par le gérant (`removal_note`) aussi ?
- **TRD §8 / BACKEND_SCHEMA §4.1** : « consentements distincts et horodatés » ; mais `profiles.tracking_consent_at` ne garde que la date du dernier accord. Quand je désactive l'interrupteur, la colonne est-elle vidée ? Où l'horodatage du retrait est-il gardé ?
- **APP_FLOW F-C3 / F-C12 / F-C11** : le consentement est porté par le profil, mais la case « Me prévenir » est proposée (décochée) à chaque inscription. Si j'ai déjà consenti et que je laisse la case décochée à la prochaine inscription, mon consentement est-il retiré ? Inversement, la case doit-elle être pré-remplie d'après mon compte ?
- **APP_FLOW F-C11 / BACKEND_SCHEMA §4.13** : changer mon prénom modifie-t-il `tickets.display_name` de mon ticket actif (donc ce que voit le salon), ou seulement les tickets suivants ?
- **APP_FLOW §2.3** : aucune garde n'est définie pour un client non connecté sur `/account` (la route est réservée au « Client connecté »). Faut-il rediriger vers `/signin?next=/account`, comme pour `/ticket` ?
- **APP_FLOW F-C11 / F-C9** : à la déconnexion, mon abonnement push reste-t-il actif pour mon ticket en cours ? Sinon, les messages repassent-ils en SMS ?
- **APP_FLOW F-C11** : quand un client invité (`is_guest = true`) cesse-t-il de l'être ? L'écran du compte doit-il le montrer ?
- **Textes** : le bouton d'enregistrement du prénom, le message de validation, la date du consentement, les deux confirmations de suppression et le message final ne figurent dans aucun document.
