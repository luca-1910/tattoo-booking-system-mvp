-- Allow unauthenticated visitors to read available slots and submit booking requests.
-- The booking page is fully public — no account required.

-- slot: anon can read (to display available dates/times)
alter table public.slot enable row level security;

drop policy if exists "public_read_slot" on public.slot;
create policy "public_read_slot"
  on public.slot
  for select
  to anon, authenticated
  using (true);

-- slot: only authenticated (admin) can insert/update/delete
drop policy if exists "admin_write_slot" on public.slot;
create policy "admin_write_slot"
  on public.slot
  for all
  to authenticated
  using (true)
  with check (true);

-- booking_request: anon can insert (submit a new request)
alter table public.booking_request enable row level security;

drop policy if exists "anon_insert_booking_request" on public.booking_request;
create policy "anon_insert_booking_request"
  on public.booking_request
  for insert
  to anon
  with check (true);

-- booking_request: only authenticated (admin) can read/update/delete
drop policy if exists "admin_all_booking_request" on public.booking_request;
create policy "admin_all_booking_request"
  on public.booking_request
  for all
  to authenticated
  using (true)
  with check (true);
