-- Adds minimal calendar sync metadata fields for approval workflow.
alter table public.booking_request
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_event_origin text,
  add column if not exists google_calendar_sync_status text,
  add column if not exists google_calendar_sync_error text,
  add column if not exists google_calendar_last_attempt_at timestamptz,
  add column if not exists google_calendar_synced_at timestamptz;

-- Optional defensive check constraint to keep statuses predictable.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_request_google_calendar_sync_status_check'
  ) then
    alter table public.booking_request
      add constraint booking_request_google_calendar_sync_status_check
      check (
        google_calendar_sync_status is null
        or google_calendar_sync_status in ('pending', 'synced', 'failed', 'skipped')
      );
  end if;
end $$;
