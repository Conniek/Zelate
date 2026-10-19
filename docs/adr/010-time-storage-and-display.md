# ADR-010 — Stockage et affichage des dates

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Les horaires du salon, le passage à l'heure d'été ou d'hiver et la fermeture à minuit exigent une convention temporelle uniforme.

## Décision

Stocker les instants en `timestamptz` UTC et les afficher dans le fuseau `Europe/Paris`. La journée de service d'un ticket est une date calculée selon l'heure de Paris.

## Conséquences

- Les comparaisons et conversions horaires passent par une fonction utilitaire unique.
- Les règles de journée de service ne dépendent pas du fuseau de l'appareil du client ou du membre.

## Référence

Décision source : [TRD §5, ADR-010](../TRD.md#5-décisions-darchitecture-adr).
