# S-03 · Horaires d'ouverture et fermetures exceptionnelles

**En tant que** gérant, **je veux** définir les horaires d'ouverture de mon salon (plusieurs plages par jour possibles), les copier sur la semaine et déclarer des fermetures exceptionnelles, **afin que** la file et les clients suivent les vrais horaires du salon.

- Priorité : I (PRD §5.3)
- Règles appliquées : PRD §5.2 États de la file (« Fermée » avec la prochaine ouverture, « Ouverte » et « Complète » calculés par rapport à la fermeture) ; H9 (la fin de journée se calcule par rapport à la dernière fermeture de la journée, E5) ; un changement d'horaires dans la journée ne modifie pas les tickets déjà en file, et les nouveaux horaires comptent pour la fin de journée (PRD §5.1, §11 E16)
- Parcours : F-M2 « Horaires », F-M11 `/dashboard/hours` ; affichage côté client F-C2 « Horaires »
- Commandes et données : écriture directe du gérant sous RLS, limitée par colonne (TRD §6.3, tables de configuration, K32) · tables `opening_hours` (`weekday`, `opens_at`, `closes_at`), `salon_closures` (`starts_on`, `ends_on`, `reason`), `salon_events` (`settings_updated`, écrit par le déclencheur `log_settings_update()`, BACKEND_SCHEMA §4.15)

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

### 2 bis. Fin de journée calculée sur la dernière plage

- **Étant donné** un lundi avec les plages 09:00-12:00 et 14:00-19:00, et la fenêtre d'alerte par défaut de 2 h
- **Quand** il est 10:00, soit 2 h avant la fin de la première plage
- **Alors** aucune alerte de fin de journée n'est envoyée (H9 : « dernière fermeture de la journée », E5)
- **Quand** il est 17:00, soit 2 h avant 19:00
- **Alors** la fenêtre de fin de journée commence (détail dans S-15)

### 2 ter. La coupure de midi n'annule rien

- **Étant donné** un lundi avec les plages 09:00-12:00 et 14:00-19:00, et des clients encore en attente à 12:00
- **Quand** il est 12:15
- **Alors** aucun ticket n'est annulé : la file reprend à la plage suivante (PRD §5.2 « Fin de journée », E24)
- **Alors** les clients en attente gardent leur place

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

### 11 bis. Changement des horaires du jour avec des clients en file

- **Étant donné** un salon dont la file est ouverte aujourd'hui jusqu'à 19:00, avec des tickets en attente
- **Quand** le gérant avance la fermeture du jour à 18:00
- **Alors** les tickets déjà en file ne sont pas modifiés (PRD §5.1, E16)
- **Alors** la fenêtre de fin de journée se calcule à partir de 18:00, soit à partir de 16:00 avec la fenêtre par défaut de 2 h (E16, H9)

### 11 ter. Changement d'horaires inscrit au journal, sans le motif

- **Étant donné** le gérant qui modifie une plage ou ajoute une fermeture exceptionnelle avec le motif « Congés »
- **Quand** l'enregistrement réussit
- **Alors** l'événement `settings_updated` est inscrit au journal du salon, avec le gérant comme acteur (BACKEND_SCHEMA §4.15)
- **Alors** l'événement ne porte que le nom de la table et des colonnes modifiées : ni les heures, ni le motif « Congés » (K10)

### 12. Isolation par salon

- **Étant donné** le gérant du salon A
- **Quand** il essaie de lire ou de modifier les horaires ou les fermetures du salon B (par l'API)
- **Alors** la lecture et l'écriture sont refusées

## Textes à prévoir

| Clé (anglais)                             | Texte (français)                                                               | Contrainte                             |
| ----------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| `pro-manager.hours.title`                 | « Horaires »                                                                   | Libellé indicatif (APP_FLOW F-M2)      |
| `pro-manager.hours.add_range`             | « Ajouter une plage »                                                          | Libellé indicatif (APP_FLOW F-M2)      |
| `pro-manager.hours.copy_to_week`          | « Copier sur la semaine »                                                      | Libellé indicatif (APP_FLOW F-M2)      |
| `pro-manager.hours.closures.title`        | « Fermetures exceptionnelles »                                                 | Libellé indicatif (APP_FLOW F-M2)      |
| `pro-manager.hours.closures.from`         | « Du »                                                                         | Libellé indicatif (APP_FLOW F-M2)      |
| `pro-manager.hours.closures.to`           | « Au »                                                                         | Libellé indicatif (APP_FLOW F-M2)      |
| `pro-manager.hours.closures.reason`       | « Motif (facultatif) »                                                         | 120 caractères maximum                 |
| `pro-manager.hours.closures.add`          | « Ajouter une fermeture »                                                      | —                                      |
| `pro-manager.hours.day_closed`            | « Fermé »                                                                      | Jour sans plage                        |
| `errors.validation.hours_order`           | « L'heure de fermeture doit être après l'heure d'ouverture. »                  | Fermeture avant ou égale à l'ouverture |
| `errors.validation.hours_overlap`         | « Ces plages horaires se chevauchent. Modifiez-les pour qu'elles se suivent. » | Plages qui se chevauchent              |
| `errors.validation.at_least_one_open_day` | « Indiquez au moins un jour d'ouverture. »                                     | —                                      |
| `errors.validation.closure_dates`         | « La date de fin ne peut pas être avant la date de début. »                    | Date de fin avant la date de début     |
| `errors.validation.closure_reason_length` | « Le motif ne doit pas dépasser 120 caractères. »                              | 120 caractères maximum                 |

## Questions ouvertes

- **APP_FLOW** : que copie exactement « Copier sur la semaine » ? Vers les 7 jours, les jours ouvrés, ou seulement les jours sans plage ? Les plages déjà saisies sont-elles remplacées ?
- **APP_FLOW / BACKEND_SCHEMA** : la règle « au moins un jour ouvert » bloque-t-elle l'enregistrement (APP_FLOW F-M2) ou seulement la publication (BACKEND_SCHEMA §4.7) ?
- **Résolu le 18/10** (E16, PRD §5.1) : un changement d'horaires dans la journée ne modifie pas les tickets déjà en file ; les nouveaux horaires comptent pour la fin de journée.
- **Résolu le 18/10** (E5, PRD H9) : la fin de journée s'applique à la dernière plage de la journée, pas à chaque plage.
- **PRD** : que se passe-t-il si une fermeture exceptionnelle couvre aujourd'hui alors que la file est ouverte et a des tickets actifs ? E16 parle des horaires, pas des fermetures exceptionnelles. L'état « Complète » est-il aussi recalculé avec les nouveaux horaires ?
- **Résolu le 19/10** (E24, PRD §5.2) : une coupure de midi n'annule aucun ticket ; les clients inscrits restent et la file reprend à la plage suivante.
- **En attente de E32 (Ely)** : BACKEND_SCHEMA §10 dit que `queue-tick` ouvre et ferme la file « selon les horaires », TRD §6.1 ne le dit plus, et le PRD et APP_FLOW ne décrivent qu'une action du gérant. Avec une coupure à midi, la file est-elle fermée puis rouverte automatiquement entre deux plages ?
- **Résolu le 19/10** (E16, PRD §5.1) : un rendez-vous déjà saisi est un ticket déjà en file ; réduire les horaires du jour ne le modifie pas. Reste ouvert le cas d'une fermeture exceptionnelle qui couvre le jour même (question ci-dessus).
- **Résolu le 19/10** (constat 33, BACKEND_SCHEMA v0.5 §4.15) : chaque écriture directe sur les horaires et les fermetures inscrit `settings_updated` au journal du salon par le déclencheur `log_settings_update()`, avec seulement la table et les colonnes modifiées, sans valeur ni motif (K10).
- **APP_FLOW** : la « prochaine ouverture » affichée sur une file fermée (F-C2 « Fermé · ouvre demain à 9h00 ») tient-elle compte des fermetures exceptionnelles ?
- **BACKEND_SCHEMA** : `opening_hours.weekday` va de 1 à 7. Le 1, c'est le lundi (norme ISO) ?
- **Résolu le 18/10** (REQ-3) : les textes sont rédigés dans `packages/i18n/src/fr/` (brouillon à relire, voir `packages/i18n/REVIEW.md`).
