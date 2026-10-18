# U-02 · Consulter la fiche d'un salon

**En tant que** client, **je veux** consulter la fiche d'un salon (photos, horaires, prestations et prix, coiffeurs, attente), **afin de** décider si je rejoins sa file.

- Priorité : I (PRD §5.3)
- Règles appliquées : états de la file du salon (PRD §5.2 : Fermée, Ouverte, En pause, Complète) ; H1 (une file unique par salon) ; fiche salon chargée en moins de 2 s (PRD §6)
- Parcours : F-C2 (APP_FLOW §3) ; depuis F-C1 ou un lien partagé ; vers F-C3 (rejoindre) et F-C1 (salons proches, fermeture du panneau)
- Commandes et données : RPC `get_salon_public(slug)` · vues `public_salons`, `public_stylists` · tables `services`, `opening_hours`, `salon_closures`, `specialties`, `member_specialties` · Storage `salon-photos`, `member-photos`

## Scénarios

### 1. Fiche d'un salon à la file ouverte
- **Étant donné** un salon publié dont la file est ouverte et non complète
- **Quand** j'ouvre sa fiche depuis la liste, la carte ou l'adresse `/salons/:slug`
- **Alors** je vois ses photos
- **Et** je vois l'attente actuelle : le nombre de personnes avant moi, l'heure de passage estimée et la fraîcheur de l'information
- **Et** je vois les horaires de la journée et je peux déplier la semaine
- **Et** je vois la liste des prestations avec nom, durée et prix
- **Et** je vois les coiffeurs avec prénom, photo, spécialités et l'indication « disponible » ou « en prestation »
- **Et** je vois le message d'accueil du salon s'il en a un
- **Et** le bouton « Rejoindre la file » est actif

### 2. Rejoindre la file depuis la fiche
- **Étant donné** que la fiche d'un salon ouvert et non complet est affichée
- **Quand** je touche « Rejoindre la file »
- **Alors** l'étape 1 du parcours « Rejoindre la file » s'ouvre (F-C3)

### 3. Galerie de photos
- **Étant donné** que le salon a des photos (6 au maximum)
- **Quand** je touche une photo de la galerie défilante
- **Alors** elle s'affiche en plein écran
- **Quand** j'appuie sur Échap ou que je touche « Fermer »
- **Alors** le plein écran se ferme et la fiche réapparaît

### 4. Horaires sur plusieurs plages
- **Étant donné** que le salon a plusieurs plages d'ouverture certains jours
- **Quand** je déplie les horaires
- **Alors** chaque jour de la semaine affiche toutes ses plages

### 5. Données des coiffeurs limitées au prénom
- **Étant donné** que le salon a des coiffeurs actifs qui coiffent aujourd'hui
- **Quand** la section « Coiffeurs » s'affiche
- **Alors** chaque coiffeur est présenté par son prénom, sa photo et ses spécialités
- **Et** aucun nom de famille ni adresse e-mail de coiffeur n'est affiché

### 6. Itinéraire
- **Étant donné** que la fiche est affichée sur un smartphone
- **Quand** je touche « Itinéraire »
- **Alors** l'application de cartes de l'appareil s'ouvre sur l'adresse du salon

### 7. File fermée
- **Étant donné** un salon publié dont la file est fermée
- **Quand** j'ouvre sa fiche
- **Alors** le bouton est désactivé et affiche « Fermé » suivi de la prochaine ouverture (exemple : « Fermé · ouvre demain à 9h00 »)

### 8. File en pause
- **Étant donné** un salon publié dont la file est en pause
- **Quand** j'ouvre sa fiche
- **Alors** le bouton est désactivé et affiche « File en pause, réessayez dans quelques minutes »

### 9. File complète
- **Étant donné** un salon dont la prochaine prestation finirait après la fermeture (file complète)
- **Quand** j'ouvre sa fiche
- **Alors** le bouton est désactivé et affiche « Complet pour aujourd'hui »
- **Et** un lien « Salons proches » est affiché
- **Quand** je touche « Salons proches »
- **Alors** l'accueil des salons s'ouvre (F-C1)

### 10. Fermer le panneau sur mobile
- **Étant donné** que la fiche est ouverte en panneau sur mobile
- **Quand** je glisse le panneau vers le bas ou que je touche « Fermer »
- **Alors** le panneau se ferme et l'accueil réapparaît (F-C1)

### 11. Temps de chargement
- **Étant donné** un smartphone connecté
- **Quand** j'ouvre la fiche d'un salon
- **Alors** la fiche est chargée en moins de 2 s

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.salon.wait.people_ahead` | _À rédiger_ (APP_FLOW, indicatif : « Personnes avant vous ») | Pluriel ICU |
| `client.salon.wait.estimated_time` | _À rédiger (absent des docs)_ | Variable `time` |
| `client.salon.hours.title` | « Horaires » | — |
| `client.salon.services.title` | « Prestations » | — |
| `client.salon.stylists.title` | « Coiffeurs » | — |
| `client.salon.stylist.status.available` | « disponible » | — |
| `client.salon.stylist.status.busy` | « en prestation » | — |
| `client.salon.stylist.status.away` | _À rédiger (voir questions)_ | — |
| `common.actions.directions` | « Itinéraire » | Partagé avec U-06 |
| `common.actions.close` | « Fermer » | — |
| `client.salon.join` | « Rejoindre la file » | — |
| `common.queue.closed_with_next_opening` | « Fermé · ouvre {day} à {time} » | Partagé avec U-01 |
| `client.salon.join_disabled.paused` | « File en pause, réessayez dans quelques minutes » | — |
| `client.salon.join_disabled.full` | « Complet pour aujourd'hui » | — |
| `client.nearby_salons.link` | « Salons proches » | Partagé avec U-04, U-11 |

## Questions ouvertes
- **APP_FLOW F-C2 / BACKEND_SCHEMA §6** : la vue `public_stylists` a trois statuts simplifiés (`available`, `busy`, `away`), alors que la fiche n'affiche que « disponible » ou « en prestation ». Qu'affiche-t-on pour `away` (pause, en retard) ? Le coiffeur est-il masqué ?
- **PRD S-08 / TRD §6.4** : S-08 exige qu'un changement d'état de la file soit visible côté client en moins de 2 s. Or le canal `salon:{salon_id}` est réservé à l'équipe du salon et le canal `ticket:{ticket_id}` au propriétaire du ticket. Comment une fiche ouverte (sans ticket) se met-elle à jour : en temps réel, toutes les 30 s, ou seulement au rechargement ?
- **APP_FLOW F-C2** : qu'affiche `/salons/:slug` pour un slug inconnu ou pour un salon qui n'est pas (ou plus) publié ?
- **APP_FLOW F-C2 / BACKEND_SCHEMA §4.8** : un jour de fermeture exceptionnelle, la fiche affiche-t-elle le motif (`salon_closures.reason`) en plus de la prochaine ouverture ?
- **APP_FLOW F-C2** : « Personnes avant vous » et l'heure de passage portent-elles sur un nouveau client « premier disponible » (`current_wait_minutes`) ? L'heure est-elle arrondie aux 5 min supérieures ?
- **Textes** : l'heure de passage estimée et le libellé du statut `away` ne figurent dans aucun document.
