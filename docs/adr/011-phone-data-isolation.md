# ADR-011 — Isolation des numéros de téléphone

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Les salons et leur personnel ne doivent pas accéder au numéro de téléphone du client, conformément à H6 et aux règles de confidentialité du produit.

## Décision

Le numéro du client connecté reste dans `auth.users`. Pour chaque ticket dont le numéro est connu (client connecté, inscription au comptoir, rendez-vous saisi avec téléphone ou rendez-vous signalé), conserver les coordonnées dans `private.ticket_contacts`, inaccessible par l'API. Les SMS sont envoyés uniquement depuis les Edge Functions.

L'unicité d'un ticket actif par numéro repose sur une empreinte du numéro et un index unique, qui exclut les tickets `pending_confirmation`. La fusion de tickets clôt le contact du ticket annulé.

## Conséquences

- Les tables lues par le personnel n'exposent pas les numéros.
- Les accès aux coordonnées sont limités au backend nécessaire à l'envoi des SMS.
- La base garantit l'unicité des tickets actifs selon cette règle.

## Référence

Décision source : [TRD §5, ADR-011](../TRD.md#5-décisions-darchitecture-adr), notamment K28 et K14 ; règle métier H6 dans [PRD §5.1](../PRD.md).
