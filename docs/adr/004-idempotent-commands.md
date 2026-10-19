# ADR-004 — Idempotence des commandes

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Un double clic, une connexion instable ou une nouvelle tentative automatique peut envoyer plusieurs fois la même commande.

## Décision

Chaque commande porte un `command_id` de type UUID créé par l'interface. Si le serveur a déjà traité cet identifiant, il renvoie le même résultat au lieu de rejouer les effets de la commande. L'état d'idempotence est conservé dans `private.processed_commands`.

## Conséquences

- La répétition d'une commande identifiée ne répète pas ses écritures ni ses notifications.
- Le module transactionnel commun contrôle et enregistre l'identifiant atomiquement avec la commande.

## Référence

Décision source : [TRD §5, ADR-004](../TRD.md#5-décisions-darchitecture-adr).
