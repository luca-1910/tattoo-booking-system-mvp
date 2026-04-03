-- Atomic approval transition:
-- pending booking_request + available slot -> approved booking_request + booked slot
create or replace function public.approve_booking_request(p_request_id text)
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
    -- Compensate slot write if booking is no longer pending.
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
