# ADR-006 — Suivi de ticket par jeton

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Un client doit pouvoir consulter et annuler son ticket depuis un lien SMS, y compris sans session ouverte sur l'appareil utilisé.

## Décision

Chaque ticket dispose d'un `tracking_token` aléatoire de 32 octets. Le SMS contient un lien court `/t/:shortCode` (code de 8 caractères). `ticket-public` échange ce code contre le jeton ; la page conserve le jeton en mémoire pour les commandes et le temps réel.

## Conséquences

- Le lien permet le suivi sans session et l'annulation du ticket.
- Le jeton est un secret : ne jamais le journaliser ni l'inclure dans une URL partagée par l'application en dehors du lien SMS.

## Référence

Décision source : [TRD §5, ADR-006](../TRD.md#5-décisions-darchitecture-adr), notamment K5.
