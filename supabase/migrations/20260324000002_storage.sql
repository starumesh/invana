-- Storage bucket for event media (run in SQL editor or via Dashboard → Storage)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {user_id}/{event_id}/{filename}

drop policy if exists "event_media_storage_select_own" on storage.objects;
create policy "event_media_storage_select_own"
  on storage.objects for select
  using (
    bucket_id = 'event-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Published event media readable by anyone with the signed/public URL path.
-- Prefer signed URLs from the client; this policy allows owners to read their objects.
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
