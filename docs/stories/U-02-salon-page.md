# U-02 · Consulter la fiche d'un salon

**En tant que** client, **je veux** consulter la fiche d'un salon (photos, horaires, prestations et prix, coiffeurs, attente), **afin de** décider si je rejoins sa file.

- Priorité : I (PRD §5.3)
- Règles appliquées : états de la file du salon (PRD §5.2 : Fermée, Ouverte, En pause, Complète) ; H1 (une file unique par salon) ; « Prochain créneau libre » (PRD §5.2, détail dans U-16) ; changement d'état de la file visible côté client en moins de 2 s (PRD §5.3 S-08) ; fiche salon chargée en moins de 2 s (PRD §6) ; repli à 30 s côté client (PRD §6)
- Parcours : F-C2 (APP_FLOW §3) ; depuis F-C1 ou un lien partagé ; vers F-C3 (rejoindre) et F-C1 (salons proches, fermeture du panneau)
- Commandes et données : RPC `get_salon_public(slug)` · vues `public_salons` (dont `next_free_slots`), `public_stylists` · tables `services`, `opening_hours`, `salon_closures`, `specialties`, `member_specialties` · canal public `salon-public:{salon_id}` (`salon_updated { version }`, TRD ADR-018, §6.4) · Storage `salon-photos`, `member-photos`

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

### 9 bis. Prochain créneau libre par prestation (renvoi vers U-16)
- **Étant donné** un salon dont deux prestations tiennent dans un trou de la journée d'un coiffeur qui les maîtrise, et une troisième qui ne tient dans aucun trou
- **Quand** j'ouvre sa fiche
- **Alors** chacune des deux premières prestations affiche son prochain créneau libre (exemple PRD §5.2 : « prochain créneau libre à 15h20 »)
- **Et** la troisième prestation n'affiche aucun créneau libre
- **Et** aucun prénom de coiffeur n'est associé au créneau

### 9 ter. Fiche à jour sans compte ni ticket
- **Étant donné** que la fiche d'un salon ouvert est affichée sur l'appareil d'un visiteur sans compte et sans ticket
- **Quand** le gérant met la file en pause
- **Alors** en moins de 2 s, le bouton devient « File en pause, réessayez dans quelques minutes » sans rechargement de la page
- **Et** l'attente, le statut de la file et les créneaux libres affichés sont relus après chaque message du canal public `salon-public:{salon_id}`
- **Et** ce message ne contient aucune donnée personnelle (seulement `{ version }`)

### 9 quater. Repli sans temps réel
- **Étant donné** que le canal temps réel n'est pas disponible sur l'appareil
- **Quand** la fiche reste ouverte
- **Alors** l'attente, le statut de la file et les créneaux libres sont relus toutes les 30 s
- **Et** ils sont relus aussi au retour de l'app au premier plan

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
| `client.salon.services.next_free_slot` | _À rédiger_ (PRD §5.2, indicatif : « prochain créneau libre à 15h20 ») | Variable `time` ; partagé avec U-16 |
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
- **Résolu le 18/10** (K6) — Mise à jour d'une fiche ouverte sans ticket : canal public `salon-public:{salon_id}` sans donnée personnelle (TRD ADR-018), repli à 30 s ; voir scénarios 9 ter et 9 quater.
- **APP_FLOW F-C2** : qu'affiche `/salons/:slug` pour un slug inconnu ou pour un salon qui n'est pas (ou plus) publié ?
- **APP_FLOW F-C2 / BACKEND_SCHEMA §4.8** : un jour de fermeture exceptionnelle, la fiche affiche-t-elle le motif (`salon_closures.reason`) en plus de la prochaine ouverture ?
- **APP_FLOW F-C2** : « Personnes avant vous » et l'heure de passage portent-elles sur un nouveau client « premier disponible » (`current_wait_minutes`) ? L'heure est-elle arrondie aux 5 min supérieures ? La décision E13 (position = clients avant lui chez son coiffeur) vise le ticket (U-06), pas la fiche : quel nombre afficher sur la fiche, pour qui n'a pas encore de coiffeur ?
- **PRD §5.2 / BACKEND_SCHEMA §4.3** : `next_free_slots` est recalculé à chaque commande et à chaque `queue-tick`. Un créneau libre déjà passé (heure dépassée entre deux recalculs) est-il masqué par la fiche ?
- **Textes** : l'heure de passage estimée, le libellé du statut `away` et le libellé du créneau libre ne figurent dans aucun document.
