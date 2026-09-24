-- Invana V1 Row-Level Security policies
-- Apply after 20260324000000_init.sql

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_media enable row level security;
alter table public.event_guests enable row level security;
alter table public.rsvps enable row level security;
alter table public.rsvp_questions enable row level security;
alter table public.rsvp_answers enable row level security;
alter table public.exports enable row level security;
alter table public.themes enable row level security;
alter table public.message_campaigns enable row level security;
alter table public.message_recipients enable row level security;
alter table public.message_logs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: owners only
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- events: owners full access; anon/authenticated can read published
-- ---------------------------------------------------------------------------
drop policy if exists "events_select_own" on public.events;
create policy "events_select_own"
  on public.events for select
  using (auth.uid() = user_id);

drop policy if exists "events_select_published" on public.events;
create policy "events_select_published"
  on public.events for select
  using (status = 'published');

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own"
  on public.events for insert
  with check (auth.uid() = user_id);

drop policy if exists "events_update_own" on public.events;
create policy "events_update_own"
  on public.events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own"
  on public.events for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- event_media / guests / exports / themes / campaigns: owner only
-- ---------------------------------------------------------------------------
drop policy if exists "event_media_owner_all" on public.event_media;
create policy "event_media_owner_all"
  on public.event_media for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "event_guests_owner_all" on public.event_guests;
create policy "event_guests_owner_all"
  on public.event_guests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "exports_owner_all" on public.exports;
create policy "exports_owner_all"
  on public.exports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "themes_select_system_or_own" on public.themes;
create policy "themes_select_system_or_own"
  on public.themes for select
  using (is_system or auth.uid() = user_id);

drop policy if exists "themes_write_own" on public.themes;
create policy "themes_write_own"
  on public.themes for all
  using (auth.uid() = user_id and not is_system)
  with check (auth.uid() = user_id and not is_system);

drop policy if exists "message_campaigns_owner_all" on public.message_campaigns;
create policy "message_campaigns_owner_all"
  on public.message_campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Recipients: host can manage via campaign ownership
drop policy if exists "message_recipients_via_campaign" on public.message_recipients;
create policy "message_recipients_via_campaign"
  on public.message_recipients for all
  using (
    exists (
      select 1 from public.message_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.message_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

-- Logs: host read via campaign; inserts typically from service role / edge function
drop policy if exists "message_logs_select_via_campaign" on public.message_logs;
create policy "message_logs_select_via_campaign"
  on public.message_logs for select
  using (
    campaign_id is null
    or exists (
      select 1 from public.message_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- rsvps: hosts read their events; anyone can insert for published events
-- Guests cannot enumerate other RSVPs (no public SELECT).
-- ---------------------------------------------------------------------------
drop policy if exists "rsvps_select_host" on public.rsvps;
create policy "rsvps_select_host"
  on public.rsvps for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "rsvps_insert_published" on public.rsvps;
create policy "rsvps_insert_published"
  on public.rsvps for insert
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'published'
    )
  );

drop policy if exists "rsvp_questions_host_all" on public.rsvp_questions;
create policy "rsvp_questions_host_all"
  on public.rsvp_questions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "rsvp_questions_select_published" on public.rsvp_questions;
create policy "rsvp_questions_select_published"
  on public.rsvp_questions for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'published'
    )
  );

drop policy if exists "rsvp_answers_insert_with_rsvp" on public.rsvp_answers;
create policy "rsvp_answers_insert_with_rsvp"
  on public.rsvp_answers for insert
  with check (
    exists (
      select 1
      from public.rsvps r
      join public.events e on e.id = r.event_id
      where r.id = rsvp_id and e.status = 'published'
    )
  );

drop policy if exists "rsvp_answers_select_host" on public.rsvp_answers;
create policy "rsvp_answers_select_host"
  on public.rsvp_answers for select
  using (
    exists (
      select 1
      from public.rsvps r
      join public.events e on e.id = r.event_id
      where r.id = rsvp_id and e.user_id = auth.uid()
    )
  );
