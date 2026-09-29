-- My Invitations performance + Guest → Pass → Share tracking.
-- Apply after 20260929000000_em_pass_holder.sql. Idempotent.

-- Pass Shared status
alter table public.em_event_passes add column if not exists shared_at timestamptz;

-- Counts view gains passes_shared (appended column keeps CREATE OR REPLACE valid).
create or replace view public.em_event_counts
with (security_invoker = true)
as
select
  e.id as event_id,
  count(g.id) filter (where g.status <> 'CANCELLED')::integer as invited,
  count(g.id) filter (where g.status = 'CANCELLED')::integer as cancelled,
  count(g.id) filter (where g.status = 'CHECKED_IN')::integer as checked_in,
  count(p.id) filter (where p.status <> 'CANCELLED' and g.status <> 'CANCELLED')::integer as passes_issued,
  count(p.id) filter (where p.status <> 'CANCELLED' and g.status <> 'CANCELLED' and p.shared_at is not null)::integer as passes_shared
from public.em_events e
left join public.em_event_guests g on g.event_id = e.id
left join public.em_event_passes p on p.guest_id = g.id
group by e.id;

-- Guest + pass rows for server-side search / filter / sort / pagination (no secure_token).
create or replace view public.em_guest_rows
with (security_invoker = true)
as
select
  g.id,
  g.event_id,
  g.name,
  lower(g.name) as name_key,
  g.email,
  g.phone,
  g.bio,
  g.role,
  g.status,
  g.created_at,
  g.updated_at,
  p.id as pass_id,
  p.public_id as pass_public_id,
  p.status as pass_status,
  p.issued_at as pass_issued_at,
  p.checked_in_at as pass_checked_in_at,
  p.shared_at as pass_shared_at,
  p.holder_name as pass_holder_name,
  p.holder_role as pass_holder_role,
  case
    when g.status = 'CANCELLED' then 'CANCELLED'
    when g.status = 'CHECKED_IN' or p.status = 'CHECKED_IN' then 'CHECKED_IN'
    when p.id is null then 'NO_PASS'
    when p.status = 'CANCELLED' then 'CANCELLED'
    when p.shared_at is not null then 'PASS_SHARED'
    else 'PASS_GENERATED'
  end as stage
from public.em_event_guests g
left join public.em_event_passes p on p.guest_id = g.id;

revoke all on public.em_guest_rows from anon;
grant select on public.em_guest_rows to authenticated, service_role;

-- Indexes for the list and guest queries.
create index if not exists em_events_owner_created_idx on public.em_events (created_by, created_at desc, id desc);
create index if not exists em_event_guests_event_created_idx on public.em_event_guests (event_id, created_at, id);
create index if not exists em_event_guests_event_email_idx on public.em_event_guests (event_id, email) where email <> '';
create index if not exists em_event_passes_event_issued_idx on public.em_event_passes (event_id, issued_at);
create index if not exists em_event_staff_email_all_idx on public.em_event_staff (email);

-- One round trip for My Invitations: owned + assigned (non-draft) events with counts,
-- newest first, keyset-paginated on (created_at, id).
create or replace function public.em_event_summaries(
  p_user_id uuid,
  p_email text,
  p_limit integer,
  p_cursor_created timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  public_id text,
  name text,
  event_type text,
  start_datetime timestamptz,
  timezone text,
  duration_minutes integer,
  venue_name text,
  city text,
  status text,
  slug text,
  max_capacity integer,
  created_at timestamptz,
  access text,
  invited integer,
  cancelled integer,
  checked_in integer,
  passes_issued integer,
  passes_shared integer
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select e.id, e.public_id, e.name, e.event_type, e.start_datetime, e.timezone, e.duration_minutes, e.venue_name,
           e.city, e.status, e.slug, e.max_capacity, e.created_at, 'ORGANIZER'::text as access
      from public.em_events e
     where e.created_by = p_user_id
    union all
    select e.id, e.public_id, e.name, e.event_type, e.start_datetime, e.timezone, e.duration_minutes, e.venue_name,
           e.city, e.status, e.slug, e.max_capacity, e.created_at, 'STAFF'::text
      from public.em_events e
     where e.created_by <> p_user_id
       and e.status <> 'DRAFT'
       and exists (
         select 1 from public.em_event_staff s
          where s.event_id = e.id
            and (s.user_id = p_user_id or (s.user_id is null and p_email is not null and s.email = p_email))
       )
  ),
  page as (
    select * from mine m
     where p_cursor_created is null or (m.created_at, m.id) < (p_cursor_created, p_cursor_id)
     order by m.created_at desc, m.id desc
     limit least(greatest(p_limit, 1), 101)
  )
  select pg.id, pg.public_id, pg.name, pg.event_type, pg.start_datetime, pg.timezone, pg.duration_minutes, pg.venue_name,
         pg.city, pg.status, pg.slug, pg.max_capacity, pg.created_at, pg.access,
         coalesce(c.invited, 0), coalesce(c.cancelled, 0), coalesce(c.checked_in, 0),
         coalesce(c.passes_issued, 0), coalesce(c.passes_shared, 0)
    from page pg
    left join lateral (
      select
        count(*) filter (where g.status <> 'CANCELLED')::integer as invited,
        count(*) filter (where g.status = 'CANCELLED')::integer as cancelled,
        count(*) filter (where g.status = 'CHECKED_IN')::integer as checked_in,
        count(p.id) filter (where p.status <> 'CANCELLED' and g.status <> 'CANCELLED')::integer as passes_issued,
        count(p.id) filter (where p.status <> 'CANCELLED' and g.status <> 'CANCELLED' and p.shared_at is not null)::integer as passes_shared
      from public.em_event_guests g
      left join public.em_event_passes p on p.guest_id = g.id
      where g.event_id = pg.id
    ) c on true
   order by pg.created_at desc, pg.id desc;
$$;

revoke all on function public.em_event_summaries(uuid, text, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.em_event_summaries(uuid, text, integer, timestamptz, uuid) to service_role;

notify pgrst, 'reload schema';
