# ADR-017 — Calcul du prochain créneau libre par le moteur

- **Statut :** Proposition de DES-4 dans le TRD ; choix de travail par défaut selon `docs/stories/README.md`
- **Décideur :** Koni (choix technique) ; E22 dans les décisions métier

## Contexte

La recherche de salons doit afficher le prochain créneau disponible sans refaire le calcul de file dans le navigateur.

## Décision

Calculer les prochains créneaux libres dans le moteur à chaque commande et à chaque `queue-tick`, puis les stocker dans `salons.next_free_slots`, par prestation et sans choix de coiffeur. Vider cette valeur lorsque la file n'est pas ouverte.

Le moteur stocke également `salons.is_full` ; l'interface lit ce résultat sans recalculer la disponibilité.

La marge par défaut est de 0 minute. `slot_margin_minutes` reste un paramètre du moteur pour une éventuelle révision après le pilote.

## Conséquences

- La recherche des salons reste une lecture simple.
- L'interface ne calcule pas les disponibilités et ne doit pas les interpréter comme une réservation.
- Le TRD marque la décision `🟡 DES-4` ; cette fiche conserve ce statut et la décrit comme proposition par défaut, non comme validation formelle.

## Références

Décision source : [TRD §5, ADR-017](../TRD.md#5-décisions-darchitecture-adr), E22 et K36 dans [les décisions des stories](../stories/README.md).
