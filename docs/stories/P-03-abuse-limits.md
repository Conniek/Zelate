# P-03 · Limiter les abus

**En tant qu'**équipe plateforme, **je veux** limiter les abus (un ticket actif par numéro, plafonds de codes SMS par numéro et par IP, avertissement après 5 absences en 30 jours), **afin de** protéger les files des salons et maîtriser le coût des SMS.

- Priorité : S (PRD §5.3)
- Règles appliquées : un seul ticket actif à la fois, tous salons confondus ; absences répétées : avertissement seul après 5 absences en 30 jours ; chaque salon ne voit que ses propres données (PRD §5.1 « Autres règles ») ; H4 (absence après 10 min) et H6 (numéro jamais affiché) (PRD §5.1) ; décision n° 17 (PRD §11) ; risque « Fraude au trafic SMS » : plafonds par numéro, par IP et par pays, +33 uniquement (PRD §9)
- Parcours : F-C3 (étapes 4 et 5), F-M7 (inscription à l'accueil, message `already_has_active_ticket`), F-C7 (libération à 10 min) (APP_FLOW) ; événement « Libération » : compteur d'absences (APP_FLOW §7)
- Commandes et données : `join_queue`, `register_walk_in` (erreur `queue.already_has_active_ticket`, `queue.rate_limited`) · Edge Function `auth-send-sms` (plafonds de codes) · `queue-tick` (`called → no_show`) · tables `tickets` (index unique partiel « un ticket actif par client », `no_show_at`, `is_test`), `private.ticket_contacts` (`phone_hash`, `is_active`), `private.rate_limits`

## Scénarios

### 1. Un ticket actif par client, tous salons confondus
- **Étant donné** que j'ai un ticket actif au salon A
- **Quand** j'essaie de rejoindre la file du salon B
- **Alors** aucun ticket n'est créé au salon B
- **Et** l'erreur `queue.already_has_active_ticket` s'affiche avec « Voir ma place »

### 2. Un ticket actif par numéro, inscription à l'accueil comprise
- **Étant donné** qu'un numéro a déjà un ticket actif, créé depuis l'app ou à l'accueil d'un autre salon
- **Quand** un gérant inscrit ce même numéro à l'accueil de son salon
- **Alors** aucun ticket n'est créé
- **Et** le gérant voit le message `queue.already_has_active_ticket`
- **Et** le message ne révèle ni le numéro ni le salon où se trouve l'autre ticket

### 3. Nouveau ticket possible après la clôture du précédent
- **Étant donné** que mon dernier ticket est « Terminé », « Annulé » ou « Absent »
- **Quand** je rejoins une file
- **Alors** le ticket est créé

### 4. Les tickets de test ne bloquent pas
- **Étant donné** un ticket de test (`is_test`) créé pour le test d'un salon
- **Quand** un client réel rejoint une file
- **Alors** le ticket de test n'empêche la création d'aucun ticket

### 5. Plafond de codes SMS par numéro
- **Étant donné** que le plafond de codes de connexion pour un numéro est atteint
- **Quand** un nouveau code est demandé pour ce numéro, depuis n'importe quel appareil
- **Alors** aucun SMS n'est envoyé
- **Et** un message indique de réessayer plus tard

### 6. Plafond de codes SMS par IP
- **Étant donné** que le plafond de codes de connexion pour une adresse IP est atteint
- **Quand** un code est demandé depuis cette adresse IP pour un autre numéro
- **Alors** aucun SMS n'est envoyé
- **Et** un message indique de réessayer plus tard

### 7. Numéros hors +33 refusés
- **Étant donné** un numéro qui n'est pas un numéro +33
- **Quand** un code de connexion est demandé pour ce numéro
- **Alors** la demande est refusée
- **Et** aucun SMS n'est envoyé

### 8. Une absence est comptée à la libération automatique
- **Étant donné** que j'ai été appelé et que mon arrivée n'est pas validée
- **Quand** 10 min se sont écoulées depuis l'appel
- **Alors** mon ticket passe au statut « Absent »
- **Et** mon compteur d'absences augmente de 1

### 9. Une annulation ne compte pas comme absence
- **Étant donné** que mon ticket est « En attente »
- **Quand** je l'annule
- **Alors** mon compteur d'absences ne change pas

### 10. Avertissement à la 5e absence en 30 jours
- **Étant donné** que j'ai 4 absences dans les 30 derniers jours
- **Quand** une 5e absence est enregistrée
- **Alors** un avertissement est émis (destinataire et canal à préciser, voir questions ouvertes)
- **Et** je peux toujours rejoindre une file : aucun blocage n'est appliqué

### 11. Pas d'avertissement en dessous du seuil
- **Étant donné** que j'ai 3 absences dans les 30 derniers jours
- **Quand** une 4e absence est enregistrée
- **Alors** aucun avertissement n'est émis

### 12. Absences hors de la fenêtre de 30 jours
- **Étant donné** que j'ai 5 absences, dont la plus ancienne date de 31 jours
- **Quand** l'avertissement est évalué
- **Alors** seules 4 absences comptent dans les 30 derniers jours
- **Et** aucun avertissement n'est émis

### 13. Confidentialité de l'avertissement
- **Étant donné** qu'un client a atteint 5 absences en 30 jours
- **Quand** le gérant ou un coiffeur consulte la file
- **Alors** il ne voit pas le numéro de téléphone du client
- **Et** il ne voit aucune donnée d'absence venant d'un autre salon

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `errors.queue.already_has_active_ticket` | _À rédiger (absent des docs)_ | Partagé avec U-04 ; ne révèle ni numéro ni autre salon |
| `errors.queue.rate_limited` | _À rédiger (absent des docs)_ | Partagé avec U-03, U-04 |
| `errors.auth.phone_not_supported` | _À rédiger (absent des docs)_ | Partagé avec U-03 |
| `client.abuse.no_show_warning` | _À rédiger (absent des docs)_ | Destinataire et canal à préciser ; SMS : 160 caractères GSM-7 au plus si c'est un SMS |

## Questions ouvertes
- **PRD §5.1 / PRD §11 décision 17** : « avertissement seul après 5 absences en 30 jours ». Qui reçoit l'avertissement (le client, le gérant, l'admin) ? Par quel canal, à quel moment, avec quel texte ? Les absences se comptent-elles par salon ou tous salons confondus ?
- **BACKEND_SCHEMA** : aucune colonne ni table ne stocke le compteur d'absences ou l'avertissement. Faut-il les calculer à partir de `tickets.no_show_at` ? APP_FLOW §7 affiche un « compteur d'absences » sur le dashboard : que voit exactement le gérant ?
- **BACKEND_SCHEMA §5** : un client inscrit à l'accueil n'a pas de `client_id`, et `private.ticket_contacts` (seul lien avec son numéro) est supprimé 24 h après la clôture du ticket. Ses absences ne peuvent donc pas être comptées sur 30 jours. Faut-il les compter, et comment ?
- **PRD P-03 / TRD §7** : le PRD ne chiffre pas les plafonds de codes SMS. TRD §7 indique 5 par heure et par numéro, 20 par heure et par IP. Faut-il reporter ces valeurs dans le PRD et les utiliser pour les tests ? La « fenêtre » d'une heure est-elle glissante ou fixe ?
- **BACKEND_SCHEMA §5** : `private.rate_limits` prévoit aussi un plafond de « création de tickets », absent du PRD. Quelle valeur ? Est-ce bien `queue.rate_limited` qui est renvoyé ?
- **TRD §6.1** : quel code d'erreur `auth-send-sms` renvoie-t-il quand un plafond est atteint (voir U-03) ?
- **PRD §5.1 « isolation par salon »** : pour un walk-in déjà inscrit ailleurs, le message `already_has_active_ticket` affiché au gérant peut-il dire que le numéro a une place dans un autre salon ? Le scénario 2 suppose qu'il ne doit pas le dire.
- **PRD §5.3** : P-03 est classée « S », alors que la règle « un seul ticket actif » est validée (PRD §5.1), garantie par un index du schéma et exigée par U-04 (I). Seuls les plafonds et l'avertissement seraient-ils « S » ?
