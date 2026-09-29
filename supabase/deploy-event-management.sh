#!/usr/bin/env bash
# Apply the Event Management migrations and deploy the event-management Edge Function
# to the live Supabase project.
#
# Required:
#   SUPABASE_ACCESS_TOKEN   Personal access token (Dashboard → Account → Access Tokens)
#   SUPABASE_DB_URL         Postgres connection string with the DB password
#                           (Dashboard → Project Settings → Database → Connection string → URI,
#                           "Session pooler" works from IPv4-only machines)
# Optional:
#   SUPABASE_PROJECT_REF    default: innwdfxqqnookmwbsgjy (the project the live site uses)
#   EM_MAX_CAPACITY         default: 10000
#
# The SQL files are idempotent and applied with psql directly, so this does not depend on
# the CLI migration history (earlier migrations were applied through the SQL editor).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (postgres://postgres.<ref>:<password>@<host>:5432/postgres)}"
REF="${SUPABASE_PROJECT_REF:-innwdfxqqnookmwbsgjy}"
export SUPABASE_ACCESS_TOKEN

for f in supabase/migrations/20260928000000_event_management.sql supabase/migrations/20260929000000_em_pass_holder.sql; do
  echo "Applying $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -qc "notify pgrst, 'reload schema';"

npx -y supabase@latest secrets set --project-ref "$REF" "EM_MAX_CAPACITY=${EM_MAX_CAPACITY:-10000}"
npx -y supabase@latest functions deploy event-management --project-ref "$REF"

echo "Checking the deployed function…"
curl -fsS "https://$REF.supabase.co/functions/v1/event-management/config" \
  -H "apikey: ${SUPABASE_ANON_KEY:-}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY:-}" || \
  echo "(set SUPABASE_ANON_KEY to smoke-test the gateway; deploy itself succeeded)"
echo
echo "Done: migrations applied and event-management deployed to $REF."
