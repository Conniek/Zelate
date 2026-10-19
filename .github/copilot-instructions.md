# Zelaté — instructions for GitHub Copilot

Zelaté is a virtual queue for hair salons. Clients join a nearby salon's queue, or come for an appointment, and follow their real waiting time. Stylists call, start and finish clients from their phone. The salon manager runs the queue from a dashboard. There are two installable PWAs: **Zelaté** (clients) and **Zelaté Pro** (stylists, managers, platform admin). France only, French UI.

These rules mirror `CLAUDE.md`. If the two files disagree, `CLAUDE.md` wins and this file must be updated.

## Current state

- **Phase 2 is closed (19/10/2026).** All business and technical questions are decided: E1-E39 (Ely) and K1-K45 (Koni). For E32-E39 and K42-K45 the written proposals are the default decisions (`docs/stories/README.md`); Ely may still revise one, nothing waits for her.
- **Next: lot DEV-0 (foundations), then DEV-2 (queue engine).** The pilot is built in two steps: first the core loop (a client joins, a stylist calls, starts and finishes, every wait is recalculated: PRD §2 goal 1), then salon appointments (H10). Figma mockups (DES-1, DES-2) go on in parallel and do not block the code.
- No application code exists yet.

## Read before working

Start with the domain map `.claude/skills/zelate-domain/SKILL.md` (vocabulary, ticket lifecycle, rules, invariants, where each decision lives), then:

In this order, only the parts the task needs:
1. `docs/PRD.md`: business rules (§5.1, §5.2), requirements by ID (§5.3), notifications (§5.4), open questions (§9), decisions log (§11). **Source of truth for business rules.**
2. `docs/APP_FLOW.md`: routes, screens, what each click does.
3. `docs/BACKEND_SCHEMA.md`: tables, columns, enums, access rights.
4. `docs/TRD.md`: technical decisions (ADR), stack, commands and error codes (§6.2), i18n conventions (§9). **Source of truth for technical choices.**
5. `docs/DESIGN_SYSTEM.md`: tokens, components, tone of texts (§8).
6. `docs/IMPLEMENTATION_PLAN.md`: phases, lots, gates, Definition of Done.
7. `docs/stories/`: one user story per requirement, with Given/When/Then scenarios.

## Working rules

1. **Do not block on gaps.** If a rule, screen, column or text is missing, take the simplest option compatible with the docs, write it as one line under « Choix par défaut » in the pull request, and go on. Stop and ask Koni only when the gap touches privacy (phone, tokens, client data) or contradicts the PRD.
2. **Keep documents current.** Any change to a rule, route, schema or decision updates the document in the same pull request, and bumps its version line.
3. **Business rules belong to Ely, technical choices to Koni.** Flag contradictions between documents instead of choosing one.
4. **Language.** Code, file names, identifiers, comments, commits, branches and pull requests in **English**. Documents, user stories and user-facing texts in **French**. User-facing texts live only in `packages/i18n/src/fr/*.json`, never hard-coded.
5. **Privacy.** A client's phone number is never shown to a salon or a stylist. No client data is stored on a stylist's device.
6. **One lot at a time**, in the order of the implementation plan.

## Conventions

- Commits: Conventional Commits (`docs(prd): …`, `feat(i18n): …`). Branches: `docs/…`, `feat/…`, `fix/…`, `chore/…`. Never commit to `main` directly; open a pull request.
- Business IDs: rules H1-H10 and R1-R7, requirements S-, C-, U-, P- (PRD §5.3), screen flows F-C, F-S, F-M, F-A (APP_FLOW), decisions E and K (stories README). Quote them when you change something.
- i18n keys: English `snake_case` segments, the first segment is the file name (`client.join.service.unknown` → `client.json`). ICU variables in `snake_case` (`{first_name}`). Notifications: `notifications.<template>[.<variant>].<push|sms|email>[.<title|body|subject>]`. An SMS fits in 160 GSM-7 characters with variables at maximum length (TRD §9). See `packages/i18n/README.md`.
- French typography in texts: formal "vous", short sentences, action verb first on buttons, times as « 14h30 », always say **why** a time or position changes.

## Writing a user story

Use the prompt `.github/prompts/user-story.prompt.md`. It follows the same template as the `product-analyst` agent in `.claude/agents/product-analyst.md`.
