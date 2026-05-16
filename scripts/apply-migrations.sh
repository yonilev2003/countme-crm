#!/usr/bin/env bash
# Apply all SQL migrations in order to the Supabase project.
#
# Usage:
#   export DATABASE_URL='postgresql://postgres.fsbgxtmxvhxmmtcflmug:[YOUR-PASSWORD]@aws-X-eu-central-1.pooler.supabase.com:6543/postgres'
#   ./scripts/apply-migrations.sh
#
# Get the connection string from:
#   https://supabase.com/dashboard/project/fsbgxtmxvhxmmtcflmug/settings/database
# (use the "Session pooler" connection string with your DB password substituted)
#
# Flags:
#   --skip-reset    Skip 0000_reset.sql (use when DB is already clean)

set -euo pipefail

SKIP_RESET=0
for arg in "$@"; do
  case "$arg" in
    --skip-reset) SKIP_RESET=1 ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  cat >&2 <<'EOF'
Error: DATABASE_URL is not set.

Get the connection string from:
  https://supabase.com/dashboard/project/fsbgxtmxvhxmmtcflmug/settings/database

Use the "Session pooler" string (or "Direct connection") and replace
[YOUR-PASSWORD] with the database password.

Then:
  export DATABASE_URL='postgresql://...'
  ./scripts/apply-migrations.sh
EOF
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Error: psql not found in PATH.

Install:
  macOS:   brew install libpq && brew link --force libpq
  Ubuntu:  sudo apt install postgresql-client
  Windows: choco install postgresql
EOF
  exit 1
fi

HERE="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="$HERE/supabase/migrations"

apply() {
  local file="$1"
  echo ""
  echo "==> Applying $file"
  PGSSLMODE=require psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATIONS/$file"
}

if [[ "$SKIP_RESET" -eq 0 ]]; then
  echo "==> Running destructive reset (drops all CRM tables/types in public schema)"
  echo "    Pass --skip-reset to skip this step."
  read -r -p "    Continue? [y/N] " yn
  if [[ ! "$yn" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
  apply 0000_reset.sql
fi

apply 0001_initial_schema.sql
apply 0002_rls_policies.sql
apply 0003_storage_buckets.sql
apply 0004_realtime_publication.sql

echo ""
echo "==> All migrations applied. Verifying schema..."
PGSSLMODE=require psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
\echo
\echo 'Tables in public schema:'
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

\echo
\echo 'Enums in public schema:'
select t.typname from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typtype = 'e'
order by t.typname;

\echo
\echo 'Tables in supabase_realtime publication:'
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime' order by tablename;
SQL

echo ""
echo "==> Done. Expected: 11 tables, 6 enums, 3 realtime-published tables."
