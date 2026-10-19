# ADR-016 — Rendez-vous représenté comme ticket

- **Statut :** Proposition de DES-4 dans le TRD ; choix de travail par défaut selon les décisions consignées dans `docs/stories/README.md`
- **Décideur :** Koni (choix technique) ; règles métier associées dans le PRD

## Contexte

Les rendez-vous du salon doivent être ordonnés avec les clients de dernière minute et partager leur suivi, leurs notifications et leur journal, sans être retardés par ces clients.

## Décision

Représenter un rendez-vous comme un ticket de type `appointment`, avec `scheduled_at` et un coiffeur fixé dès la saisie. Utiliser le même moteur pour ordonner rendez-vous et clients de dernière minute.

Un rendez-vous signalé par le client à son arrivée est créé avec le statut `pending_confirmation` et reste hors du calcul jusqu'à confirmation du salon.

## Conséquences

- Le moteur place les clients de dernière minute dans les trous disponibles sans retarder un rendez-vous.
- Rendez-vous et tickets partagent la source de vérité, le suivi, les notifications et le journal.
- La décision est indiquée `🟡 DES-4` dans le TRD ; cette fiche la documente comme proposition par défaut, sans la présenter comme une décision formellement validée dans le TRD.

## Références

Décision source : [TRD §5, ADR-016](../TRD.md#5-décisions-darchitecture-adr), règle H10 du [PRD §5.2](../PRD.md) et [décisions par défaut des stories](../stories/README.md).
