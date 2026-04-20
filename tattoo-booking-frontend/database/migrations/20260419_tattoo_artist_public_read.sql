-- Allow unauthenticated (anon) users to read the artist profile.
-- This is needed so the public landing page can fetch the artist's
-- name, tagline, images, contact info, etc. without requiring a login.

alter table tattoo_artist enable row level security;

-- Drop the policy first in case it already exists (idempotent re-run).
drop policy if exists "public_read_artist" on tattoo_artist;

create policy "public_read_artist"
  on tattoo_artist
  for select
  to anon, authenticated
  using (true);
