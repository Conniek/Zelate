# U-13 · Gérer son compte

**En tant que** client connecté, **je veux** modifier mon prénom, gérer mon consentement aux notifications de suivi, télécharger mes données et supprimer mon compte, **afin de** garder la main sur ce que Zelaté sait de moi et sur les messages que je reçois.

- Priorité : I (PRD §5.3)
- Règles appliquées : H6 (numéro jamais affiché au salon) (PRD §5.1) ; case « Me prévenir » décochée par défaut ; elle ne règle que les messages d'anticipation, les messages indispensables partent toujours (PRD §5.1 « Autres règles », §5.4, E17, remplace K11) ; consentement porté par la place en cours (K18), modifié par `set_notifications_consent` (K34) ; export et suppression depuis `/account` (K17) ; anonymisation : `display_name` = « Client », `client_id` à `null` (K29) ; consentements tracés, effacement après 12 mois à confirmer (PRD §6 « Données personnelles ») ; consentements distincts et horodatés, droits d'export et de suppression, suppression = anonymisation des tickets passés (TRD §8) ; ajout de U-13 (décision K12, PRD §11)
- Parcours : F-C11 (`/account`) ; route `/account` « Client connecté », arrivée depuis le menu (APP_FLOW §2.1) ; garde `/ticket` (APP_FLOW §2.3) ; états « Erreur réseau » (APP_FLOW §8)
- Commandes et données : `set_notifications_consent` (`ticket_id`, `consent` ; codes communs, `invalid_transition` si le ticket n'est plus actif, K34) · Edge Functions `account-export` (GET) et `account-delete` (POST, code `account.delete_failed`, K17) · écriture directe de sa ligne `profiles` limitée à `first_name` et `last_name` (`grant update`, K32 ; consentements et `is_guest` : serveur) · tables `profiles` (`first_name`, `tracking_consent_at` pour information, `marketing_consent_at`, `is_guest`), `tickets` (`notifications_consent_at`, `client_id` en `on delete set null`, `display_name`, `removal_note`), `notifications` (`skip_reason` = `no_consent`), `push_subscriptions` (`profile_id`, on delete cascade), `auth.users` (`phone`), `private.ticket_contacts`, `private.no_show_records`

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
- **Étant donné** que j'ai coché « Me prévenir quand mon tour approche » le 12/11 à 14h05 en rejoignant une file, et que cette place est toujours en cours
- **Quand** j'ouvre mon compte
- **Alors** l'interrupteur « Notifications de suivi » de ma place en cours est activé
- **Et** la date de mon consentement est affichée (12/11, 14h05), lue sur le ticket (`tickets.notifications_consent_at`, K18)

### 5. Retirer mon consentement
- **Étant donné** que l'interrupteur « Notifications de suivi » est activé et que j'ai un ticket actif
- **Quand** je le désactive
- **Alors** la commande `set_notifications_consent` part avec `consent` faux pour ma place en cours (K34)
- **Et** `tickets.notifications_consent_at` est vidé
- **Et** l'interrupteur s'affiche désactivé
- **Et** les messages d'anticipation suivants de mon ticket (votre tour approche, préparez-vous, changement d'heure, fin de journée) ne partent plus (marqués `skipped`, motif `no_consent`)
- **Et** les messages indispensables partent toujours : « votre tour », rappel, place libérée, annulation, choix de coiffeur, demande de réaffectation… (E17)

### 6. Donner mon consentement depuis le compte
- **Étant donné** que l'interrupteur « Notifications de suivi » de ma place en cours est désactivé
- **Quand** je l'active
- **Alors** la commande `set_notifications_consent` part avec `consent` vrai (K34)
- **Et** la date et l'heure de mon consentement sont enregistrées sur le ticket (`tickets.notifications_consent_at`, K18)
- **Et** elles sont recopiées sur mon profil pour information (`profiles.tracking_consent_at`)
- **Et** cette date est affichée sous l'interrupteur

### 6 bis. Place close entre-temps : `queue.invalid_transition`
- **Étant donné** que mon compte est ouvert et que ma place vient d'être terminée ou annulée
- **Quand** je touche l'interrupteur
- **Alors** la commande `set_notifications_consent` est refusée avec `queue.invalid_transition` (jamais `queue.already_resolved`, K34)
- **Et** le ticket n'est pas modifié

### 7. Interrupteur désactivé par défaut
- **Étant donné** que je n'ai pas coché « Me prévenir » pour ma place en cours
- **Quand** j'ouvre mon compte
- **Alors** l'interrupteur « Notifications de suivi » est désactivé
- **Et** aucune date de consentement n'est affichée

### 7 bis. Sans place en cours (K18)
- **Étant donné** que je n'ai aucun ticket actif, même si j'avais consenti pour un ticket précédent
- **Quand** j'ouvre mon compte
- **Alors** aucun interrupteur de place en cours n'est actionnable
- **Et** un rappel indique que la case « Me prévenir » sera proposée, décochée, à ma prochaine inscription (APP_FLOW F-C11 ; texte manquant, voir questions ouvertes)

### 8. Télécharger mes données
- **Étant donné** que j'ai eu deux tickets terminés et que j'ai donné mon consentement aux notifications de suivi
- **Quand** je touche « Télécharger mes données »
- **Alors** un fichier JSON est téléchargé sur mon appareil (`account-export`, K17)
- **Et** il contient mes deux tickets
- **Et** il contient mes consentements avec leur date
- **Et** il contient les événements visibles de mes tickets
- **Et** il ne contient ni `tracking_token` ni `tracking_short_code`

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
- **Alors** mon compte est supprimé, profil et compte Auth compris (`account-delete`, K17)
- **Et** ma session prend fin
- **Et** le message « Votre compte a été supprimé. Merci d'avoir utilisé Zelaté. » s'affiche
- **Et** mes tickets passés ne sont plus reliés à moi (`client_id` mis à `null`, K29)
- **Et** mon prénom est remplacé par « Client » sur ces tickets (`display_name`, K29)
- **Et** la note de retrait éventuelle est effacée (`removal_note`)
- **Et** les horodatages et les durées de ces tickets restent enregistrés pour les statistiques
- **Et** le journal (`ticket_events`) n'est pas modifié : il ne contient ni prénom ni texte libre (K10, K29)
- **Et** mes abonnements push sont supprimés

### 12 bis. Suppression avec une place en cours
- **Étant donné** que j'ai un ticket actif
- **Quand** je valide la seconde confirmation de suppression
- **Alors** mon ticket actif est annulé (motif : voir questions ouvertes), comme l'annonce la première confirmation
- **Et** les clients suivants avancent
- **Et** mon compte est ensuite supprimé comme au scénario 12

### 12 ter. Échec de la suppression : `account.delete_failed`
- **Étant donné** que la suppression ne peut pas aboutir côté serveur
- **Quand** je valide la seconde confirmation
- **Alors** le message `errors.account.delete_failed` s'affiche
- **Et** mon compte et mes données restent inchangés

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
- **Quand** une écriture directe vise ma colonne `is_guest`, `tracking_consent_at` ou `email`
- **Alors** elle est refusée : seules `first_name` et `last_name` me sont ouvertes en écriture (K32)

### 19. Erreur réseau pendant un export ou une suppression
- **Étant donné** que ma connexion est coupée
- **Quand** je touche « Télécharger mes données » ou que je valide la suppression
- **Alors** un message d'erreur s'affiche avec le bouton « Réessayer »
- **Et** mon compte n'est pas supprimé

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.account.title` | Compte | — |
| `client.account.first_name.label` | Prénom | 1 à 30 caractères |
| `client.account.first_name.save` | Enregistrer | — |
| `client.account.first_name.saved` | Prénom enregistré | Après enregistrement |
| `client.account.delete.continue` | Continuer | Première confirmation |
| `client.account.delete.keep` | Garder mon compte | Abandon |
| `client.account.delete.confirm` | Oui, supprimer mon compte | Seconde confirmation |
| `errors.account.delete_failed` | La suppression de votre compte n'a pas abouti. Réessayez dans quelques minutes. | `account-delete` |
| `errors.queue.invalid_transition` | Cette action n'est pas possible à ce stade. Vérifiez l'état affiché à l'écran. | `set_notifications_consent` sur un ticket clos |
| `errors.validation.first_name` | Indiquez un prénom de 30 caractères au plus. | 1 à 30 caractères |
| `legal.consent.tracking_notifications.switch` | « Notifications de suivi » | Désactivé par défaut |
| `legal.consent.tracking_notifications.given_at` | Accordé le {date, date, long} | Variable `date`, format fr-FR |
| `client.account.export` | « Télécharger mes données » | — |
| `client.account.delete.label` | « Supprimer mon compte » | — |
| `client.account.delete.confirm_first` | Supprimer votre compte ? Votre prénom et vos consentements seront effacés, et vos anciens passages ne seront plus reliés à vous. Une place en cours sera annulée. | Première confirmation |
| `client.account.delete.confirm_second` | Cette suppression est définitive. Voulez-vous vraiment supprimer votre compte ? | Seconde confirmation, bouton destructif à droite (`ConfirmDialog`) |
| `client.account.delete.done` | Votre compte a été supprimé. Merci d'avoir utilisé Zelaté. | — |
| `client.account.sign_out` | « Se déconnecter » | — |
| `common.actions.retry` | « Réessayer » | APP_FLOW §8 |

## Questions ouvertes
- **Résolu le 19/10** (K17) — Export et suppression : Edge Functions `account-export` et `account-delete` (code `account.delete_failed`) ; voir scénarios 8, 12 et 12 ter.
- **Résolu en partie le 19/10** (K17, TRD §6.1) — Ticket actif à la suppression : il est annulé par `account-delete` (module `queue-transaction`, K38) ; voir scénario 12 bis. Reste ouvert (TRD §6.1 / BACKEND_SCHEMA §3) : quel `cancel_reason` (aucune valeur de l'enum ne vise ce cas ; `client_cancelled` ?) et le salon est-il prévenu autrement que par la disparition du ticket ?
- **Résolu le 19/10** (K29) — `tickets.client_id` en `on delete set null` ; `display_name` remplacé par « Client » ; voir scénario 12.
- **TRD §8 / BACKEND_SCHEMA §5** : à la suppression du compte, faut-il effacer aussi les lignes `private.no_show_records` liées à mon numéro (purgées sinon après 30 jours) ? Faut-il journaliser la suppression (aucun type `ticket_event_type` ni `salon_event_type` ne la prévoit) ?
- **Résolu en partie le 19/10** (K17) — Contenu du fichier : tickets, consentements et événements visibles, sans jeton ni donnée d'autres personnes ; voir scénarios 8 et 9. Reste ouvert (TRD §6.1) : mon numéro de téléphone et la note de retrait saisie par le gérant (`removal_note`) en font-ils partie ?
- **Résolu en partie le 19/10** (K18, K34) — Le consentement est porté par le ticket ; `set_notifications_consent(false)` vide `tickets.notifications_consent_at` ; `profiles.tracking_consent_at` n'est qu'une information. Reste ouvert (TRD §8, « consentements tracés ») : où l'horodatage d'un retrait est-il conservé ?
- **Résolu le 19/10** (K18) — Case « Me prévenir » décochée à chaque inscription, jamais pré-remplie d'après le compte ; le consentement d'un ticket ne vaut pas pour le suivant ; voir scénario 7 bis.
- **APP_FLOW F-C11 / BACKEND_SCHEMA §4.13** : changer mon prénom modifie-t-il `tickets.display_name` de mon ticket actif (donc ce que voit le salon), ou seulement les tickets suivants ?
- **APP_FLOW §2.3** : aucune garde n'est définie pour un client non connecté sur `/account` (la route est réservée au « Client connecté »). Faut-il rediriger vers `/signin?next=/account`, comme pour `/ticket` ?
- **APP_FLOW F-C11 / F-C9** : à la déconnexion, mon abonnement push reste-t-il actif pour mon ticket en cours ? Sinon, les messages repassent-ils en SMS ?
- **APP_FLOW F-C11** : quand un client invité (`is_guest = true`) cesse-t-il de l'être ? L'écran du compte doit-il le montrer ?
- **Résolu le 19/10** (dictionnaire `client.json`, `legal.json`, `errors.json`) — Bouton et confirmation du prénom, date du consentement, confirmations de suppression et message final rédigés.
- **Dictionnaire** : aucun texte pour le rappel affiché sans place en cours (« la case sera proposée, décochée, à la prochaine inscription », APP_FLOW F-C11) ; voir scénario 7 bis.
