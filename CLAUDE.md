# Zelaté — instructions for Claude

Zelaté is a virtual queue for hair salons: clients join a nearby salon's queue (or come for an appointment) and follow their real waiting time; stylists call, start and finish clients from their phone; the salon manager runs the queue from a dashboard. Two installable PWAs: **Zelaté** (clients) and **Zelaté Pro** (stylists, managers, platform admin). France only, French UI.

## Current state

- **Phase 2 · Requirements** (see `docs/IMPLEMENTATION_PLAN.md`). No application code yet: code starts at lot DEV-0, after gate 3.
- The repository currently holds the reference documents, the user stories in `docs/stories/` and the `product-analyst` agent only.
- Salon appointments are in scope since `docs/PRD.md` v1.1 (rule H10, decisions R1-R7 and E1-E16 of 18/10/2026). An appointment is a ticket of kind `appointment` handled by the same queue engine (TRD ADR-016).
- Open questions still waiting for an answer are listed in `docs/PRD.md` §9 and `docs/stories/README.md`.

## Read before working

In this order, only the parts the task needs:
1. `docs/PRD.md` — business rules (§5.1, §5.2), requirements by ID (§5.3), decisions log (§11). **Source of truth for business rules.**
2. `docs/APP_FLOW.md` — routes, screens, what each click does.
3. `docs/BACKEND_SCHEMA.md` — tables, columns, access rights.
4. `docs/TRD.md` — technical decisions (ADR), stack, commands, conventions. **Source of truth for technical choices.**
5. `docs/DESIGN_SYSTEM.md` — tokens and components.
6. `docs/IMPLEMENTATION_PLAN.md` — phases, lots, gates, Definition of Done.

## Working rules

1. **Never guess.** A rule, screen, column or dependency missing from the docs is a question to Koni first, then a document update, then the work.
2. **Keep documents current.** Any change to a rule, route, schema or decision updates the document in the same pull request.
3. **Business rules belong to Ely, technical choices to Koni.** Flag contradictions between documents instead of picking one silently.
4. **Language.** Code, file names, identifiers, comments, commits, branches and pull requests in **English**. Documents and user-facing texts in **French**; user-facing texts live only in the i18n dictionary, never hard-coded.
5. **Privacy.** A client's phone number is never shown to a salon or a stylist; no client data is stored on a stylist's device.
6. **One lot at a time**, in the order of the implementation plan.

## Agents

| Agent | Use it for |
| --- | --- |
| `product-analyst` | Turning PRD requirements into testable user stories in `docs/stories/` |

More skills and agents arrive with their lots (see `docs/IMPLEMENTATION_PLAN.md` §2.1).
