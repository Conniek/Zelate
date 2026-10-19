# ADR-007 — Appareil et session du coiffeur

- **Statut :** Acceptée (16/10)
- **Décideur :** Koni

## Contexte

Le pilote doit permettre au coiffeur de travailler depuis son propre téléphone sans que des données client persistent sur un appareil partagé.

## Décision

Au lot 1, chaque coiffeur utilise Zelaté Pro sur son téléphone et avec son compte personnel. Le compte est activé par invitation par e-mail ; la connexion se fait par lien magique et la session dure 30 jours, révocable par le gérant.

Aucune donnée client n'est stockée sur l'appareil : le cache TanStack Query reste en mémoire et le service worker ne met en cache que les fichiers statiques. L'appairage d'une tablette partagée et son déverrouillage par PIN sont reportés au lot 2.

## Conséquences

- Chaque commande est attribuée au compte connecté.
- L'espace coiffeur est conçu d'abord pour le téléphone.
- Le MVP ne nécessite pas de matériel partagé à fournir aux salons.

## Référence

Décision source : [TRD §5, ADR-007](../TRD.md#5-décisions-darchitecture-adr) et annexe A.
