# U-16 · Voir le prochain créneau libre

**En tant que** client qui cherche un salon, **je veux** voir sur la carte, dans la liste et sur la fiche du salon le prochain créneau libre pour chaque prestation, **afin de** savoir tout de suite quand je peux être pris entre deux rendez-vous.

- Priorité : I (PRD §5.3)
- Règles appliquées : H10 (un client de dernière minute ne passe avant un rendez-vous que si sa prestation finit avant, aucune marge) (PRD §5.1) ; « Prochain créneau libre » et distribution règle 6 (PRD §5.2) ; décisions R1 et R7, marge de 0 min (PRD §11) ; question ouverte n° 4 (marge à revoir après le pilote, PRD §9) ; spécialité facultative, « je ne sais pas encore » accepté par tous (PRD §5.1, E12) ; statuts du coiffeur (PRD §5.2) ; fiche chargée en moins de 2 s, propagation en moins de 2 s (PRD §6)
- Parcours : F-C1 (liste et carte, « Créneau libre à 15h20 ») et F-C2 (liste des prestations, mise à jour par le canal public) (APP_FLOW §3)
- Commandes et données : aucune commande client ; calcul par le moteur à chaque commande de `queue-command` et à chaque `queue-tick` (ADR-017), paramètre `slot_margin_minutes` = 0 · table `salons` (`next_free_slots` = `[{ service_id, starts_at }]`, `queue_version`) · vue `public_salons` (`next_free_slots`) · RPC `search_salons`, `get_salon_public` · table `services` (`duration_minutes`, `required_specialty_code`, `is_active`) · canal `salon-public:{salon_id}` (`salon_updated { version }`, ADR-018) · composants `FreeSlotBadge`, `SalonCard`, `SalonMarker`

## Scénarios

### 1. Créneau libre affiché pour une prestation
- **Étant donné** que Léa maîtrise « Coupe homme » (30 min), que son rendez-vous de 15h00 finit à 15h20 et que son rendez-vous suivant est à 16h00
- **Et** qu'aucun coiffeur n'a de trou de 30 min ou plus avant 15h20
- **Quand** le moteur recalcule le prochain créneau libre
- **Alors** `next_free_slots` contient « Coupe homme » à 15h20
- **Et** la fiche du salon affiche, dans la liste des prestations, « Créneau libre à 15h20 » à côté de « Coupe homme »

### 2. Marge de 0 min : un trou exactement de la durée suffit
- **Étant donné** un trou de 30 min exactement chez un coiffeur qui maîtrise « Coupe homme » (30 min)
- **Quand** le moteur recalcule le prochain créneau libre
- **Alors** « Coupe homme » figure dans `next_free_slots` avec l'heure de début de ce trou

### 3. Trou trop court : prestation absente
- **Étant donné** que le seul trou de la journée dure 25 min, et que « Couleur » dure 90 min
- **Quand** la fiche du salon s'affiche
- **Alors** aucun créneau libre n'est affiché à côté de « Couleur »
- **Et** « Couleur » ne figure pas dans `next_free_slots`

### 4. Seulement chez un coiffeur qui maîtrise la prestation
- **Étant donné** que « Tresses » demande la spécialité « tresses », que Sam a un trou de 2 h mais ne la maîtrise pas, et que Léa la maîtrise mais n'a aucun trou assez long
- **Quand** le moteur recalcule le prochain créneau libre
- **Alors** « Tresses » ne figure pas dans `next_free_slots`

### 5. Prestation sans spécialité
- **Étant donné** que « Coupe enfant » n'a aucune spécialité requise
- **Quand** le moteur cherche un trou pour elle
- **Alors** les trous de tous les coiffeurs sont pris en compte

### 6. Le premier trou est retenu
- **Étant donné** que Léa a un trou assez long à 15h20 et Sam un autre à 14h40, tous deux pour « Coupe homme »
- **Quand** le moteur recalcule le prochain créneau libre
- **Alors** l'heure retenue pour « Coupe homme » est 14h40

### 7. Badge sur la carte et dans la liste
- **Étant donné** qu'un salon a des créneaux libres pour plusieurs prestations
- **Quand** j'affiche l'accueil en liste ou en carte
- **Alors** la carte du salon et son repère affichent « Créneau libre à … » pour la prestation la plus courte qui tient dans un trou

### 8. Aucun trou : pas de badge
- **Étant donné** qu'aucune prestation du salon ne tient dans un trou
- **Quand** j'affiche la liste, la carte ou la fiche du salon
- **Alors** aucun badge « Créneau libre » n'est affiché
- **Et** `next_free_slots` vaut `[]`

### 9. Le créneau ne nomme aucun coiffeur
- **Étant donné** un créneau libre trouvé chez Léa
- **Quand** la fiche du salon l'affiche
- **Alors** seule l'heure est affichée, sans le prénom du coiffeur
- **Et** les données reçues par l'appareil (`next_free_slots`) ne contiennent que la prestation et l'heure

### 10. Coiffeur absent : pas de créneau chez lui
- **Étant donné** que Léa est déclarée absente pour la journée
- **Quand** le moteur recalcule le prochain créneau libre
- **Alors** aucun créneau n'est retenu chez Léa

### 11. Recalcul après une commande
- **Étant donné** que « Coupe homme » a un créneau libre à 15h20
- **Quand** le gérant saisit un rendez-vous de 30 min à 15h20 chez le seul coiffeur qui avait ce trou
- **Alors** le créneau de 15h20 n'est plus proposé pour « Coupe homme »
- **Et** le prochain trou assez long, s'il existe, est affiché à sa place

### 12. Recalcul chaque minute
- **Étant donné** qu'aucune commande n'est envoyée pendant plusieurs minutes
- **Quand** `queue-tick` s'exécute (chaque minute)
- **Alors** `next_free_slots` est recalculé

### 13. Fiche à jour sans compte, en temps réel
- **Étant donné** que je consulte la fiche d'un salon sans être connecté
- **Quand** le prochain créneau libre change
- **Alors** la fiche affiche le nouveau créneau en moins de 2 s
- **Et** le message reçu sur le canal `salon-public:{salon_id}` ne contient que `{ version }`

### 14. Repli sans temps réel
- **Étant donné** que le temps réel n'est pas disponible sur mon appareil
- **Quand** la fiche du salon reste ouverte
- **Alors** les créneaux sont relus toutes les 30 s
- **Et** ils sont relus aussi dès que je reviens sur l'app

### 15. Salon non publié : aucun créneau exposé
- **Étant donné** un salon validé mais non publié
- **Quand** un visiteur interroge `public_salons` ou `search_salons`
- **Alors** ce salon et ses créneaux ne sont pas renvoyés

### 16. Accessibilité du badge
- **Étant donné** qu'un badge « Créneau libre à 15h20 » est affiché
- **Quand** un lecteur d'écran le lit
- **Alors** il annonce le texte complet avec l'heure
- **Et** le badge porte une icône et un libellé, jamais la couleur seule

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.salon.free_slot` | « Créneau libre à {time} » | Exemple APP_FLOW F-C1 et DESIGN_SYSTEM §2.4 : « Créneau libre à 15h20 » ; heure au format fr-FR ; partagé par `SalonCard`, `SalonMarker` et la liste des prestations |

## Questions ouvertes
- **PRD §5.2 / APP_FLOW F-C1** : le PRD dit que « la fiche et la carte du salon affichent ce prochain créneau libre » ; APP_FLOW précise, pour la liste et la carte, le créneau « pour la prestation la plus courte qui tient ». Celui-ci n'est pas forcément le plus tôt. Faut-il afficher le créneau de la prestation la plus courte, ou le créneau le plus tôt toutes prestations confondues ? Le badge doit-il nommer la prestation ?
- **PRD §5.2 « Prochain créneau libre »** : qu'est-ce qu'un « trou » ? Seulement l'intervalle entre deux rendez-vous (ou entre maintenant et un rendez-vous), ou aussi le temps libre après le dernier client simulé jusqu'à la fermeture ? Dans un salon sans rendez-vous, le badge apparaît-il ?
- **PRD §5.2** : le trou doit-il tenir avant la fermeture (règle « Complète ») et avant la fin de journée déclarée du coiffeur (`shift_end_at`) ? Un créneau dans une pause annoncée est-il exclu ?
- **PRD §5.2 / BACKEND_SCHEMA §4.12** : tous les coiffeurs sont « Hors ligne » en début de journée jusqu'à « Je suis prêt ». Avant cela, aucun créneau n'existe-t-il ? Faut-il tenir compte des horaires d'ouverture et des rendez-vous saisis à l'avance pour les coiffeurs encore hors ligne ? (Le scénario 10 ne vise que l'absence déclarée.)
- **PRD §5.2 / APP_FLOW F-C2** : faut-il afficher le créneau quand la file est en pause, fermée ou complète ? Le bouton « Rejoindre la file » est alors désactivé et le client ne peut pas prendre ce créneau.
- **PRD §5.2 / §4** : le créneau affiché n'est pas une réservation (le créneau payant arrive en V1). Un client qui rejoint la file avec cette prestation obtient-il bien ce créneau comme heure de passage, ou le rang d'inscription (règle 3) peut-il l'en écarter ? Faut-il un message pour éviter que le client prenne l'heure pour une promesse ?
- **BACKEND_SCHEMA §8.1** : `search_salons` renvoie les salons « avec attente » ; il n'est pas écrit qu'il renvoie `next_free_slots`, nécessaire au badge de la liste et de la carte. À préciser. La liste de l'accueil (F-C1) est-elle mise à jour en temps réel, ou seulement la fiche (F-C2) ?
- **DESIGN_SYSTEM §7.3 / APP_FLOW F-C1** : le badge d'attente passe « à vérifier » au-delà de 5 min ; le badge de créneau libre a-t-il une règle de fraîcheur ?
- **PRD §5.2** : un créneau commencé (heure de début passée de quelques minutes mais trou encore assez long) reste-t-il affiché avec son heure d'origine ou avec l'heure actuelle ?
- **Textes** : seul « Créneau libre à 15h20 » est documenté ; le texte lu par le lecteur d'écran (avec la prestation) n'est pas rédigé.
