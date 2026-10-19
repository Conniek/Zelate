---
name: supabase-postgres-best-practices
description: Reviews Postgres schema, migrations, queries, indexes, RLS, concurrency and database functions using Supabase's maintained guidance. Use before any SQL or database change.
---

# Supabase Postgres best practices

Reviewed and adapted for this project from the Supabase skill pinned in `SOURCE.md`.
The upstream document describes eight priority areas:

1. Query performance and appropriate indexes.
2. Connection management.
3. Security and Row Level Security.
4. Schema design.
5. Concurrency and locking.
6. Data access patterns.
7. Monitoring and diagnostics.
8. Advanced Postgres features.

For detailed, versioned rules and examples, consult the upstream source and references linked in `SOURCE.md`. Apply the parts relevant to the change; do not replace Zelaté's schema or access rules with generic patterns. The project-specific requirements in `docs/TRD.md`, `docs/BACKEND_SCHEMA.md`, and `db-migration-rls` take precedence where they are stricter.
