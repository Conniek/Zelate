#!/usr/bin/env bash
# Local only (TRD §11): gives pg_cron the address and secret of the Edge
# Functions, so `queue-tick` runs every minute as in production (estimates,
# free slots, end of day, no-shows). Without it the jobs are a silent no-op.
# Run again after each `supabase db reset`. Never used on a hosted project.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.docker/bin:$PATH"

secret=$(grep '^CRON_SECRET=' supabase/functions/.env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$secret" ] || [ "$secret" = "REPLACE_ME" ]; then
  echo "CRON_SECRET is missing in supabase/functions/.env (see supabase/functions/.env.example)." >&2
  exit 1
fi
container=$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n 1 || true)
if [ -z "$container" ]; then
  echo "Local Supabase is not running: start it with 'supabase start'." >&2
  exit 1
fi

docker exec -i "$container" psql -q -U postgres -d postgres -v ON_ERROR_STOP=1 -v secret="$secret" >/dev/null <<'SQL'
delete from vault.secrets where name in ('edge_functions_url', 'cron_secret');
select vault.create_secret('http://host.docker.internal:54321/functions/v1', 'edge_functions_url');
select vault.create_secret(:'secret', 'cron_secret');
SQL
echo "Local jobs enabled: queue-tick runs every minute while 'supabase functions serve' is running."
