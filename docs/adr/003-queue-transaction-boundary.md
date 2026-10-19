# ADR-003 — Écritures de file dans une transaction commune

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Les commandes interactives et les déclenchements planifiés peuvent agir simultanément sur la même file. Une implémentation unique est nécessaire pour appliquer les règles et éviter les courses.

## Décision

Faire passer toutes les écritures de file par `supabase/functions/_shared/queue-transaction`. Le module verrouille le salon avec `pg_advisory_xact_lock`, lit l'état, exécute le moteur TypeScript, applique les écritures et l'outbox dans une transaction Postgres.

Les seuls appelants qui écrivent la file sont `queue-command`, `queue-tick`, `deactivate-member` et `account-delete`. Le client ne modifie jamais directement les tables de file.

## Conséquences

- Une seule implémentation des règles de file et sérialisation des écritures par salon.
- Les écritures ne sont validées que si l'ensemble de la transaction réussit.
- Les opérations de file passent par le serveur et impliquent un aller-retour réseau.

## Référence

Décision source : [TRD §5, ADR-003](../TRD.md#5-décisions-darchitecture-adr) et [BACKEND_SCHEMA](../BACKEND_SCHEMA.md).
