# ADR-015 — Affectation du coiffeur au moment de l'appel

- **Statut :** Acceptée (16/10)
- **Décideur :** Koni

## Contexte

Avant l'appel, la file doit pouvoir estimer le passage sans figer l'affectation d'un client sans préférence et sans imposer des réaffectations prématurées.

## Décision

Pour un ticket sans préférence, ne pas fixer de coiffeur avant l'appel. Le moteur calcule `estimated_member_id` uniquement pour l'estimation et fixe `assigned_member_id` au moment de l'appel. Le coiffeur demandé est conservé dans `requested_member_id`.

Une réaffectation acceptée change `requested_member_id` pour un ticket sans rendez-vous, ou `assigned_member_id` pour un rendez-vous, auquel le coiffeur est affecté dès sa saisie.

## Conséquences

- Le premier coiffeur libre peut prendre un client sans préférence.
- La file d'un coiffeur est calculée à la lecture à partir des tickets qui le demandent et des tickets sans préférence éligibles.

## Référence

Décision source : [TRD §5, ADR-015](../TRD.md#5-décisions-darchitecture-adr), K39 et règle H1 du [PRD §5.2](../PRD.md).
