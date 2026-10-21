# U-16 · Voir le prochain créneau libre

**En tant que** client qui cherche un salon, **je veux** voir sur la carte, dans la liste et sur la fiche du salon le prochain créneau libre pour chaque prestation, **afin de** savoir tout de suite quand je peux être pris entre deux rendez-vous.

- Priorité : I (PRD §5.3)
- Règles appliquées : H10 (un client de dernière minute ne passe avant un rendez-vous que si sa prestation finit avant, aucune marge) (PRD §5.1) ; « Prochain créneau libre » et distribution règle 6 (PRD §5.2) : un trou est un temps libre d'un coiffeur présent, dans ses horaires, hors pauses, y compris après son dernier client ; la fiche affiche le créneau de chaque prestation qui tient dans un trou, la liste et la carte le plus tôt avec le nom de sa prestation ; rien si la file n'est pas ouverte ; ce n'est pas une réservation (E22) ; décisions R1 et R7, marge de 0 min (PRD §11) ; question ouverte n° 4 (marge à revoir après le pilote, PRD §9) ; spécialité facultative, « je ne sais pas encore » accepté par tous (PRD §5.1, E12) ; statuts du coiffeur (PRD §5.2) ; fiche chargée en moins de 2 s, propagation en moins de 2 s (PRD §6)
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

### 6 bis. Trou après le dernier client (E22)

- **Étant donné** un salon sans aucun rendez-vous, dont la file est ouverte, et Sam qui maîtrise « Coupe homme » (30 min), présent jusqu'à 19h00, dont le dernier client simulé finit à 16h00
- **Quand** le moteur recalcule le prochain créneau libre
- **Alors** « Coupe homme » figure dans `next_free_slots` à 16h00, si aucun trou plus tôt n'existe

### 6 ter. Les pauses ne sont pas des trous (E22)

- **Étant donné** que Léa est en pause de 14h00 à 14h30 et qu'elle n'a aucun autre temps libre avant 16h00
- **Quand** le moteur recalcule le prochain créneau libre
- **Alors** aucun créneau n'est retenu chez Léa entre 14h00 et 14h30

### 6 quater. Hors des horaires du coiffeur (E22)

- **Étant donné** que Sam a déclaré sa fin de journée à 17h00 et qu'il est libre de 16h45 à 17h00
- **Quand** le moteur cherche un trou pour « Coupe homme » (30 min)
- **Alors** ce temps libre de 15 min, coupé par sa fin de journée, n'est pas retenu

### 7. Badge sur la carte et dans la liste (E22)

- **Étant donné** qu'un salon a des créneaux libres pour plusieurs prestations : « Coupe homme » à 15h20 et « Barbe » à 14h40
- **Quand** j'affiche l'accueil en liste ou en carte
- **Alors** la carte du salon et son repère affichent le créneau le plus tôt, 14h40, avec le nom de sa prestation, « Barbe »
- **Et** cette règle remplace « la prestation la plus courte » encore écrite dans APP_FLOW F-C1 (voir questions ouvertes)

### 7 bis. Rien si la file n'est pas ouverte (E22)

- **Étant donné** que le gérant met la file en pause ou la ferme
- **Quand** le moteur recalcule
- **Alors** `next_free_slots` vaut `[]`
- **Et** ni la liste, ni la carte, ni la fiche n'affichent de créneau libre pour ce salon

### 7 ter. Ce n'est pas une réservation (E22)

- **Étant donné** que la fiche affiche un créneau libre pour une prestation
- **Quand** je la consulte
- **Alors** l'indication « Ce créneau est indicatif : il n'est pas réservé pour vous. » est disponible (emplacement : voir questions ouvertes)
- **Et** aucun ticket ni aucune place n'est créé par l'affichage du créneau

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

| Clé (anglais)                                           | Texte (français)                                           | Contrainte                                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.salon.free_slot`                                | Créneau libre à {time}                                     | Exemple APP_FLOW F-C1 et DESIGN_SYSTEM §2.4 : « Créneau libre à 15h20 » ; heure au format fr-FR ; même texte que `client.salon.services.next_free_slot` (« Prochain créneau libre à {time} »), `client.home.next_free_slot` et `common.free_slot` : doublons à réduire |
| `client.salon.free_slot_hint`                           | Ce créneau est indicatif : il n'est pas réservé pour vous. | E22                                                                                                                                                                                                                                                                    |
| _Libellé de la liste et de la carte avec la prestation_ | _Absent du dictionnaire_                                   | E22 demande le nom de la prestation ; aucune clé n'a de variable pour elle                                                                                                                                                                                             |

## Questions ouvertes

- **Résolu le 19/10** (E22) — Liste et carte : le créneau le plus tôt, avec le nom de sa prestation ; voir scénario 7. **Contradiction restante** : APP_FLOW v0.6 F-C1 dit encore « pour la prestation la plus courte qui tient », et aucune clé du dictionnaire ne porte le nom de la prestation.
- **Résolu le 19/10** (E22) — Un trou est un temps libre d'un coiffeur présent, dans ses horaires, hors pauses, y compris après son dernier client ; un salon sans rendez-vous peut donc afficher un créneau ; voir scénarios 6 bis à 6 quater.
- **Résolu le 19/10** (E22) — Pauses exclues, horaires du coiffeur respectés ; voir scénarios 6 ter et 6 quater.
- **PRD §5.2 / BACKEND_SCHEMA §4.12** : tous les coiffeurs sont « Hors ligne » en début de journée jusqu'à « Je suis prêt ». Un coiffeur hors ligne est-il « présent » au sens de E22 ? Avant « Je suis prêt », aucun créneau n'existe-t-il ? (Le scénario 10 ne vise que l'absence déclarée ; lien possible avec E32, ouverture automatique.)
- **Résolu le 19/10** (E22) — Rien n'est affiché si la file n'est pas ouverte ; voir scénario 7 bis.
- **Résolu en partie le 19/10** (E22) — Ce n'est pas une réservation ; le dictionnaire a l'indication `client.salon.free_slot_hint` ; voir scénario 7 ter. Restent ouverts (PRD §5.2 / APP_FLOW F-C2) : où ce message s'affiche-t-il, et un client qui rejoint la file avec cette prestation obtient-il ce créneau comme heure de passage, ou le rang d'inscription (règle 3) peut-il l'en écarter ?
- **Résolu en partie le 19/10** (TRD v0.5 §6.3, BACKEND_SCHEMA v0.5 §8.1) — `search_salons` renvoie `next_free_slots` et `is_full`. Reste ouvert (APP_FLOW F-C1) : la liste de l'accueil est-elle mise à jour en temps réel, ou seulement la fiche (F-C2) ?
- **DESIGN_SYSTEM §7.3 / APP_FLOW F-C1** : le badge d'attente passe « à vérifier » au-delà de 5 min ; le badge de créneau libre a-t-il une règle de fraîcheur ?
- **PRD §5.2** : un créneau commencé (heure de début passée de quelques minutes mais trou encore assez long) reste-t-il affiché avec son heure d'origine ou avec l'heure actuelle ?
- **Dictionnaire** : le libellé avec le nom de la prestation (liste et carte, E22) et le texte lu par le lecteur d'écran ne sont pas rédigés ; quatre clés portent le même texte « Créneau libre à {time} » (voir Textes à prévoir).
