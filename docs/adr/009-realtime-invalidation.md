# ADR-009 — Temps réel par invalidation et relecture

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Les interfaces doivent refléter les changements de file en temps réel sans exposer de données personnelles dans les messages diffusés.

## Décision

Utiliser Supabase Broadcast sur les canaux privés `salon:{id}` et `ticket:{id}` pour signaler une mise à jour. Les messages ne contiennent pas les données à afficher ; l'interface invalide les données TanStack Query puis les relit avec ses droits habituels.

## Conséquences

- Les droits sont appliqués à la relecture plutôt qu'à la charge utile Broadcast.
- Chaque invalidation entraîne une requête supplémentaire, considérée acceptable au volume du pilote.

## Référence

Décision source : [TRD §5, ADR-009](../TRD.md#5-décisions-darchitecture-adr).
