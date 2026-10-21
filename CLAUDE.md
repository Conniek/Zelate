# Zelaté — instructions for Claude

Zelaté is a virtual queue for hair salons: clients join a nearby salon's queue (or come for an appointment) and follow their real waiting time; stylists call, start and finish clients from their phone; the salon manager runs the queue from a dashboard. Two installable PWAs: **Zelaté** (clients) and **Zelaté Pro** (stylists, managers, platform admin). France only, French UI.

## Current state

- **Phase 2 is closed (19/10/2026).** All business and technical questions are decided: E1-E39 (Ely) and K1-K45 (Koni). For E32-E39 and K42-K45 the written proposals are the default decisions (`docs/stories/README.md`); Ely may still revise one, nothing waits for her.
- **DEV-0 to DEV-7 are merged (review fixes and end of day included); the full previews of S-11 and S-13 are on `feat/dev-7-previews`, see `docs/reviews/2026-10-21-dev-7.md`; `/dashboard/salon` is open.** Next: DEV-8. The pilot is built in two steps: first the core loop (a client joins, a stylist calls, starts and finishes, every wait is recalculated: PRD §2 goal 1), then salon appointments (H10). Figma mockups (DES-1, DES-2) go on in parallel and do not block the code.
- Supabase local is running and its API, Studio and Mailpit endpoints respond. Some ports bind to `0.0.0.0`; Studio, pgMeta and analytics have no authentication. Keep the stack on a trusted local network only; never use its shared default keys in production or share `supabase status` output.

## Read before working

Start with `.claude/skills/zelate-domain/SKILL.md` for domain work, then follow the source-document order below.

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

| Agent             | Use it for                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `product-analyst` | Turning PRD requirements into testable user stories in `docs/stories/`                                                                 |
| `architect`       | Reviewing the technical design (schema, ADRs, commands, RLS) against the PRD and stories; writing ADR files in `docs/adr/` (lot DES-4) |

| Skill           | Use it for                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zelate-domain` | Map of the business domain: vocabulary, ticket lifecycle, rules H1-H10, appointments, notifications, privacy, invariants, and where each decision lives. Load it before any work on stories, ADRs, schema, engine or tests |

More skills and agents arrive with their lots (see `docs/IMPLEMENTATION_PLAN.md` §2.1).

## Repository structure

- `apps/client`: client-facing installable PWA.
- `apps/pro`: stylist, manager and platform-admin PWA.
- `packages/ui`: shared accessible UI components, theme and self-hosted fonts.
- `packages/i18n`: French dictionaries, typed namespaces and app-specific i18next setup.
- `packages/config`: shared TypeScript and ESLint configuration.
- `packages/queue-engine`: pure TypeScript queue engine (schedule, distribution, commands, time triggers, notifications); no runtime dependency, imported by the Edge Functions (DEV-2).
- `packages/queue-service`: everything around the engine for `queue-command`, `queue-tick`, `ticket-public` and `preview-presence-change` (validation, who may act, Paris service day, writes, SQL adapter); unit tests on an in-memory fake, integration tests (`test:db`) against the local database in CI (DEV-5).
- `supabase`: local project configuration, migrations, Edge Functions and database tests.
- `docs`: product, technical, screen-flow and implementation sources of truth.

## Commands

- `corepack pnpm install`: install the workspace from the lockfile.
- `corepack pnpm dev`: run both Vite applications (client on port 5173, Pro on 5174).
- `corepack pnpm dev:client` / `corepack pnpm dev:pro`: run one application.
- `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`: quality checks.
- `corepack pnpm test:e2e`: Playwright end-to-end tests (needs `supabase start` and `supabase functions serve`; see `docs/reviews/2026-10-21-dev-4.md`). CI runs them in the « End-to-end tests » job.
- `PATH="$HOME/.docker/bin:$PATH" supabase start`: start local Supabase after Docker Desktop is running.
- `PATH="$HOME/.docker/bin:$PATH" supabase test db`: run database tests after migrations exist.
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres corepack pnpm --filter @zelate/queue-service test:db`: queue-command integration tests against the local database.

Do not commit secrets. Use `.env.example` for variable names and keep local values in an ignored `.env`.
