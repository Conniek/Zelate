# S-05 · Définir ses prestations

**En tant que** gérant, **je veux** définir les prestations de mon salon (nom, durée de 15 à 180 min, prix, spécialité requise) en partant de suggestions pré-remplies, **afin que** les clients choisissent ce qu'ils viennent faire et que l'attente soit calculée avec des durées réalistes.

- Priorité : I (PRD §5.3)
- Règles appliquées : H2 (l'attente se calcule à partir des durées prédéfinies des prestations) ; H1 (la spécialité requise détermine les coiffeurs qui maîtrisent la prestation) ; PRD §11 n° 2
- Parcours : F-M2 « Prestations », F-M11 `/dashboard/services` ; usages F-C2 (fiche salon), F-C3 étape 1, F-S6 (durée pré-remplie)
- Commandes et données : écriture directe du gérant sous RLS (TRD §6.3, tables de configuration) · tables `services` (`name`, `duration_minutes`, `price_cents`, `required_specialty_code`, `is_active`, `sort_order`), `specialties`

## Scénarios

### 1. Partir des suggestions pré-remplies
- **Étant donné** le gérant à l'étape « Prestations » du wizard
- **Quand** il coche des prestations suggérées, ajuste leur durée ou leur prix, puis enregistre
- **Alors** chaque prestation cochée est enregistrée avec ses valeurs ajustées
- **Alors** les prestations non cochées ne sont pas enregistrées

### 2. Ajouter une prestation
- **Étant donné** le gérant à l'étape « Prestations »
- **Quand** il clique sur « Ajouter », saisit « Coupe homme », 30 min, un prix et la spécialité requise, puis enregistre
- **Alors** la prestation est enregistrée comme active
- **Alors** elle est proposée aux clients à l'étape 1 de « Rejoindre la file » une fois le salon publié
- **Alors** la fiche salon affiche son nom, sa durée et son prix

### 3. Durées limites acceptées
- **Étant donné** le formulaire d'une prestation
- **Quand** le gérant saisit une durée de 15 min, puis une autre de 180 min
- **Alors** chacune est enregistrée

### 4. Durée hors limites
- **Étant donné** le formulaire d'une prestation
- **Quand** le gérant saisit une durée de moins de 15 min ou de plus de 180 min
- **Alors** l'enregistrement est refusé avec un message qui rappelle la plage de 15 à 180 min

### 5. Durée qui n'est pas un multiple de 5
- **Étant donné** le formulaire d'une prestation
- **Quand** le gérant saisit une durée de 17 min
- **Alors** l'enregistrement est refusé avec un message d'erreur (BACKEND_SCHEMA §4.9 : multiple de 5)

### 6. Nom trop court ou trop long
- **Étant donné** le formulaire d'une prestation
- **Quand** le nom fait moins de 2 caractères ou plus de 60
- **Alors** l'enregistrement est refusé avec un message d'erreur

### 7. Prix négatif
- **Étant donné** le formulaire d'une prestation
- **Quand** le gérant saisit un prix négatif
- **Alors** l'enregistrement est refusé avec un message d'erreur

### 8. Prix à 0
- **Étant donné** le formulaire d'une prestation
- **Quand** le gérant saisit un prix de 0
- **Alors** la prestation est enregistrée (`price_cents` ≥ 0)

### 9. La spécialité requise limite les coiffeurs éligibles
- **Étant donné** une prestation « Tresses » qui demande la spécialité `braids`, et un seul coiffeur qui la maîtrise
- **Quand** un client sans préférence prend cette prestation
- **Alors** seul ce coiffeur peut être son coiffeur pressenti et l'appeler (H1, PRD §5.2 règle 4)

### 10. La durée prédéfinie sert au calcul et au démarrage
- **Étant donné** une prestation de 45 min choisie par un client
- **Quand** l'heure de passage des clients suivants est calculée
- **Alors** 45 min sont comptées pour ce ticket (H2)
- **Quand** le coiffeur ouvre « Commencer la prestation » pour ce client
- **Alors** la durée de 45 min est pré-remplie (F-S6)

### 11. Aucune prestation active
- **Étant donné** un salon sans aucune prestation active
- **Quand** le gérant enregistre l'étape « Prestations »
- **Alors** un message indique qu'au moins une prestation active est nécessaire (APP_FLOW F-M2)
- **Alors** le bouton « Publier mon salon » reste inactif (F-M3)

### 12. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** il essaie de modifier une prestation du salon B (par l'API)
- **Alors** l'écriture est refusée

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.services.title` | « Prestations » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.services.add` | « Ajouter » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.services.suggestions.<id>` | — (à rédiger : liste des suggestions) | Nom de 2 à 60 caractères |
| `pro-manager.services.field.duration` | — (à rédiger) | Unité « min » ; 15 à 180 |
| `pro-manager.services.field.price` | — (à rédiger) | Format fr-FR en euros |
| `pro-manager.services.field.specialty` | — (à rédiger) | Liste `common.specialties.<code>` |
| `errors.validation.service_duration` | — (à rédiger) | Rappelle 15 à 180 min, multiple de 5 |
| `errors.validation.service_name` | — (à rédiger) | 2 à 60 caractères |
| `errors.validation.service_price` | — (à rédiger) | Prix positif ou nul |
| `errors.validation.at_least_one_active_service` | — (à rédiger) | — |

## Questions ouvertes
- **PRD / APP_FLOW** : la liste des suggestions pré-remplies (noms, durées, prix, spécialités) n'est écrite nulle part.
- **PRD / BACKEND_SCHEMA** : le PRD donne la « spécialité requise » comme champ de la prestation, mais `services.required_specialty_code` peut être vide. Ce champ est-il obligatoire ? Sinon, qui peut prendre une prestation sans spécialité ?
- **PRD** : la règle « durée multiple de 5 » ne se trouve que dans BACKEND_SCHEMA. Faut-il l'ajouter au PRD ?
- **APP_FLOW** : la règle « au moins une prestation active » bloque-t-elle l'enregistrement, la désactivation de la dernière prestation, ou seulement la publication ?
- **PRD** : si le gérant change la durée d'une prestation ou la désactive, quel est l'effet sur les tickets déjà en attente avec cette prestation ? Les heures sont-elles recalculées ? Les clients sont-ils prévenus ?
- **APP_FLOW** : le gérant doit-il être averti quand aucun coiffeur actif ne maîtrise la spécialité requise par une prestation ?
- **APP_FLOW** : le gérant peut-il choisir l'ordre d'affichage des prestations (`sort_order`) ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
