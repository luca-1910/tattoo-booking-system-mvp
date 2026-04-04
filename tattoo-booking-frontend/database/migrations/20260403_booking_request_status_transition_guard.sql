-- Enforce legal booking_request status transitions at DB layer.
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

  if old.status = 'approved' and new.status in ('completed', 'cancelled') then
    return new;
  end if;

  raise exception 'Invalid booking_request status transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists booking_request_status_transition_guard on public.booking_request;

create trigger booking_request_status_transition_guard
before update of status on public.booking_request
for each row
execute function public.enforce_booking_request_status_transition();
