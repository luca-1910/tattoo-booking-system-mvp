-- Creates the intake-uploads bucket (if missing) and adds RLS policies so
-- unauthenticated visitors can upload reference images during booking.

-- Ensure the bucket exists and is public (GET requests work without a token).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake-uploads',
  'intake-uploads',
  true,
  10485760, -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Allow anonymous users to upload files (INSERT).
-- The booking page is public, so visitors are unauthenticated (anon role).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'intake_uploads_anon_insert'
  ) then
    create policy intake_uploads_anon_insert
      on storage.objects
      for insert
      to anon
      with check (bucket_id = 'intake-uploads');
  end if;
end $$;

-- Allow public read access so getPublicUrl() works without authentication.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'intake_uploads_public_select'
  ) then
    create policy intake_uploads_public_select
      on storage.objects
      for select
      to public
      using (bucket_id = 'intake-uploads');
  end if;
end $$;
