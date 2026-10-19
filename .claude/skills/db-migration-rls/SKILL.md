---
name: db-migration-rls
description: Designs and validates a single Supabase Postgres migration, RLS policy, database function or pgTAP test for Zelaté. Use before changing schema, permissions, indexes or database behavior.
---

# Zelaté database migration and RLS workflow

Before authoring SQL, read `.claude/skills/zelate-domain/SKILL.md`, `.claude/skills/supabase-postgres-best-practices/SKILL.md`, the relevant `docs/BACKEND_SCHEMA.md` sections and TRD §6-8.

1. Follow the migration order in BACKEND_SCHEMA §12; never edit an already-applied migration.
2. Use a new timestamped migration and keep the schema document/version aligned with any approved schema change.
3. Enable RLS on every exposed `public` table. Define explicit least-privilege policies for `anon`, `authenticated` and service-side access; do not expose `private`.
4. Test cross-salon isolation, unauthorized writes, and sensitive-column visibility with pgTAP. Include both allowed and denied cases.
5. Keep queue writes behind the shared server transaction module and preserve its lock, engine, transaction and outbox ordering.
6. Index columns used by policies and frequently filtered or joined foreign keys where justified; validate assumptions with query plans when practical.
7. No client phone, tracking token, or staff-hidden field may leak through a view, RPC, Realtime payload, error, or log.
8. Run `PATH="$HOME/.docker/bin:$PATH" supabase test db` after Docker Desktop is running. If Docker or images are unavailable, report that validation blocker explicitly; do not claim database tests passed.
