import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";
import {
  canTransitionBookingRequestStatus,
  normalizeBookingRequestStatus,
} from "@/lib/domain";
import { deleteGoogleCalendarEvent } from "@/lib/googleCalendar";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

type BookingRow = {
  request_id: string;
  status: string | null;
  requested_slot_id: string | null;
  google_calendar_event_id: string | null;
};

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const supabase = await supabaseServer();
  const { requestId } = await ctx.params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !isConfiguredAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("booking_request")
    .select("request_id,status,requested_slot_id,google_calendar_event_id")
    .eq("request_id", requestId)
    .maybeSingle<BookingRow>();

  if (bookingError) return NextResponse.json({ error: bookingError.message }, { status: 400 });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const currentStatus = normalizeBookingRequestStatus(booking.status);
  if (!canTransitionBookingRequestStatus(currentStatus, "cancelled")) {
    return NextResponse.json(
      { error: `Cannot cancel a booking with status '${currentStatus}'.` },
      { status: 409 },
    );
  }

  // Delete GCal event if one was synced.
  if (booking.google_calendar_event_id) {
    const { data: artist } = await supabase
      .from("tattoo_artist")
      .select("artist_id,calendar_id")
      .limit(1)
      .maybeSingle<{ artist_id: string; calendar_id: string | null }>();

    await deleteGoogleCalendarEvent(
      artist?.calendar_id ?? "primary",
      booking.google_calendar_event_id,
      { artistId: artist?.artist_id, supabase },
    );
  }

  // Cancel the booking.
  const { error: cancelError } = await supabase
    .from("booking_request")
    .update({
      status: "cancelled",
      google_calendar_event_id: null,
      google_calendar_sync_status: "skipped",
      google_calendar_sync_error: "Booking cancelled.",
      google_calendar_synced_at: null,
    })
    .eq("request_id", requestId);

  if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 400 });

  // Free the slot.
  if (booking.requested_slot_id) {
    await supabase
      .from("slot")
      .update({ status: "available" })
      .eq("slot_id", booking.requested_slot_id);
  }

  return NextResponse.json({ ok: true, bookingStatus: "cancelled" });
}
