#!/usr/bin/env bash
# Verify migrations + DB assertions on a throwaway local Postgres database.
# Usage: PGURL=postgres://postgres@localhost/postgres supabase/tests/run-local.sh
# Storage migrations are skipped (vanilla Postgres has no `storage` schema).
set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_URL="${PGURL:-postgres:///postgres}"
export PGOPTIONS="-c client_min_messages=warning"
DB="invana_migration_check_$$"
psql "$ADMIN_URL" -qc "create database $DB" >/dev/null
trap 'psql "$ADMIN_URL" -qc "drop database if exists $DB" >/dev/null' EXIT
DB_URL="${ADMIN_URL%/*}/$DB"

run() { psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$1" >/dev/null; echo "applied $1"; }

run tests/local_stubs.sql
for f in migrations/*.sql; do
  case "$f" in
    *_storage.sql|*_media_2mb.sql) echo "skipped $f (storage schema)";;
    *) run "$f";;
  esac
done
# Idempotency: the event management migrations must re-apply cleanly, in order.
for f in migrations/2026092*_e*.sql; do run "$f"; done
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f tests/event_management_test.sql
