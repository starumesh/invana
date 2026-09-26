-- Phase 1 logical services support: rate-limit buckets + RSVP outbox.
-- Apply after 20260324000002_storage.sql

-- ---------------------------------------------------------------------------
-- api_rate_buckets — fixed-window counters for public Edge routes
-- ---------------------------------------------------------------------------
create table if not exists public.api_rate_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_buckets_window_start_idx
  on public.api_rate_buckets (window_start);

alter table public.api_rate_buckets enable row level security;
-- No policies for anon/authenticated — Edge Functions use the service role only.

-- ---------------------------------------------------------------------------
-- outbox_events — durable hooks for async workers (email, OG, etc.)
-- V1: rows are written on RSVP create; no consumer yet (dashboard-only notify).
-- ---------------------------------------------------------------------------
create table if not exists public.outbox_events (
  id text primary key,
  topic text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists outbox_events_unprocessed_idx
  on public.outbox_events (created_at)
  where processed_at is null;

create index if not exists outbox_events_topic_idx
  on public.outbox_events (topic);

alter table public.outbox_events enable row level security;
-- Service role only until a Jobs worker owns this aggregate.

-- Optional cleanup helper (manual / cron): delete rate buckets older than 2 hours.
-- select count(*) from public.api_rate_buckets where window_start < now() - interval '2 hours';
