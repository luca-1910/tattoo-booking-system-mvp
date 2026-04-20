import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";
import { deleteGoogleCalendarEvent, updateGoogleCalendarEvent } from "@/lib/googleCalendar";
import { toIsoLocal } from "@/lib/calendarUtils";

type RouteContext = {
  params: Promise<{ slotId: string }>;
};

type BookingRow = {
  request_id: string;
  google_calendar_event_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  tattoo_idea: string | null;
};

type ArtistRow = {
  artist_id: string;
  calendar_id: string | null;
};

/**
 * DELETE /api/admin/slots/[slotId]
 *
 * Deletes the slot and, if a synced booking exists for it,
 * also removes the corresponding Google Calendar event.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const supabase = await supabaseServer();
  const { slotId } = await ctx.params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !isConfiguredAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Find any approved booking linked to this slot that has a GCal event.
  const { data: booking } = await supabase
    .from("booking_request")
    .select("request_id,google_calendar_event_id")
    .eq("requested_slot_id", slotId)
    .eq("status", "approved")
    .not("google_calendar_event_id", "is", null)
    .maybeSingle<BookingRow>();

  // If there's a GCal event, delete it before removing the slot.
  if (booking?.google_calendar_event_id) {
    const { data: artist } = await supabase
      .from("tattoo_artist")
      .select("artist_id,calendar_id")
      .limit(1)
      .maybeSingle<ArtistRow>();

    const calendarId = artist?.calendar_id ?? "primary";

    const gcalResult = await deleteGoogleCalendarEvent(
      calendarId,
      booking.google_calendar_event_id,
      { artistId: artist?.artist_id, supabase },
    );

    if (gcalResult.status === "failed") {
      console.error("[deleteSlot] GCal event deletion failed:", gcalResult.error);
      // Non-fatal — continue with slot deletion.
    }

    // Clear the event reference on the booking regardless of GCal outcome.
    await supabase
      .from("booking_request")
      .update({
        google_calendar_event_id: null,
        google_calendar_sync_status: "skipped",
        google_calendar_sync_error: "Slot was deleted.",
        google_calendar_synced_at: null,
      })
      .eq("request_id", booking.request_id);
  }

  const { error: deleteError } = await supabase
    .from("slot")
    .delete()
    .eq("slot_id", slotId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/admin/slots/[slotId]
 *
 * Reschedules a slot. Body: { date: "YYYY-MM-DD", startTime: "HH:MM", endTime: "HH:MM" }
 * If the slot has an approved booking with a GCal event, the event is updated in place.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const supabase = await supabaseServer();
  const { slotId } = await ctx.params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !isConfiguredAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { date?: string; startTime?: string; endTime?: string };

  if (!body.date || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: "date, startTime, and endTime are required." }, { status: 400 });
  }

  const newStart = toIsoLocal(body.date, body.startTime);
  const newEnd = toIsoLocal(body.date, body.endTime);

  if (new Date(newEnd) <= new Date(newStart)) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  // Update the slot times.
  const { error: updateError } = await supabase
    .from("slot")
    .update({ start_time: newStart, end_time: newEnd })
    .eq("slot_id", slotId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  // Find an approved booking with a GCal event for this slot.
  const { data: booking } = await supabase
    .from("booking_request")
    .select("request_id,google_calendar_event_id,name,email,phone,tattoo_idea")
    .eq("requested_slot_id", slotId)
    .eq("status", "approved")
    .not("google_calendar_event_id", "is", null)
    .maybeSingle<BookingRow>();

  if (booking?.google_calendar_event_id) {
    const { data: artist } = await supabase
      .from("tattoo_artist")
      .select("artist_id,calendar_id")
      .limit(1)
      .maybeSingle<ArtistRow>();

    const calendarId = artist?.calendar_id ?? "primary";

    const gcalResult = await updateGoogleCalendarEvent(
      calendarId,
      booking.google_calendar_event_id,
      { startTimeIso: newStart, endTimeIso: newEnd },
      { artistId: artist?.artist_id, supabase },
    );

    if (gcalResult.status === "failed") {
      console.error("[rescheduleSlot] GCal update failed:", gcalResult.error);
      await supabase
        .from("booking_request")
        .update({
          google_calendar_sync_status: "failed",
          google_calendar_sync_error: gcalResult.error ?? "GCal update failed after reschedule.",
        })
        .eq("request_id", booking.request_id);
    }
  }

  return NextResponse.json({ ok: true, startTime: newStart, endTime: newEnd });
}
