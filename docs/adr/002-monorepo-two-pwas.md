# ADR-002 — Monorepo et deux applications PWA

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Zelaté comporte une application destinée aux clients et Zelaté Pro pour le personnel. Elles partagent des composants et des paquets, mais ont des besoins distincts de manifeste, d'icône, de cache et d'installation.

## Décision

Maintenir un monorepo avec deux applications PWA distinctes, `apps/client` et `apps/pro`, et partager le code commun dans des paquets.

Déployer les applications comme deux projets et deux origines distincts, par exemple `zelate.fr` et `pro.zelate.fr`.

## Conséquences

- Chaque PWA possède son propre manifeste, son icône, son service worker, son stockage et sa portée d'installation.
- Les paquets partagés évitent de dupliquer les composants et les contrats.
- Les deux applications ne s'importent pas l'une l'autre.

## Référence

Décision source : [TRD §5, ADR-002](../TRD.md#5-décisions-darchitecture-adr). L'hébergement est précisé dans [TRD §3](../TRD.md#3-stack).
