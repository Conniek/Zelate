# ADR-012 — Recherche de proximité avec PostGIS

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

L'application client doit rechercher les salons proches et les classer par distance, tout en permettant une requête efficace.

## Décision

Utiliser PostGIS avec des coordonnées `geography`, un index GiST et `ST_DWithin`. La recherche applique un rayon de 5 km et trie les résultats par distance.

## Conséquences

- L'extension PostGIS doit être activée dans la base.
- La proximité est calculée côté serveur dans une requête spatiale indexée.

## Référence

Décision source : [TRD §5, ADR-012](../TRD.md#5-décisions-darchitecture-adr).
