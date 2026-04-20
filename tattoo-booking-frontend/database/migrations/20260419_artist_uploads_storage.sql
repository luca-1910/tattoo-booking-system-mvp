-- Storage bucket for artist-managed images (hero background, portfolio).
-- Public reads so the landing page renders without auth.
-- Authenticated writes so only the logged-in admin can upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artist-uploads',
  'artist-uploads',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "artist_uploads_public_select"  on storage.objects;
drop policy if exists "artist_uploads_auth_insert"    on storage.objects;
drop policy if exists "artist_uploads_auth_update"    on storage.objects;
drop policy if exists "artist_uploads_auth_delete"    on storage.objects;

create policy "artist_uploads_public_select"
  on storage.objects for select
  using (bucket_id = 'artist-uploads');

create policy "artist_uploads_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'artist-uploads');

create policy "artist_uploads_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'artist-uploads');

create policy "artist_uploads_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'artist-uploads');
