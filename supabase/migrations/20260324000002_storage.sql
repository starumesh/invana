-- Storage bucket for event media (run in SQL editor or via Dashboard → Storage)
-- Public read so published invites can load host photos without auth.
-- Insert/update/delete remain owner-only (path prefix = auth.uid()).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {user_id}/{event_id}/{filename}

-- Public read (invite guests + getPublicUrl). Writes stay owner-scoped below.
drop policy if exists "event_media_storage_select_own" on storage.objects;
drop policy if exists "event_media_storage_select_public" on storage.objects;
create policy "event_media_storage_select_public"
  on storage.objects for select
  using (bucket_id = 'event-media');

drop policy if exists "event_media_storage_insert_own" on storage.objects;
create policy "event_media_storage_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'event-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "event_media_storage_update_own" on storage.objects;
create policy "event_media_storage_update_own"
  on storage.objects for update
  using (
    bucket_id = 'event-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "event_media_storage_delete_own" on storage.objects;
create policy "event_media_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'event-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
