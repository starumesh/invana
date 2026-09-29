-- Passes are issued on request per guest and carry who they are for.
-- holder_name / holder_role snapshot the guest at issue time; the event-management
-- service refreshes them when the guest is edited. guest_id (FK) stays the binding link.
-- Apply after 20260928000000_event_management.sql.

alter table public.em_event_passes
  add column if not exists holder_name text,
  add column if not exists holder_role text;

update public.em_event_passes p
   set holder_name = g.name, holder_role = g.role
  from public.em_event_guests g
 where g.id = p.guest_id and (p.holder_name is null or p.holder_role is null);

create or replace function public.em_pass_fill_holder()
returns trigger
language plpgsql
as $$
begin
  if new.holder_name is null or new.holder_role is null then
    select coalesce(new.holder_name, g.name), coalesce(new.holder_role, g.role)
      into new.holder_name, new.holder_role
      from public.em_event_guests g
     where g.id = new.guest_id;
  end if;
  return new;
end;
$$;

drop trigger if exists em_event_passes_fill_holder on public.em_event_passes;
create trigger em_event_passes_fill_holder
  before insert on public.em_event_passes
  for each row execute function public.em_pass_fill_holder();

alter table public.em_event_passes
  alter column holder_name set not null,
  alter column holder_role set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'em_event_passes_holder_name_len') then
    alter table public.em_event_passes
      add constraint em_event_passes_holder_name_len check (char_length(holder_name) between 1 and 120),
      add constraint em_event_passes_holder_role_valid
        check (holder_role in ('GUEST', 'SPEAKER', 'VIP', 'HOST', 'AUDIENCE', 'STAFF', 'OTHER'));
  end if;
end $$;
