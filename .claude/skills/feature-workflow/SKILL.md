---
name: feature-workflow
description: Implements one Zelaté feature lot or user story from its source documents through tests, code, documentation and validation. Use for feature implementation after DEV-0; do not use for product-rule decisions or multi-lot work.
---

# Zelaté feature workflow

Implement exactly one story or technical task per change.

1. Read `.claude/skills/zelate-domain/SKILL.md`, then the relevant PRD, APP_FLOW, BACKEND_SCHEMA, TRD, DESIGN_SYSTEM and story sections.
2. Confirm the story's user-visible behavior, error cases, privacy constraints, and acceptance tests before editing.
3. If a gap is not about privacy and does not contradict the PRD, choose the simplest compatible default and record it in the pull request under `Choix par défaut`. Stop for Koni only for privacy gaps or contradictions with the PRD.
4. Follow the repository dependency rules: `queue-engine` is pure TypeScript; `contracts` depends only on zod; apps never import each other or `supabase/functions`.
5. Write or update focused tests with the behavior change. Never duplicate queue rules outside `packages/queue-engine`.
6. Keep user-facing French text in `packages/i18n/src/fr/*.json`, with typed keys and ICU variables in `snake_case`.
7. Update the source document and its version when changing a business rule, route, schema, or technical decision.
8. Run `corepack pnpm lint`, `corepack pnpm typecheck`, the focused tests, and `corepack pnpm build` when applicable. Report changed files, tests, defaults and any blocker.

Never include a client's phone number, tracking token, or other client data in staff-visible payloads, logs, realtime messages, or persistent stylist-device storage.
