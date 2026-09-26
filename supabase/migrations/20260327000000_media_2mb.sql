-- Lower event-media object cap to 2 MB (client compresses before upload).
update storage.buckets
set file_size_limit = 2097152 -- 2 MB
where id = 'event-media';
