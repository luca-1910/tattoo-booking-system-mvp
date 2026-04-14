-- Adds Google OAuth token storage to tattoo_artist.
-- These columns replace the .env.local token approach, enabling both
-- the Google Sign-In path (tokens from Supabase provider session) and
-- the email/password path (tokens from /api/google/callback OAuth flow).
alter table public.tattoo_artist
  add column if not exists google_access_token  text,
  add column if not exists google_refresh_token text,
  add column if not exists google_token_expiry  bigint;
