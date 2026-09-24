-- Invana V1 schema (Connected Mode)
-- Apply via Supabase SQL editor or `supabase db push`.
-- auth.users is the canonical users table (Supabase Auth).
-- public.profiles extends auth.users with display fields.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- events (config jsonb = RenderInput)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('invitation', 'card')),
  event_type text,
  card_type text,
  template_id text not null,
  title text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_slug_unique unique (slug)
);

create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_status_idx on public.events (status);
create index if not exists events_slug_lower_idx on public.events (lower(slug));

-- ---------------------------------------------------------------------------
-- event_media (binaries live in Storage; this is metadata only)
-- ---------------------------------------------------------------------------
create table if not exists public.event_media (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null default 'event-media',
  path text not null,
  mime_type text,
  byte_size integer,
  width integer,
  height integer,
  role text default 'gallery',
  created_at timestamptz not null default now()
);

create index if not exists event_media_event_id_idx on public.event_media (event_id);

-- ---------------------------------------------------------------------------
-- event_guests (host-managed list; optional for bulk WhatsApp)
-- ---------------------------------------------------------------------------
create table if not exists public.event_guests (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  phone text,
  email text,
  opted_in boolean not null default false,
  token text unique,
  created_at timestamptz not null default now()
);

create index if not exists event_guests_event_id_idx on public.event_guests (event_id);

-- ---------------------------------------------------------------------------
-- rsvps
-- ---------------------------------------------------------------------------
create table if not exists public.rsvps (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  guest_name text not null,
  response text not null check (response in ('yes', 'no', 'maybe')),
  party_size integer not null default 1 check (party_size >= 1 and party_size <= 50),
  phone text,
  email text,
  dietary text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists rsvps_event_id_idx on public.rsvps (event_id);

-- ---------------------------------------------------------------------------
-- rsvp_questions / rsvp_answers (custom questions)
-- ---------------------------------------------------------------------------
create table if not exists public.rsvp_questions (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null,
  field_type text not null default 'text',
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rsvp_answers (
  id text primary key,
  rsvp_id text not null references public.rsvps (id) on delete cascade,
  question_id text not null references public.rsvp_questions (id) on delete cascade,
  value text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- exports (generated asset metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.exports (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  format text not null check (format in ('png', 'jpeg', 'pdf', 'svg')),
  bucket text,
  path text,
  scale numeric,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- themes (optional saved theme presets per user)
-- ---------------------------------------------------------------------------
create table if not exists public.themes (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  tokens jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- messaging (WhatsApp Cloud API campaigns + delivery)
-- ---------------------------------------------------------------------------
create table if not exists public.message_campaigns (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null default 'whatsapp',
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'sending', 'completed', 'failed')),
  template_name text,
  body text,
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_recipients (
  id text primary key,
  campaign_id text not null references public.message_campaigns (id) on delete cascade,
  guest_id text references public.event_guests (id) on delete set null,
  phone text not null,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'delivered', 'read', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_logs (
  id text primary key,
  campaign_id text references public.message_campaigns (id) on delete set null,
  recipient_id text references public.message_recipients (id) on delete set null,
  provider_message_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists message_logs_provider_id_idx
  on public.message_logs (provider_message_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists message_campaigns_set_updated_at on public.message_campaigns;
create trigger message_campaigns_set_updated_at
  before update on public.message_campaigns
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
