import { NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";
import { syncBookingToCalendar } from "@/lib/calendarSyncHelpers";
import { checkGoogleCalendarEvent, deleteGoogleCalendarEvent } from "@/lib/googleCalendar";

type UnsyncedBooking = {
  request_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  tattoo_idea: string | null;
  requested_slot_id: string | null;
};

type SyncedBooking = {
  request_id: string;
  requested_slot_id: string | null;
  google_calendar_event_id: string;
};

type SlotRow = {
  slot_id: string;
  start_time: string;
  end_time: string;
};

type ArtistRow = {
  artist_id: string;
  calendar_id: string | null;
  google_calendar_sync_enabled: boolean | null;
};

/**
 * POST /api/admin/bookings/sync-calendar
 *
 * Two-phase sync:
 *
 * Phase 1 — App → GCal: finds every approved booking with sync_status ≠ 'synced'
 *   and a valid slot, and creates the missing GCal event.
 *   Bookings whose slot no longer exists are skipped (not failed).
 *
 * Phase 2 — GCal → App: for every approved booking already marked 'synced',
 *   verifies the GCal event still exists. If it was deleted in GCal, the booking
 *   is cancelled in the app and its slot freed.
 *
 * Returns { synced, skipped, failed, gcalDeleted, errors }.
 */
export async function POST() {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !isConfiguredAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // ── Fetch artist config (needed for both phases) ──────────────────────────
  const { data: artistRow } = await supabase
    .from("tattoo_artist")
    .select("artist_id,calendar_id,google_calendar_sync_enabled")
    .limit(1)
    .maybeSingle();

  const artist = artistRow as ArtistRow | null;
  const calendarId = artist?.calendar_id ?? "primary";

  // ── Phase 1: App → GCal ───────────────────────────────────────────────────
  const { data: unsyncedBookings, error: fetchError } = await supabase
    .from("booking_request")
    .select("request_id,name,email,phone,tattoo_idea,requested_slot_id")
    .eq("status", "approved")
    .neq("google_calendar_sync_status", "synced")
    .returns<UnsyncedBooking[]>();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { requestId: string; error: string }[] = [];

  if (unsyncedBookings && unsyncedBookings.length > 0) {
    const slotIds = [
      ...new Set(unsyncedBookings.map((b) => b.requested_slot_id).filter(Boolean)),
    ] as string[];

    const { data: slots, error: slotError } = await supabase
      .from("slot")
      .select("slot_id,start_time,end_time")
      .in("slot_id", slotIds)
      .returns<SlotRow[]>();

    if (slotError) {
      return NextResponse.json({ error: slotError.message }, { status: 500 });
    }

    const slotMap = new Map((slots ?? []).map((s) => [s.slot_id, s]));

    for (const booking of unsyncedBookings) {
      if (!booking.requested_slot_id) {
        // No slot ever assigned — skip silently.
        await supabase
          .from("booking_request")
          .update({ google_calendar_sync_status: "skipped", google_calendar_sync_error: "No slot attached." })
          .eq("request_id", booking.request_id);
        skipped++;
        continue;
      }

      const slot = slotMap.get(booking.requested_slot_id);
      if (!slot) {
        // Slot was deleted — skip instead of failing.
        await supabase
          .from("booking_request")
          .update({ google_calendar_sync_status: "skipped", google_calendar_sync_error: "Slot was deleted." })
          .eq("request_id", booking.request_id);
        skipped++;
        continue;
      }

      const result = await syncBookingToCalendar({ supabase, booking, slot });

      if (result.status === "synced") synced++;
      else if (result.status === "skipped") skipped++;
      else {
        failed++;
        errors.push({ requestId: String(booking.request_id), error: result.error ?? "Unknown error" });
      }
    }
  }

  // ── Phase 2: GCal → App ───────────────────────────────────────────────────
  // Only run if sync is enabled (needs Google credentials).
  let gcalDeleted = 0;

  if (artist?.google_calendar_sync_enabled) {
    const { data: syncedBookings } = await supabase
      .from("booking_request")
      .select("request_id,requested_slot_id,google_calendar_event_id")
      .eq("status", "approved")
      .eq("google_calendar_sync_status", "synced")
      .not("google_calendar_event_id", "is", null)
      .returns<SyncedBooking[]>();

    for (const booking of syncedBookings ?? []) {
      const check = await checkGoogleCalendarEvent(
        calendarId,
        booking.google_calendar_event_id,
        { artistId: artist.artist_id, supabase },
      );

      if (check.status !== "not_found") continue;

      // Event was deleted in Google Calendar — cancel the booking and free the slot.
      await supabase
        .from("booking_request")
        .update({
          status: "cancelled",
          google_calendar_event_id: null,
          google_calendar_sync_status: "skipped",
          google_calendar_sync_error: "Event deleted in Google Calendar.",
          google_calendar_synced_at: null,
        })
        .eq("request_id", booking.request_id);

      if (booking.requested_slot_id) {
        await supabase
          .from("slot")
          .update({ status: "available" })
          .eq("slot_id", booking.requested_slot_id);
      }

      gcalDeleted++;
    }
  }

  return NextResponse.json({ synced, skipped, failed, gcalDeleted, errors });
}
