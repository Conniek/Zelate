# ADR-019 — Révocation des sessions en quinze minutes au plus

- **Statut :** Acceptée (18/10, K4)
- **Décideur :** Koni

## Contexte

Un membre peut perdre son téléphone ou quitter un salon. Ses commandes et lectures doivent cesser d'être autorisées rapidement après révocation.

## Décision

Utiliser des jetons d'accès de 15 minutes au plus. Chaque commande vérifie côté serveur que le membre est actif et que sa session n'a pas été révoquée ; les RPC de lecture appliquent le même contrôle.

L'application affiche l'écran de connexion dès le premier refus, ou au plus tard au rafraîchissement du jeton. Le serveur ne ferme pas les canaux Realtime d'un membre révoqué : les refus des commandes et lectures suffisent, les messages diffusés ne contenant que `{ version }`.

## Conséquences

- Une session révoquée cesse d'autoriser commandes et lectures en 15 minutes au plus.
- Les canaux Realtime peuvent rester ouverts ; ils ne transportent pas de données métier ou personnelles.

## Référence

Décision source : [TRD §5, ADR-019](../TRD.md#5-décisions-darchitecture-adr), K4 et K41.
