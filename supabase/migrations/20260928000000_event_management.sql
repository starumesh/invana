-- Event Management, Digital Pass & Attendance.
-- Namespaced `em_*` so the invitation `events` / `event_guests` tables (text ids, RenderInput config)
-- keep working unchanged. A managed event may optionally link to an invitation design via
-- `invite_event_id`.
--
-- Write path: all mutations go through the `event-management` Edge Function (service role),
-- which enforces authorization, validation, rate limits, and audit logging. RLS below grants
-- clients read-only access to their own rows as defense in depth; anon gets nothing.
-- Apply after 20260327000000_media_2mb.sql.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- em_events
-- ---------------------------------------------------------------------------
create table if not exists public.em_events (
  id uuid primary key default gen_random_uuid(),
  public_id text not null,
  name text not null check (char_length(name) between 1 and 120),
  description text not null check (char_length(description) between 1 and 5000),
  -- Free text (not an enum) so new event types need no schema change.
  event_type text not null default 'Other' check (char_length(event_type) between 1 and 60),
  start_datetime timestamptz not null,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 20160),
  venue_name text not null check (char_length(venue_name) between 1 and 200),
  address text not null check (char_length(address) between 1 and 400),
  city text not null check (char_length(city) between 1 and 120),
  state text not null default '' check (char_length(state) <= 120),
  country text not null check (char_length(country) between 1 and 120),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  max_capacity integer not null check (max_capacity > 0 and max_capacity <= 100000),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
  slug text check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  show_guest_bios boolean not null default false,
  show_speakers boolean not null default true,
  invite_event_id text references public.events (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  cancelled_at timestamptz,
  constraint em_events_public_id_unique unique (public_id),
  constraint em_events_public_id_format check (public_id ~ '^INV-EVT-[0-9]{4}-[0-9A-Z]{6}$'),
  constraint em_events_slug_unique unique (slug),
  constraint em_events_published_has_slug check (status <> 'PUBLISHED' or slug is not null)
);

create index if not exists em_events_created_by_idx on public.em_events (created_by, start_datetime);
create index if not exists em_events_status_idx on public.em_events (status);

-- ---------------------------------------------------------------------------
-- em_event_timeline
-- ---------------------------------------------------------------------------
create table if not exists public.em_event_timeline (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.em_events (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '' check (char_length(description) <= 1000),
  location text not null default '' check (char_length(location) <= 200),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint em_event_timeline_order check (end_time > start_time)
);

create index if not exists em_event_timeline_event_idx on public.em_event_timeline (event_id, sort_order);

-- ---------------------------------------------------------------------------
-- em_event_guests
-- ---------------------------------------------------------------------------
create table if not exists public.em_event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.em_events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null default '' check (email = lower(email) and char_length(email) <= 254),
  phone text not null default '' check (phone ~ '^\+?[0-9]{0,15}$'),
  bio text not null default '' check (char_length(bio) <= 600),
  role text not null default 'GUEST'
    check (role in ('GUEST', 'SPEAKER', 'VIP', 'HOST', 'AUDIENCE', 'STAFF', 'OTHER')),
  status text not null default 'INVITED' check (status in ('INVITED', 'CHECKED_IN', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint em_event_guests_id_event_unique unique (id, event_id)
);

create index if not exists em_event_guests_event_idx on public.em_event_guests (event_id, status);
create index if not exists em_event_guests_name_idx on public.em_event_guests (event_id, lower(name));
-- Duplicate protection among active guests (name-only duplicates are handled in the service).
create unique index if not exists em_event_guests_email_unique
  on public.em_event_guests (event_id, email) where email <> '' and status <> 'CANCELLED';
create unique index if not exists em_event_guests_phone_unique
  on public.em_event_guests (event_id, ltrim(phone, '+')) where phone <> '' and status <> 'CANCELLED';

-- ---------------------------------------------------------------------------
-- em_event_passes — one per guest; public_id is display-only, never the PK.
-- ---------------------------------------------------------------------------
create table if not exists public.em_event_passes (
  id uuid primary key default gen_random_uuid(),
  public_id text not null,
  event_id uuid not null references public.em_events (id) on delete cascade,
  guest_id uuid not null,
  secure_token text not null check (secure_token ~ '^[A-Za-z0-9_-]{43}$'),
  status text not null default 'ISSUED' check (status in ('ISSUED', 'CHECKED_IN', 'CANCELLED')),
  issued_at timestamptz not null default now(),
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint em_event_passes_public_id_unique unique (public_id),
  constraint em_event_passes_public_id_format check (public_id ~ '^INV-PASS-[0-9A-F]{8}$'),
  constraint em_event_passes_token_unique unique (secure_token),
  constraint em_event_passes_guest_unique unique (guest_id),
  constraint em_event_passes_id_event_unique unique (id, event_id),
  -- The pass's event must be the guest's event.
  constraint em_event_passes_guest_event_fk foreign key (guest_id, event_id)
    references public.em_event_guests (id, event_id) on delete cascade,
  constraint em_event_passes_checked_in_time check (status <> 'CHECKED_IN' or checked_in_at is not null)
);

create index if not exists em_event_passes_event_idx on public.em_event_passes (event_id, status);

-- ---------------------------------------------------------------------------
-- em_attendance — one CHECK_IN per pass; RE_ENTRY rows reserved for re-entry support.
-- ---------------------------------------------------------------------------
create table if not exists public.em_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.em_events (id) on delete cascade,
  pass_id uuid not null,
  guest_id uuid not null,
  checked_in_by uuid references auth.users (id) on delete set null,
  checked_in_at timestamptz not null default now(),
  scan_type text not null default 'CHECK_IN' check (scan_type in ('CHECK_IN', 'RE_ENTRY')),
  created_at timestamptz not null default now(),
  constraint em_attendance_pass_event_fk foreign key (pass_id, event_id)
    references public.em_event_passes (id, event_id) on delete cascade,
  constraint em_attendance_guest_event_fk foreign key (guest_id, event_id)
    references public.em_event_guests (id, event_id) on delete cascade
);

create unique index if not exists em_attendance_one_check_in
  on public.em_attendance (pass_id) where scan_type = 'CHECK_IN';
create index if not exists em_attendance_event_time_idx on public.em_attendance (event_id, checked_in_at desc);
create index if not exists em_attendance_guest_idx on public.em_attendance (guest_id);

-- ---------------------------------------------------------------------------
-- em_event_staff — per-event door staff. `user_id` binds on first sign-in by email.
-- ---------------------------------------------------------------------------
create table if not exists public.em_event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.em_events (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint em_event_staff_email_unique unique (event_id, email)
);

create index if not exists em_event_staff_user_idx on public.em_event_staff (user_id);
create index if not exists em_event_staff_email_idx on public.em_event_staff (email) where user_id is null;

-- ---------------------------------------------------------------------------
-- em_audit_log — append-only.
-- ---------------------------------------------------------------------------
create table if not exists public.em_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.em_events (id) on delete set null,
  actor_user_id uuid,
  action text not null,
  target_type text,
  target_id text,
  result text not null default 'OK',
  ip text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists em_audit_log_event_idx on public.em_audit_log (event_id, created_at desc);
create index if not exists em_audit_log_actor_idx on public.em_audit_log (actor_user_id, created_at desc);

create or replace function public.em_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    -- Only the ON DELETE SET NULL cascade from em_events may touch existing rows.
    if new.event_id is null and old.event_id is not null
       and (to_jsonb(new) - 'event_id') = (to_jsonb(old) - 'event_id') then
      return new;
    end if;
  end if;
  raise exception 'em_audit_log is append-only';
end;
$$;

drop trigger if exists em_audit_log_no_update on public.em_audit_log;
create trigger em_audit_log_no_update
  before update or delete on public.em_audit_log
  for each row execute function public.em_audit_log_immutable();

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse helper from init migration)
-- ---------------------------------------------------------------------------
drop trigger if exists em_events_set_updated_at on public.em_events;
create trigger em_events_set_updated_at before update on public.em_events
  for each row execute function public.set_updated_at();
drop trigger if exists em_event_timeline_set_updated_at on public.em_event_timeline;
create trigger em_event_timeline_set_updated_at before update on public.em_event_timeline
  for each row execute function public.set_updated_at();
drop trigger if exists em_event_guests_set_updated_at on public.em_event_guests;
create trigger em_event_guests_set_updated_at before update on public.em_event_guests
  for each row execute function public.set_updated_at();
drop trigger if exists em_event_passes_set_updated_at on public.em_event_passes;
create trigger em_event_passes_set_updated_at before update on public.em_event_passes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Capacity guard: active guests may never exceed max_capacity, even under concurrency.
-- ---------------------------------------------------------------------------
create or replace function public.em_enforce_capacity()
returns trigger
language plpgsql
as $$
declare
  v_capacity integer;
  v_active integer;
begin
  if new.status = 'CANCELLED' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'CANCELLED' then
    return new;
  end if;
  select max_capacity into v_capacity from public.em_events where id = new.event_id for update;
  select count(*) into v_active from public.em_event_guests
    where event_id = new.event_id and status <> 'CANCELLED' and id <> new.id;
  if v_active + 1 > v_capacity then
    raise exception 'Maximum event capacity has been reached.' using errcode = 'P0001', hint = 'CAPACITY_REACHED';
  end if;
  return new;
end;
$$;

drop trigger if exists em_event_guests_capacity on public.em_event_guests;
create trigger em_event_guests_capacity
  before insert or update of status on public.em_event_guests
  for each row execute function public.em_enforce_capacity();

-- ---------------------------------------------------------------------------
-- Aggregates for dashboards
-- ---------------------------------------------------------------------------
-- Dropped first so re-running this file after later migrations (which add columns) works.
drop view if exists public.em_event_counts;
create view public.em_event_counts
with (security_invoker = true)
as
select
  e.id as event_id,
  count(g.id) filter (where g.status <> 'CANCELLED')::integer as invited,
  count(g.id) filter (where g.status = 'CANCELLED')::integer as cancelled,
  count(g.id) filter (where g.status = 'CHECKED_IN')::integer as checked_in,
  count(p.id) filter (where p.status <> 'CANCELLED' and g.status <> 'CANCELLED')::integer as passes_issued
from public.em_events e
left join public.em_event_guests g on g.event_id = e.id
left join public.em_event_passes p on p.guest_id = g.id
group by e.id;

-- ---------------------------------------------------------------------------
-- Atomic check-in. Row lock on the pass serializes concurrent scans: exactly one
-- caller flips ISSUED → CHECKED_IN and inserts attendance; others get the original time.
-- ---------------------------------------------------------------------------
create or replace function public.em_record_check_in(
  p_attendance_id uuid,
  p_pass_id uuid,
  p_event_id uuid,
  p_guest_id uuid,
  p_checked_in_by uuid,
  p_at timestamptz
)
returns table (recorded boolean, checked_in_at timestamptz, attendance_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pass uuid;
  v_existing timestamptz;
begin
  update public.em_event_passes p
     set status = 'CHECKED_IN', checked_in_at = p_at
   where p.id = p_pass_id and p.event_id = p_event_id and p.guest_id = p_guest_id and p.status = 'ISSUED'
  returning p.id into v_pass;

  if v_pass is null then
    select p.checked_in_at into v_existing from public.em_event_passes p where p.id = p_pass_id;
    return query select false, v_existing, null::uuid;
    return;
  end if;

  insert into public.em_attendance (id, event_id, pass_id, guest_id, checked_in_by, checked_in_at, scan_type)
  values (p_attendance_id, p_event_id, p_pass_id, p_guest_id, p_checked_in_by, p_at, 'CHECK_IN');

  update public.em_event_guests g set status = 'CHECKED_IN' where g.id = p_guest_id and g.status = 'INVITED';

  return query select true, p_at, p_attendance_id;
end;
$$;

revoke all on function public.em_record_check_in(uuid, uuid, uuid, uuid, uuid, timestamptz) from public;
revoke all on function public.em_record_check_in(uuid, uuid, uuid, uuid, uuid, timestamptz) from anon, authenticated;
grant execute on function public.em_record_check_in(uuid, uuid, uuid, uuid, uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic fixed-window rate limiter (reuses api_rate_buckets; single statement, no read/write race).
-- ---------------------------------------------------------------------------
create or replace function public.em_rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.api_rate_buckets as b (bucket_key, window_start, hit_count, updated_at)
  values (p_key || ':' || extract(epoch from v_window)::bigint, v_window, 1, now())
  on conflict (bucket_key) do update set hit_count = b.hit_count + 1, updated_at = now()
  returning b.hit_count into v_hits;
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.em_rate_limit_hit(text, integer, integer) from public;
revoke all on function public.em_rate_limit_hit(text, integer, integer) from anon, authenticated;
grant execute on function public.em_rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: read-only for organizers (own events) and assigned staff (event row only).
-- No client writes; no anon access. Service role bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.em_events enable row level security;
alter table public.em_event_timeline enable row level security;
alter table public.em_event_guests enable row level security;
alter table public.em_event_passes enable row level security;
alter table public.em_attendance enable row level security;
alter table public.em_event_staff enable row level security;
alter table public.em_audit_log enable row level security;

create or replace function public.em_is_owner(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.em_events e where e.id = p_event_id and e.created_by = auth.uid());
$$;

create or replace function public.em_is_staff(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.em_event_staff s where s.event_id = p_event_id and s.user_id = auth.uid());
$$;

revoke all on function public.em_is_owner(uuid) from public, anon;
revoke all on function public.em_is_staff(uuid) from public, anon;
grant execute on function public.em_is_owner(uuid) to authenticated;
grant execute on function public.em_is_staff(uuid) to authenticated;

drop policy if exists "em_events_select_owner_or_staff" on public.em_events;
create policy "em_events_select_owner_or_staff" on public.em_events
  for select to authenticated
  using (created_by = auth.uid() or public.em_is_staff(id));

drop policy if exists "em_event_timeline_select" on public.em_event_timeline;
create policy "em_event_timeline_select" on public.em_event_timeline
  for select to authenticated
  using (public.em_is_owner(event_id) or public.em_is_staff(event_id));

drop policy if exists "em_event_guests_select_owner" on public.em_event_guests;
create policy "em_event_guests_select_owner" on public.em_event_guests
  for select to authenticated
  using (public.em_is_owner(event_id));

drop policy if exists "em_event_passes_select_owner" on public.em_event_passes;
create policy "em_event_passes_select_owner" on public.em_event_passes
  for select to authenticated
  using (public.em_is_owner(event_id));

drop policy if exists "em_attendance_select_owner" on public.em_attendance;
create policy "em_attendance_select_owner" on public.em_attendance
  for select to authenticated
  using (public.em_is_owner(event_id));

drop policy if exists "em_event_staff_select" on public.em_event_staff;
create policy "em_event_staff_select" on public.em_event_staff
  for select to authenticated
  using (public.em_is_owner(event_id) or user_id = auth.uid());

drop policy if exists "em_audit_log_select_owner" on public.em_audit_log;
create policy "em_audit_log_select_owner" on public.em_audit_log
  for select to authenticated
  using (event_id is not null and public.em_is_owner(event_id));

revoke all on public.em_events, public.em_event_timeline, public.em_event_guests, public.em_event_passes,
  public.em_attendance, public.em_event_staff, public.em_audit_log, public.em_event_counts from anon;
revoke insert, update, delete on public.em_events, public.em_event_timeline, public.em_event_guests,
  public.em_event_passes, public.em_attendance, public.em_event_staff, public.em_audit_log from authenticated;
grant select on public.em_events, public.em_event_timeline, public.em_event_guests, public.em_event_passes,
  public.em_attendance, public.em_event_staff, public.em_audit_log, public.em_event_counts to authenticated;
grant all on public.em_events, public.em_event_timeline, public.em_event_guests, public.em_event_passes,
  public.em_attendance, public.em_event_staff, public.em_audit_log, public.em_event_counts to service_role;
