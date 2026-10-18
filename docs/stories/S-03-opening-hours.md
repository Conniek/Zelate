# S-03 · Horaires d'ouverture et fermetures exceptionnelles

**En tant que** gérant, **je veux** définir les horaires d'ouverture de mon salon (plusieurs plages par jour possibles), les copier sur la semaine et déclarer des fermetures exceptionnelles, **afin que** la file et les clients suivent les vrais horaires du salon.

- Priorité : I (PRD §5.3)
- Règles appliquées : PRD §5.2 États de la file (« Fermée » avec la prochaine ouverture, « Ouverte » et « Complète » calculés par rapport à la fermeture) ; H9 (la fin de journée se calcule par rapport à la fermeture)
- Parcours : F-M2 « Horaires », F-M11 `/dashboard/hours` ; affichage côté client F-C2 « Horaires »
- Commandes et données : écriture directe du gérant sous RLS (TRD §6.3, tables de configuration) · tables `opening_hours` (`weekday`, `opens_at`, `closes_at`), `salon_closures` (`starts_on`, `ends_on`, `reason`)

## Scénarios

### 1. Une plage pour un jour
- **Étant donné** le gérant à l'étape « Horaires » du wizard
- **Quand** il saisit pour le lundi une plage de 09:00 à 19:00 et enregistre
- **Alors** la plage est enregistrée pour le lundi
- **Alors** la liste de contrôle du wizard montre l'étape « Horaires » comme renseignée

### 2. Plusieurs plages le même jour
- **Étant donné** le lundi avec une plage de 09:00 à 12:00
- **Quand** le gérant clique sur « Ajouter une plage », saisit 14:00 à 19:00 et enregistre
- **Alors** le lundi a deux plages enregistrées, 09:00-12:00 et 14:00-19:00

### 3. Plages qui se chevauchent
- **Étant donné** le lundi avec une plage de 09:00 à 12:00
- **Quand** le gérant ajoute une plage de 11:00 à 15:00 et enregistre
- **Alors** l'enregistrement est refusé avec un message d'erreur
- **Alors** seule la plage 09:00-12:00 reste enregistrée

### 4. Fermeture avant ou à l'heure d'ouverture
- **Étant donné** le gérant qui saisit une plage
- **Quand** l'heure de fermeture est avant l'heure d'ouverture, ou la même
- **Alors** l'enregistrement est refusé avec un message d'erreur (APP_FLOW F-M2 ; `closes_at > opens_at`)

### 5. Copier sur la semaine
- **Étant donné** le lundi avec des plages enregistrées
- **Quand** le gérant clique sur « Copier sur la semaine » depuis le lundi
- **Alors** les plages du lundi sont reproduites sur les autres jours de la semaine (portée exacte : voir questions ouvertes)

### 6. Aucun jour ouvert
- **Étant donné** des horaires sans aucune plage, quel que soit le jour
- **Quand** le gérant enregistre
- **Alors** un message indique qu'au moins un jour ouvert est nécessaire (APP_FLOW F-M2)
- **Alors** le bouton « Publier mon salon » reste inactif (F-M3 ; BACKEND_SCHEMA §4.7)

### 7. Fermeture exceptionnelle
- **Étant donné** le gérant sur `/dashboard/hours` ou à l'étape « Horaires » du wizard
- **Quand** il saisit une fermeture exceptionnelle « du » 24/12 « au » 26/12 avec un motif, puis enregistre
- **Alors** la fermeture est enregistrée avec ses dates et son motif
- **Alors** pendant cette période, la file du salon n'accepte aucun nouveau ticket (état « Fermée », PRD §5.2)

### 8. Fermeture exceptionnelle d'un seul jour
- **Étant donné** le gérant qui saisit une fermeture
- **Quand** la date « au » est égale à la date « du »
- **Alors** la fermeture est enregistrée pour ce seul jour

### 9. Dates de fermeture incohérentes
- **Étant donné** le gérant qui saisit une fermeture
- **Quand** la date « au » est avant la date « du »
- **Alors** l'enregistrement est refusé avec un message d'erreur

### 10. Motif de fermeture trop long
- **Étant donné** le gérant qui saisit une fermeture
- **Quand** le motif dépasse 120 caractères
- **Alors** l'enregistrement est refusé avec un message d'erreur

### 11. Modification après la configuration
- **Étant donné** un salon publié
- **Quand** le gérant modifie une plage sur `/dashboard/hours`
- **Alors** les nouveaux horaires sont enregistrés
- **Alors** la fiche salon côté client affiche les nouveaux horaires

### 12. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** il essaie de lire ou de modifier les horaires ou les fermetures du salon B (par l'API)
- **Alors** la lecture et l'écriture sont refusées

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.hours.title` | « Horaires » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.hours.add_range` | « Ajouter une plage » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.hours.copy_to_week` | « Copier sur la semaine » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.hours.closures.title` | « Fermetures exceptionnelles » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.hours.closures.from` | « Du » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.hours.closures.to` | « Au » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.hours.closures.reason` | « Motif » | 120 caractères maximum |
| `errors.validation.hours_order` | — (à rédiger) | Fermeture avant ou égale à l'ouverture |
| `errors.validation.hours_overlap` | — (à rédiger) | Plages qui se chevauchent |
| `errors.validation.at_least_one_open_day` | — (à rédiger) | — |
| `errors.validation.closure_dates` | — (à rédiger) | Date de fin avant la date de début |
| `errors.validation.closure_reason_length` | — (à rédiger) | 120 caractères maximum |

## Questions ouvertes
- **APP_FLOW** : que copie exactement « Copier sur la semaine » ? Vers les 7 jours, les jours ouvrés, ou seulement les jours sans plage ? Les plages déjà saisies sont-elles remplacées ?
- **APP_FLOW / BACKEND_SCHEMA** : la règle « au moins un jour ouvert » bloque-t-elle l'enregistrement (APP_FLOW F-M2) ou seulement la publication (BACKEND_SCHEMA §4.7) ?
- **PRD** : que se passe-t-il si une fermeture exceptionnelle couvre aujourd'hui alors que la file est ouverte et a des tickets actifs ? Même question si les horaires du jour changent alors que la file est ouverte (effet sur l'état « Complète » et sur la fenêtre de fin de journée H9).
- **PRD** : quand un jour a plusieurs plages (par exemple une coupure à midi), la fin de journée H9 (alerte 2 h avant, décision du gérant, annulation 15 min après) s'applique-t-elle à la fin de chaque plage ou seulement à la dernière ? `queue-tick` ouvre-t-il et ferme-t-il la file à chaque plage ?
- **APP_FLOW** : la « prochaine ouverture » affichée sur une file fermée (F-C2 « Fermé · ouvre demain à 9h00 ») tient-elle compte des fermetures exceptionnelles ?
- **BACKEND_SCHEMA** : `opening_hours.weekday` va de 1 à 7. Le 1, c'est le lundi (norme ISO) ?
- **TRD / BACKEND_SCHEMA** : les changements d'horaires sont écrits directement sous RLS. Sont-ils inscrits au journal du salon (`settings_updated`) ? Si oui, qui écrit l'événement ?
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.
