# ADR-008 — Envoi des notifications par outbox

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Une notification ne doit pas partir si la transaction métier qui l'a produite est annulée, et les échecs d'envoi doivent pouvoir être retentés.

## Décision

Les commandes insèrent une ligne de notification au statut `pending` dans la même transaction que les changements métier. `send-notifications` envoie ensuite les lignes de l'outbox.

Le traitement peut tourner par cron ou après une commande. Il réserve les lignes avec `select … for update skip locked` et contrôle le plafond SMS sous un verrou par ticket. Le consentement et les plafonds s'appliquent aux notifications des clients.

## Conséquences

- Pas d'envoi pour une transaction annulée ; les envois peuvent être retentés.
- Un délai de l'ordre de la seconde est attendu.
- Plusieurs travailleurs peuvent traiter l'outbox sans réserver la même ligne.

## Référence

Décision source : [TRD §5, ADR-008](../TRD.md#5-décisions-darchitecture-adr), notamment K37.
