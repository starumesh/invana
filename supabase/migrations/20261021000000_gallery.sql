-- Gallery photos — guests and hosts upload photos to an invitation or event site.
-- owner_kind: 'invitation' (public.events slug) | 'event' (em_events slug)
-- All writes go through the `gallery` Edge Function (service role) which enforces
-- publication checks, rate limits, and delete-token auth. RLS below is defence in depth.
-- Apply after 20260929010000_em_list_performance.sql

-- ---------------------------------------------------------------------------
-- gallery_photos
-- ---------------------------------------------------------------------------
create table if not exists public.gallery_photos (
  id           text primary key,
  owner_kind   text not null check (owner_kind in ('invitation', 'event')),
  owner_slug   text not null,
  bucket       text not null default 'event-media',
  path         text not null,
  url          text not null,
  contributor_name text not null check (char_length(contributor_name) between 1 and 60),
  contributor_role text not null default 'guest' check (contributor_role in ('host', 'guest')),
  -- One-time token stored client-side so uploaders can delete their own photo.
  -- Never returned after initial upload; compared in constant-time at delete time.
  delete_token text not null,
  created_at   timestamptz not null default now()
);

create index if not exists gallery_photos_owner_idx
  on public.gallery_photos (owner_kind, owner_slug, created_at);

-- ---------------------------------------------------------------------------
-- RLS: public SELECT; all writes are service-role-only (via Edge Function)
-- ---------------------------------------------------------------------------
alter table public.gallery_photos enable row level security;

drop policy if exists "gallery_photos_select_public" on public.gallery_photos;
create policy "gallery_photos_select_public"
  on public.gallery_photos for select
  using (true);

-- Inserts and deletes are handled exclusively by the gallery Edge Function
-- using the service-role key, so no client-facing INSERT/UPDATE/DELETE policy.

-- ---------------------------------------------------------------------------
-- rate_limit bucket (reuse api_rate_buckets from phase 1 migration)
-- ---------------------------------------------------------------------------
-- No schema change needed; api_rate_buckets is already in place.
