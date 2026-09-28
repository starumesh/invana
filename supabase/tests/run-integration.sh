#!/usr/bin/env bash
# Integration test for the event-management Edge repository: throwaway Postgres DB
# (migrations + local stubs) + PostgREST + `deno test`. Requires psql, postgrest, deno.
# Usage: PGURL=postgres://postgres@localhost/postgres supabase/tests/run-integration.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_URL="${PGURL:-postgres:///postgres}"
export PGOPTIONS="-c client_min_messages=warning"
DB="invana_it_$$"
PORT="${EM_IT_PORT:-3999}"
SECRET="local-integration-secret-at-least-32-chars"
PGRST_PID=""
cleanup() {
  [ -n "$PGRST_PID" ] && kill "$PGRST_PID" 2>/dev/null || true
  psql "$ADMIN_URL" -qc "drop database if exists $DB" >/dev/null
}
trap cleanup EXIT

psql "$ADMIN_URL" -qc "create database $DB" >/dev/null
DB_URL="${ADMIN_URL%/*}/$DB"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f tests/local_stubs.sql >/dev/null
for f in migrations/*.sql; do
  case "$f" in *_storage.sql|*_media_2mb.sql) ;; *) psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null;; esac
done
psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'em_it_authenticator') then
    create role em_it_authenticator login password 'em_it' noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to em_it_authenticator;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'host@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'door@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'nosy@example.com');
SQL

PGRST_DB_URI="postgres://em_it_authenticator:em_it@localhost/$DB" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$SECRET" \
PGRST_SERVER_PORT="$PORT" "${POSTGREST_BIN:-postgrest}" >/tmp/em-postgrest.log 2>&1 &
PGRST_PID=$!
for _ in $(seq 1 50); do curl -fs "http://localhost:$PORT/" >/dev/null 2>&1 && break; sleep 0.2; done

JWT=$(deno eval --no-lock --quiet "
const enc = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const data = enc({ alg: 'HS256', typ: 'JWT' }) + '.' + enc({ role: 'service_role', exp: Math.floor(Date.now() / 1000) + 3600 });
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('$SECRET'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
console.log(data + '.' + btoa(String.fromCharCode(...sig)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'));
")

EM_IT_REST_URL="http://localhost:$PORT" EM_IT_JWT="$JWT" \
  deno test --no-lock --allow-net --allow-env functions/event-management/integration_test.ts
