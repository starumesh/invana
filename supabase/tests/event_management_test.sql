-- Database-level checks for 20260928000000_event_management.sql.
-- Run with supabase/tests/run-local.sh (vanilla Postgres + local_stubs.sql). Any failed
-- assertion raises and aborts with a non-zero exit code.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'host@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'door@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'nosy@example.com');

insert into public.em_events (id, public_id, name, description, start_datetime, duration_minutes, venue_name, address,
  city, country, latitude, longitude, max_capacity, created_by)
values ('10000000-0000-4000-8000-000000000001', 'INV-EVT-2027-7KQ2MX', 'Meetup', 'Talks', '2027-03-10T12:30:00Z', 180,
  'T-Hub', 'IIIT', 'Hyderabad', 'India', 17.44, 78.35, 2, '00000000-0000-4000-8000-00000000000a'),
  ('10000000-0000-4000-8000-000000000002', 'INV-EVT-2027-8ZZ2MX', 'Other', 'x', '2027-03-10T12:30:00Z', 60,
  'V', 'A', 'C', 'IN', 0, 0, 5, '00000000-0000-4000-8000-00000000000a');

insert into public.em_event_guests (id, event_id, name, email, phone) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Asha', 'asha@example.com', '+919800000001'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Bala', '', '9800000002'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', 'Zed', '', '');

-- Capacity trigger
do $$ begin
  begin
    insert into public.em_event_guests (event_id, name) values ('10000000-0000-4000-8000-000000000001', 'Chitra');
    raise exception 'ASSERT: capacity trigger did not fire';
  exception when raise_exception then
    if sqlerrm not like 'Maximum event capacity%' then raise; end if;
  end;
end $$;

-- Duplicate email among active guests
do $$ begin
  begin
    insert into public.em_event_guests (event_id, name, email) values ('10000000-0000-4000-8000-000000000002', 'Dup', 'z@example.com'),
      ('10000000-0000-4000-8000-000000000002', 'Dup2', 'z@example.com');
    raise exception 'ASSERT: duplicate email accepted';
  exception when unique_violation then null;
  end;
end $$;

-- Invalid values rejected by checks
do $$ begin
  begin
    update public.em_events set max_capacity = 0 where id = '10000000-0000-4000-8000-000000000002';
    raise exception 'ASSERT: zero capacity accepted';
  exception when check_violation then null;
  end;
  begin
    update public.em_events set status = 'PUBLISHED' where id = '10000000-0000-4000-8000-000000000002';
    raise exception 'ASSERT: published without slug accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.em_event_timeline (event_id, start_time, end_time, title)
    values ('10000000-0000-4000-8000-000000000001', '2027-03-10T13:00:00Z', '2027-03-10T12:59:00Z', 'Bad');
    raise exception 'ASSERT: backwards timeline accepted';
  exception when check_violation then null;
  end;
end $$;

insert into public.em_event_passes (id, public_id, event_id, guest_id, secure_token) values
  ('30000000-0000-4000-8000-000000000001', 'INV-PASS-8F72A91C', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', repeat('a', 43)),
  ('30000000-0000-4000-8000-000000000002', 'INV-PASS-00000002', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', repeat('b', 43));

-- Pass must belong to the guest's event
do $$ begin
  begin
    insert into public.em_event_passes (public_id, event_id, guest_id, secure_token)
    values ('INV-PASS-00000009', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000009', repeat('c', 43));
    raise exception 'ASSERT: cross-event pass accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.em_event_passes (public_id, event_id, guest_id, secure_token)
    values ('INV-PASS-0000000A', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', repeat('d', 43));
    raise exception 'ASSERT: second pass for guest accepted';
  exception when unique_violation then null;
  end;
end $$;

-- Atomic check-in + duplicate protection
do $$
declare r record;
begin
  select * into r from public.em_record_check_in('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', '2027-03-10T12:45:00Z');
  if not r.recorded then raise exception 'ASSERT: first check-in not recorded'; end if;
  select * into r from public.em_record_check_in('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', '2027-03-10T12:50:00Z');
  if r.recorded then raise exception 'ASSERT: duplicate check-in recorded'; end if;
  if r.checked_in_at <> '2027-03-10T12:45:00Z'::timestamptz then raise exception 'ASSERT: original time not returned'; end if;
  if (select count(*) from public.em_attendance) <> 1 then raise exception 'ASSERT: attendance count'; end if;
  if (select status from public.em_event_guests where id = '20000000-0000-4000-8000-000000000001') <> 'CHECKED_IN' then
    raise exception 'ASSERT: guest status not updated';
  end if;
  begin
    insert into public.em_attendance (event_id, pass_id, guest_id) values
      ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
    raise exception 'ASSERT: second CHECK_IN row accepted';
  exception when unique_violation then null;
  end;
  -- Re-entry rows are allowed by the model.
  insert into public.em_attendance (event_id, pass_id, guest_id, scan_type) values
    ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'RE_ENTRY');
  -- Wrong event for the pass → not recorded
  select * into r from public.em_record_check_in(gen_random_uuid(), '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', null, now());
  if r.recorded then raise exception 'ASSERT: wrong-event check-in recorded'; end if;
end $$;

-- Counts view
do $$
declare c record;
begin
  select * into c from public.em_event_counts where event_id = '10000000-0000-4000-8000-000000000001';
  if c.invited <> 2 or c.checked_in <> 1 or c.passes_issued <> 2 then
    raise exception 'ASSERT: counts view wrong: %', row_to_json(c);
  end if;
end $$;

-- Rate limiter
do $$
declare i integer; ok boolean;
begin
  for i in 1..3 loop ok := public.em_rate_limit_hit('test:key', 3, 60); end loop;
  if not ok then raise exception 'ASSERT: third hit should pass'; end if;
  if public.em_rate_limit_hit('test:key', 3, 60) then raise exception 'ASSERT: fourth hit should be limited'; end if;
end $$;

-- Audit log is append-only
insert into public.em_audit_log (event_id, action) values ('10000000-0000-4000-8000-000000000001', 'test');
do $$ begin
  begin
    update public.em_audit_log set action = 'tampered';
    raise exception 'ASSERT: audit update allowed';
  exception when raise_exception then
    if sqlerrm <> 'em_audit_log is append-only' then raise; end if;
  end;
end $$;

insert into public.em_event_staff (event_id, user_id, email, created_by) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', 'door@example.com', '00000000-0000-4000-8000-00000000000a');

-- RLS: organizer
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
do $$ begin
  if (select count(*) from public.em_events) <> 2 then raise exception 'ASSERT: owner should see 2 events'; end if;
  if (select count(*) from public.em_event_guests) <> 3 then raise exception 'ASSERT: owner should see guests'; end if;
  if (select count(*) from public.em_event_passes) <> 2 then raise exception 'ASSERT: owner should see passes'; end if;
  begin
    insert into public.em_event_guests (event_id, name) values ('10000000-0000-4000-8000-000000000002', 'Sneaky');
    raise exception 'ASSERT: client insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.em_event_passes set status = 'CHECKED_IN', checked_in_at = now();
    raise exception 'ASSERT: client pass update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.em_record_check_in(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), null, now());
    raise exception 'ASSERT: client may call check-in RPC';
  exception when insufficient_privilege then null;
  end;
end $$;

-- RLS: staff sees only the assigned event row, never guests or passes
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
do $$ begin
  if (select count(*) from public.em_events) <> 1 then raise exception 'ASSERT: staff should see 1 event'; end if;
  if (select count(*) from public.em_event_guests) <> 0 then raise exception 'ASSERT: staff must not see guests'; end if;
  if (select count(*) from public.em_event_passes) <> 0 then raise exception 'ASSERT: staff must not see passes'; end if;
end $$;

-- RLS: unrelated user sees nothing
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000c';
do $$ begin
  if (select count(*) from public.em_events) + (select count(*) from public.em_event_guests)
     + (select count(*) from public.em_event_passes) + (select count(*) from public.em_attendance)
     + (select count(*) from public.em_audit_log) <> 0 then
    raise exception 'ASSERT: stranger sees data';
  end if;
end $$;

-- anon has no table access at all
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.em_event_passes;
    raise exception 'ASSERT: anon can read passes';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Existing invitation tables still behave as before
insert into public.events (id, user_id, kind, template_id, title, slug, status)
values ('evt_legacy', '00000000-0000-4000-8000-00000000000a', 'invitation', 'classic', 'Legacy', 'legacy-invite', 'published');
insert into public.rsvps (id, event_id, guest_name, response) values ('r1', 'evt_legacy', 'Guest', 'yes');
update public.em_events set invite_event_id = 'evt_legacy' where id = '10000000-0000-4000-8000-000000000002';

rollback;
\echo 'event_management_test.sql: all assertions passed'
