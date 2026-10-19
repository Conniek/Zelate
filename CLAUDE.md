# Zelaté — instructions for Claude

Zelaté is a virtual queue for hair salons: clients join a nearby salon's queue (or come for an appointment) and follow their real waiting time; stylists call, start and finish clients from their phone; the salon manager runs the queue from a dashboard. Two installable PWAs: **Zelaté** (clients) and **Zelaté Pro** (stylists, managers, platform admin). France only, French UI.

## Current state

- **Phase 2 is closed (19/10/2026).** All business and technical questions are decided: E1-E39 (Ely) and K1-K45 (Koni). For E32-E39 and K42-K45 the written proposals are the default decisions (`docs/stories/README.md`); Ely may still revise one, nothing waits for her.
- **Next: lot DEV-0 (foundations), then DEV-2 (queue engine).** The pilot is built in two steps: first the core loop (a client joins, a stylist calls, starts and finishes, every wait is recalculated: PRD §2 goal 1), then salon appointments (H10). Figma mockups (DES-1, DES-2) go on in parallel and do not block the code.
- No application code exists yet.

## Read before working

In this order, only the parts the task needs:
1. `docs/PRD.md` — business rules (§5.1, §5.2), requirements by ID (§5.3), decisions log (§11). **Source of truth for business rules.**
2. `docs/APP_FLOW.md` — routes, screens, what each click does.
3. `docs/BACKEND_SCHEMA.md` — tables, columns, access rights.
4. `docs/TRD.md` — technical decisions (ADR), stack, commands, conventions. **Source of truth for technical choices.**
5. `docs/DESIGN_SYSTEM.md` — tokens and components.
6. `docs/IMPLEMENTATION_PLAN.md` — phases, lots, gates, Definition of Done.

## Working rules

1. **Do not block on gaps.** If a rule, screen, column or text is missing, take the simplest option compatible with the docs, write it as one line under « Choix par défaut » in the pull request, and go on. Stop and ask Koni only when the gap touches privacy (phone, tokens, client data) or contradicts the PRD.
2. **Keep documents current.** Any change to a rule, route, schema or decision updates the document in the same pull request.
3. **Business rules belong to Ely, technical choices to Koni.** Flag contradictions between documents instead of picking one silently.
4. **Language.** Code, file names, identifiers, comments, commits, branches and pull requests in **English**. Documents and user-facing texts in **French**; user-facing texts live only in the i18n dictionary, never hard-coded.
5. **Privacy.** A client's phone number is never shown to a salon or a stylist; no client data is stored on a stylist's device.
6. **One lot at a time**, in the order of the implementation plan.

## Agents

| Agent | Use it for |
| --- | --- |
| `product-analyst` | Turning PRD requirements into testable user stories in `docs/stories/` |
| `architect` | Reviewing the technical design (schema, ADRs, commands, RLS) against the PRD and stories; writing ADR files in `docs/adr/` (lot DES-4) |

| Skill | Use it for |
| --- | --- |
| `zelate-domain` | Map of the business domain: vocabulary, ticket lifecycle, rules H1-H10, appointments, notifications, privacy, invariants, and where each decision lives. Load it before any work on stories, ADRs, schema, engine or tests |

More skills and agents arrive with their lots (see `docs/IMPLEMENTATION_PLAN.md` §2.1).
