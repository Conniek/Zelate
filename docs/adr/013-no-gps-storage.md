# ADR-013 — Ne pas stocker la position GPS du client

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

La position précise n'est nécessaire que pour trouver les salons à proximité ; la conserver augmenterait les données personnelles traitées.

## Décision

Ne pas stocker la position GPS du client. La transmettre uniquement comme paramètres de la RPC de recherche de proximité.

## Conséquences

- La position n'est utilisée que pour répondre à la recherche en cours.
- La base ne conserve pas d'historique GPS des clients.

## Référence

Décision source : [TRD §5, ADR-013](../TRD.md#5-décisions-darchitecture-adr).
