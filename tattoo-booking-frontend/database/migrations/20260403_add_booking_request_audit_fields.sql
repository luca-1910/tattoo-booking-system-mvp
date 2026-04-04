-- Admin audit trail fields for booking decisions.
alter table public.booking_request
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by text,
  add column if not exists rejected_at timestamptz;

-- Replace approval RPC so it records approver metadata.
drop function if exists public.approve_booking_request(text);

create or replace function public.approve_booking_request(
  p_request_id text,
  p_admin_user_id text default null
)
returns table (
  ok boolean,
  code text,
  message text
)
language plpgsql
as $$
declare
  v_slot_id text;
  v_rows int;
begin
  select requested_slot_id::text
    into v_slot_id
  from public.booking_request
  where request_id::text = p_request_id
  for update;

  if not found then
    return query select false, 'not_found', 'Booking request not found.';
    return;
  end if;

  if v_slot_id is null then
    return query select false, 'missing_slot', 'Booking request has no selected slot.';
    return;
  end if;

  update public.slot
    set status = 'booked'
  where slot_id::text = v_slot_id
    and status = 'available';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return query select false, 'slot_unavailable', 'Slot is no longer available.';
    return;
  end if;

  update public.booking_request
    set status = 'approved',
        approved_by = p_admin_user_id,
        approved_at = timezone('utc', now()),
        rejected_by = null,
        rejected_at = null,
        google_calendar_sync_status = 'pending',
        google_calendar_sync_error = null,
        google_calendar_event_id = null,
        google_calendar_last_attempt_at = null,
        google_calendar_synced_at = null,
        google_calendar_event_origin = 'tattoo-booking-mvp'
  where request_id::text = p_request_id
    and lower(coalesce(status, 'pending')) = 'pending';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    update public.slot
      set status = 'available'
    where slot_id::text = v_slot_id
      and status = 'booked';

    return query select false, 'invalid_state', 'Only pending booking requests can be approved.';
    return;
  end if;

  return query select true, 'ok', 'Booking approved and slot booked.';
end;
$$;
