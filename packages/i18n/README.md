# packages/i18n — dictionnaire de textes

Brouillon du lot **REQ-3** (18/10/2026). Tous les textes affichés par Zelaté et Zelaté Pro vivent ici, jamais dans les composants ([TRD §9](../../docs/TRD.md#9-dictionnaire-de-textes-i18n)). DEV-0 ajoute i18next avec formatage ICU, types des clés et tests de ressources.

## Fichiers

| Fichier                     | Contenu                                                                                       | Chargé par                            |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| `src/fr/common.json`        | Boutons, statuts, unités, jours, formats                                                      | Les deux apps                         |
| `src/fr/client.json`        | Écrans de l'app Zelaté                                                                        | App client                            |
| `src/fr/pro-stylist.json`   | Espace coiffeur                                                                               | App Pro                               |
| `src/fr/pro-manager.json`   | Dashboard gérant et admin                                                                     | App Pro                               |
| `src/fr/notifications.json` | Push, SMS et e-mails                                                                          | Edge Functions (`send-notifications`) |
| `src/fr/errors.json`        | Erreurs métier (`queue.<code>`, `auth.<code>`) et de validation                               | Les deux apps                         |
| `src/fr/legal.json`         | Libellés courts des consentements et liens juridiques ; les textes complets viennent de REQ-4 | Les deux apps                         |

## Conventions

- Le nom du fichier est l'espace de noms : la clé `client.join.service.unknown` s'écrit `{"join":{"service":{"unknown":…}}}` dans `client.json`.
- Segments en `snake_case` anglais ; une clé est un texte ou un groupe, jamais les deux.
- Variables au format ICU (`i18next-icu`), en `snake_case` : `{first_name}`, `{time}`, `{minutes}`, `{count}`. Pluriels : `{count, plural, one {# client} other {# clients}}`.
- Notifications : `<template>.<push|sms|email>[.<title|body|subject>]`, où `<template>` est une valeur de l'enum `notification_template`.
- SMS : 160 caractères GSM-7 au plus avec les variables à leur longueur maximale (prénom 30, nom du salon 40, lien court 21) ; accents translittérés à l'envoi (TRD §9, K5).
- Ton : vouvoiement, phrases courtes, verbe d'action en tête, toujours le pourquoi d'un changement d'heure, heures « 14h30 » ([DESIGN_SYSTEM §8](../../docs/DESIGN_SYSTEM.md#8-textes-et-ton)).

## Relecture

Ely valide les textes des notifications avant la porte 2. Les textes qui dépendent d'une question encore ouverte (E17 à E31, [docs/stories/README.md](../../docs/stories/README.md#questions-ouvertes-après-la-v11)) sont listés dans [`REVIEW.md`](./REVIEW.md).
