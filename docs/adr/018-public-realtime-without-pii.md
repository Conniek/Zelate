# ADR-018 — Temps réel public sans donnée personnelle

- **Statut :** Acceptée (18/10, K6)
- **Décideur :** Koni

## Contexte

La fiche publique d'un salon et la page de suivi par lien doivent se mettre à jour sans exiger une session, sans diffuser de données personnelles.

## Décision

Utiliser deux canaux Broadcast publics :

- `salon-public:{salon_id}` pour la fiche salon ;
- `ticket-token:{token_key}` pour `/t/:shortCode`, où `token_key` est dérivé du jeton de suivi par un SHA-256 tronqué et n'est connu que du porteur du lien.

Les messages ne contiennent que `{ version }`. La page relit les données par RPC ou via `ticket-public`.

## Conséquences

- La charge utile temps réel ne contient pas de donnée personnelle ou d'état métier détaillé.
- Les clients sans session peuvent recevoir les invalidations, puis relire les données par le chemin prévu.

## Référence

Décision source : [TRD §5, ADR-018](../TRD.md#5-décisions-darchitecture-adr), K6.
