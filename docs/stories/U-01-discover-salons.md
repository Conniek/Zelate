# U-01 · Découvrir les salons autour de soi

**En tant que** client, **je veux** voir les salons ouverts autour de moi en liste et sur une carte, **afin de** choisir où aller selon la distance et l'attente.

- Priorité : I (PRD §5.3)
- Règles appliquées : états de la file du salon (PRD §5.2 : Fermée, Ouverte, En pause, Complète) ; « Prochain créneau libre » (PRD §5.2, détail dans U-16) ; décision n° 23 « salons non inscrits sur la carte : non » (PRD §11) ; accueil affiché en moins de 3 s sur mobile 4G (PRD §6)
- Parcours : F-C1 (APP_FLOW §3) ; vers F-C2 (fiche salon) et F-C5 (bandeau « Ma place »)
- Commandes et données : RPC `search_salons(lat, lng, radius_m, query?)` · vue `public_salons` · table `salons` (`location`, `queue_status`, `waiting_count`, `current_wait_minutes`, `estimate_updated_at`, `next_free_slots`, `status`) · RPC `my_active_ticket` (bandeau « Ma place »)

## Scénarios

### 1. Géolocalisation acceptée : salons à 5 km triés par distance
- **Étant donné** que j'ouvre l'accueil `/` et que des salons publiés ont leur file ouverte à moins de 5 km de ma position
- **Quand** l'app m'explique pourquoi elle demande ma position, puis que j'accepte la demande système
- **Alors** je vois la liste des salons situés dans un rayon de 5 km autour de ma position
- **Et** la liste est triée du salon le plus proche au plus éloigné
- **Et** chaque salon affiche un badge d'attente (exemple « ~25 min »)
- **Et** chaque salon affiche la fraîcheur de l'information (exemple « mis à jour il y a 2 min »)

### 2. L'explication précède la demande système
- **Étant donné** que j'ouvre l'accueil pour la première fois
- **Quand** l'écran se charge
- **Alors** une explication s'affiche avant que le navigateur ne demande l'accès à ma position
- **Et** la demande système n'apparaît qu'après cette explication

### 3. Géolocalisation refusée : recherche par adresse
- **Étant donné** que j'ai refusé la géolocalisation
- **Quand** l'accueil s'affiche
- **Alors** le champ « Adresse ou ville » s'affiche
- **Et** aucune liste de salons n'est calculée à partir d'une position

### 4. Autocomplétion de l'adresse à partir de 3 caractères
- **Étant donné** que le champ « Adresse ou ville » est affiché
- **Quand** je saisis 2 caractères
- **Alors** aucune suggestion n'est proposée

### 5. Recherche autour d'une adresse choisie
- **Étant donné** que j'ai saisi au moins 3 caractères dans « Adresse ou ville »
- **Quand** je choisis une des suggestions affichées
- **Alors** la liste montre les salons situés dans un rayon de 5 km autour de l'adresse choisie
- **Et** la liste est triée par distance à cette adresse

### 6. Bascule Liste / Carte
- **Étant donné** que la liste affiche des résultats
- **Quand** je touche l'onglet « Carte »
- **Alors** la carte se charge (première ouverture seulement) et montre un repère par salon de la liste
- **Et** les salons affichés sont les mêmes que dans la liste

### 7. « Me localiser » recentre la carte
- **Étant donné** que la carte est affichée et que j'ai accepté la géolocalisation
- **Quand** je touche « Me localiser »
- **Alors** la carte se recentre sur ma position

### 8. Filtre « Ouvert maintenant » activé par défaut
- **Étant donné** qu'il y a dans le rayon un salon à la file ouverte, un salon à la file fermée et un salon à la file en pause
- **Quand** l'accueil affiche les résultats sans que j'aie touché aux filtres
- **Alors** le filtre « Ouvert maintenant » est activé
- **Et** seul le salon à la file ouverte apparaît

### 9. Filtre désactivé : salon fermé affiché « Fermé » avec sa prochaine ouverture
- **Étant donné** qu'un salon publié de la zone a sa file fermée
- **Quand** je désactive le filtre « Ouvert maintenant »
- **Alors** ce salon apparaît dans les résultats
- **Et** il est affiché « Fermé » avec sa prochaine heure d'ouverture

### 10. Information d'attente ancienne : « à vérifier »
- **Étant donné** qu'un salon a une estimation d'attente mise à jour il y a plus de 5 min (exemple : 6 min)
- **Quand** il apparaît dans la liste ou sur la carte
- **Alors** son badge d'attente porte la mention « à vérifier »
- **Et** un salon dont l'estimation date de 5 min ou moins n'affiche pas cette mention

### 10 bis. Prochain créneau libre sur la carte du salon (renvoi vers U-16)
- **Étant donné** qu'un salon de la liste a, dans la journée d'un coiffeur qui maîtrise une prestation, un trou au moins aussi long que la durée de cette prestation (marge de 0 min)
- **Quand** il apparaît dans la liste ou sur la carte
- **Alors** il affiche « Créneau libre à 15h20 » pour la prestation la plus courte qui tient dans un trou (exemple APP_FLOW F-C1)
- **Et** aucun prénom de coiffeur n'est affiché avec ce créneau
- **Quand** aucune prestation ne tient dans un trou
- **Alors** aucune mention de créneau libre n'est affichée pour ce salon

### 11. Aucun résultat : élargir à 10 km
- **Étant donné** qu'aucun salon ne correspond dans un rayon de 5 km
- **Quand** la recherche se termine
- **Alors** un message indique qu'aucun salon n'a été trouvé
- **Et** un bouton « Élargir à 10 km » est proposé
- **Quand** je touche « Élargir à 10 km »
- **Alors** une nouvelle recherche est lancée dans un rayon de 10 km

### 12. Salons non publiés absents
- **Étant donné** des salons dans le rayon en statut `draft`, `pending_review`, `approved` (non publié), `rejected` ou `suspended`
- **Quand** la liste et la carte s'affichent
- **Alors** aucun de ces salons n'apparaît, ni dans la liste ni sur la carte
- **Et** seuls les salons `published` sont proposés

### 13. Ouvrir la fiche d'un salon
- **Étant donné** que la liste ou la carte affiche des salons
- **Quand** je touche une carte de salon dans la liste ou un repère sur la carte
- **Alors** la fiche de ce salon s'ouvre (F-C2)

### 14. Bandeau « Ma place » si j'ai un ticket actif
- **Étant donné** que je suis connecté et que j'ai un ticket actif
- **Quand** j'ouvre l'accueil
- **Alors** le bandeau « Ma place » est affiché
- **Quand** je le touche
- **Alors** mon ticket s'ouvre (F-C5)

### 15. Temps d'affichage
- **Étant donné** un smartphone en 4G
- **Quand** j'ouvre l'accueil
- **Alors** l'accueil est affiché en moins de 3 s

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.home.geolocation.explanation` | _À rédiger (absent des docs)_ | Affiché avant la demande système |
| `client.home.search.label` | « Adresse ou ville » | — |
| `client.home.tabs.list` | « Liste » | — |
| `client.home.tabs.map` | « Carte » | — |
| `client.home.filters.open_now` | « Ouvert maintenant » | Activé par défaut |
| `client.home.wait_badge` | « ~{minutes} min » (exemple APP_FLOW : « ~25 min ») | Variable `minutes` |
| `client.home.freshness` | « mis à jour il y a {minutes} min » | Pluriel ICU |
| `client.home.freshness_stale` | « à vérifier » | Au-delà de 5 min |
| `client.home.next_free_slot` | _À rédiger_ (APP_FLOW, indicatif : « Créneau libre à 15h20 ») | Variable `time` ; partagé avec U-16 |
| `client.home.map.locate_me` | « Me localiser » | — |
| `client.home.empty.message` | _À rédiger (absent des docs)_ | — |
| `client.home.empty.widen` | « Élargir à 10 km » | — |
| `client.home.active_ticket_banner` | « Ma place » | — |
| `common.queue.closed_with_next_opening` | « Fermé · ouvre {day} à {time} » (exemple APP_FLOW F-C2 : « Fermé · ouvre demain à 9h00 ») | Partagé avec U-02 |

## Questions ouvertes
- **PRD U-01 / APP_FLOW F-C1** : le PRD parle de « tri par distance, attente et fraîcheur de l'information » ; APP_FLOW trie seulement par distance et affiche l'attente et la fraîcheur dans un badge. Le client peut-il trier par attente ou par fraîcheur, ou s'agit-il seulement des informations affichées ?
- **PRD U-01 / APP_FLOW F-C1** : le PRD dit « salons ouverts » mais le filtre « Ouvert maintenant » peut être désactivé. Le PRD §5.2 ne dit comment afficher que l'état « Fermée ». Qu'affichent la liste et la carte pour un salon **en pause** ou **complet** quand le filtre est désactivé ?
- **APP_FLOW F-C1** : la demande de géolocalisation est faite « une fois ». Après un refus, l'app propose-t-elle à nouveau la géolocalisation (par exemple avec « Me localiser »), ou seulement la recherche par adresse ?
- **APP_FLOW F-C1** : que se passe-t-il si la recherche à 10 km ne trouve rien non plus ?
- **PRD §5.2** : le badge d'attente vient de `current_wait_minutes`. Est-il arrondi aux 5 min supérieures, comme l'attente d'un ticket ?
- **PRD §5.3 U-16 / PRD §5.2 « Prochain créneau libre » / APP_FLOW F-C1** : U-16 parle du prochain créneau libre « pour chaque prestation » sur la carte et la fiche ; APP_FLOW F-C1 n'en affiche qu'un par salon dans la liste et la carte (« la prestation la plus courte qui tient »). Lequel s'applique à l'accueil ?
- **APP_FLOW F-C1 / PRD §5.2** : le créneau libre est-il affiché pour un salon en pause, complet ou fermé quand le filtre « Ouvert maintenant » est désactivé ?
- **TRD §6.3 / BACKEND_SCHEMA §8.1** : le paramètre texte de `search_salons` s'appelle `text?` dans le TRD et `query?` dans le schéma. Lequel retenir ?
- **Textes** : l'explication avant la demande de géolocalisation, le message « aucun résultat » et le libellé du créneau libre ne figurent dans aucun document (APP_FLOW ne donne que des libellés indicatifs).
