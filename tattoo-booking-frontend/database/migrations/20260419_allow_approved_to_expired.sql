-- Allow approved bookings to transition to expired when the appointment day has passed.
create or replace function public.enforce_booking_request_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or old.status is null then
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('approved', 'rejected', 'expired', 'cancelled') then
    return new;
  end if;

  if old.status = 'approved' and new.status in ('completed', 'cancelled', 'expired') then
    return new;
  end if;

  raise exception 'Invalid booking_request status transition: % -> %', old.status, new.status;
end;
$$;
