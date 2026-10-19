# ADR-014 — Dictionnaires i18n typés

- **Statut :** Acceptée (14/10)
- **Décideur :** Koni

## Contexte

Les textes doivent être centralisés, cohérents entre les applications et vérifiables statiquement, plutôt que dispersés dans les composants.

## Décision

Gérer les textes dans des fichiers JSON par typologie, avec des clés en anglais dont les types sont dérivés des ressources. Utiliser i18next et react-i18next ; le MVP charge uniquement le français.

## Conséquences

- Le code d'interface référence des clés typées plutôt que des textes affichés codés en dur.
- Les ressources restent organisées par application et typologie ; les conventions sont détaillées dans [TRD §9](../TRD.md#9-internationalisation).

## Référence

Décision source : [TRD §5, ADR-014](../TRD.md#5-décisions-darchitecture-adr).
