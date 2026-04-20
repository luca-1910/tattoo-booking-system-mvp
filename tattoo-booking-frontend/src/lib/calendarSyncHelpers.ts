import {
  APP_CALENDAR_SOURCE,
  createGoogleCalendarEvent,
  type CalendarSyncStatus,
} from "@/lib/googleCalendar";

// Minimal shapes needed for syncing — both routes share these.
export type SyncableBooking = {
  request_id: string | number;
  name: string | null;
  email: string | null;
  phone: string | null;
  tattoo_idea: string | null;
  requested_slot_id: string | null;
};

export type SyncableSlot = {
  slot_id: string;
  start_time: string;
  end_time: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export type SyncResult = {
  status: CalendarSyncStatus;
  eventId?: string;
  error?: string;
};

/**
 * Syncs a single booking to Google Calendar.
 * Reads artist config from DB (google_calendar_sync_enabled, calendar_id, tokens).
 * Persists the sync outcome back to booking_request.
 */
export async function syncBookingToCalendar({
  supabase,
  booking,
  slot,
}: {
  supabase: AnySupabaseClient;
  booking: SyncableBooking;
  slot: SyncableSlot;
}): Promise<SyncResult> {
  const requestId = String(booking.request_id);
  const attemptAt = new Date().toISOString();

  const { data: artistRow, error: artistError } = await supabase
    .from("tattoo_artist")
    .select("artist_id,calendar_id,google_calendar_sync_enabled")
    .limit(1)
    .maybeSingle();

  const artist = artistRow as {
    artist_id: string;
    calendar_id: string | null;
    google_calendar_sync_enabled: boolean | null;
  } | null;

  if (artistError) {
    const msg = `Failed to read calendar settings: ${artistError.message}`;
    await persistOutcome(supabase, requestId, attemptAt, "failed", msg, null);
    return { status: "failed", error: msg };
  }

  if (!artist?.google_calendar_sync_enabled) {
    const reason = "Google Calendar sync is disabled.";
    await persistOutcome(supabase, requestId, attemptAt, "skipped", reason, null);
    return { status: "skipped", error: reason };
  }

  const calendarId = artist.calendar_id ?? "primary";

  const syncResult = await createGoogleCalendarEvent(
    {
      calendarId,
      requestId,
      clientName: booking.name ?? "Client",
      email: booking.email,
      phone: booking.phone,
      tattooIdea: booking.tattoo_idea,
      startTimeIso: slot.start_time,
      endTimeIso: slot.end_time,
    },
    { artistId: artist.artist_id, supabase },
  );

  if (syncResult.status === "synced") {
    await persistOutcome(supabase, requestId, attemptAt, "synced", null, syncResult.eventId);
    return { status: "synced", eventId: syncResult.eventId };
  }

  if (syncResult.status === "skipped") {
    await persistOutcome(supabase, requestId, attemptAt, "skipped", syncResult.error ?? null, null);
    return { status: "skipped", error: syncResult.error };
  }

  await persistOutcome(supabase, requestId, attemptAt, "failed", syncResult.error ?? null, null);
  return { status: "failed", error: syncResult.error };
}

async function persistOutcome(
  supabase: AnySupabaseClient,
  requestId: string,
  attemptAt: string,
  status: CalendarSyncStatus,
  error: string | null,
  eventId: string | null | undefined,
) {
  await supabase
    .from("booking_request")
    .update({
      google_calendar_sync_status: status,
      google_calendar_sync_error: status === "synced" ? null : error,
      google_calendar_last_attempt_at: attemptAt,
      google_calendar_synced_at: status === "synced" ? attemptAt : null,
      google_calendar_event_id: status === "synced" ? eventId : null,
      google_calendar_event_origin: APP_CALENDAR_SOURCE,
    })
    .eq("request_id", requestId);
}
