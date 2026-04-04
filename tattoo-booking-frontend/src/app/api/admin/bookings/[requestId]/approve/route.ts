import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import {
  APP_CALENDAR_SOURCE,
  createGoogleCalendarEvent,
  type CalendarSyncStatus,
} from "@/lib/googleCalendar";
import { supabaseServer } from "@/lib/supabaseServerClient";

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

type BookingApprovalRow = {
  request_id: string | number;
  status: string | null;
  requested_slot_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  tattoo_idea: string | null;
};

type SlotRow = {
  slot_id: string;
  status: string | null;
  start_time: string;
  end_time: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;
type ApprovalRpcResult = { ok: boolean; code: string; message: string };

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const supabase = await supabaseServer();
  const { requestId } = await ctx.params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

<<<<<<< ours
  if (userError || !isConfiguredAdmin(user)) {
=======
  if (userError || !user || !isConfiguredAdmin(user)) {
>>>>>>> theirs
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: approvalData, error: approvalError } = await supabase.rpc(
    "approve_booking_request",
<<<<<<< ours
    { p_request_id: requestId },
=======
    {
      p_request_id: requestId,
      p_admin_user_id: user.id,
    },
>>>>>>> theirs
  );

  if (approvalError) {
    return NextResponse.json({ error: approvalError.message }, { status: 400 });
  }

  const approvalResult = (approvalData?.[0] ?? null) as ApprovalRpcResult | null;
  if (!approvalResult) {
    return NextResponse.json({ error: "Approval flow failed." }, { status: 500 });
  }

  if (!approvalResult.ok) {
    if (approvalResult.code === "not_found") {
      return NextResponse.json({ error: approvalResult.message }, { status: 404 });
    }
    if (approvalResult.code === "missing_slot") {
      return NextResponse.json({ error: approvalResult.message }, { status: 400 });
    }
    if (approvalResult.code === "slot_unavailable" || approvalResult.code === "invalid_state") {
      return NextResponse.json({ error: approvalResult.message }, { status: 409 });
    }

    return NextResponse.json({ error: approvalResult.message }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("booking_request")
    .select("request_id,status,requested_slot_id,name,email,phone,tattoo_idea")
    .eq("request_id", requestId)
    .maybeSingle<BookingApprovalRow>();

  if (bookingError || !booking) {
    return NextResponse.json(
      { error: bookingError?.message || "Approved booking not found." },
      { status: 400 },
    );
  }

  if (!booking.requested_slot_id) {
    return NextResponse.json({ error: "Approved booking has no slot." }, { status: 400 });
  }

  const { data: slot, error: slotError } = await supabase
    .from("slot")
    .select("slot_id,status,start_time,end_time")
    .eq("slot_id", booking.requested_slot_id)
    .maybeSingle<SlotRow>();

  if (slotError || !slot) {
    return NextResponse.json(
      { error: slotError?.message || "Booked slot not found." },
      { status: 400 },
    );
  }

  const approvalTimestamp = new Date().toISOString();

  const syncResult = await syncBookingToCalendar({
    supabase,
    booking,
    slot,
    requestId,
    attemptAt: approvalTimestamp,
  });

  return NextResponse.json({
    ok: true,
    bookingStatus: "approved",
    slotStatus: "booked",
    calendarSyncStatus: syncResult.status,
    calendarEventId: syncResult.eventId ?? null,
    calendarSyncError: syncResult.error ?? null,
  });
}

async function syncBookingToCalendar({
  supabase,
  booking,
  slot,
  requestId,
  attemptAt,
}: {
  supabase: SupabaseServerClient;
  booking: BookingApprovalRow;
  slot: SlotRow;
  requestId: string;
  attemptAt: string;
}): Promise<{ status: CalendarSyncStatus; eventId?: string; error?: string }> {
  const { data: artist, error: artistError } = await supabase
    .from("tattoo_artist")
    .select("calendar_id,google_calendar_sync_enabled")
    .limit(1)
    .maybeSingle<{ calendar_id: string | null; google_calendar_sync_enabled: boolean | null }>();

  if (artistError) {
    const errorMessage = `Failed to read calendar settings: ${artistError.message}`;
    await persistSyncFailure(supabase, requestId, attemptAt, errorMessage);
    return { status: "failed", error: errorMessage };
  }

  if (!artist?.google_calendar_sync_enabled) {
    const reason = "Google Calendar sync is disabled.";
    await persistSyncSkipped(supabase, requestId, attemptAt, reason);
    return { status: "skipped", error: reason };
  }

  if (!artist.calendar_id) {
    const reason = "Google Calendar ID is not configured.";
    await persistSyncSkipped(supabase, requestId, attemptAt, reason);
    return { status: "skipped", error: reason };
  }

  const syncResult = await createGoogleCalendarEvent({
    calendarId: artist.calendar_id,
    requestId,
    clientName: booking.name ?? "Client",
    email: booking.email,
    phone: booking.phone,
    tattooIdea: booking.tattoo_idea,
    startTimeIso: slot.start_time,
    endTimeIso: slot.end_time,
  });

  if (syncResult.status === "synced") {
    await supabase
      .from("booking_request")
      .update({
        google_calendar_sync_status: "synced",
        google_calendar_sync_error: null,
        google_calendar_event_id: syncResult.eventId,
        google_calendar_last_attempt_at: attemptAt,
        google_calendar_synced_at: attemptAt,
        google_calendar_event_origin: APP_CALENDAR_SOURCE,
      })
      .eq("request_id", requestId);

    return { status: "synced", eventId: syncResult.eventId };
  }

  if (syncResult.status === "skipped") {
    await persistSyncSkipped(supabase, requestId, attemptAt, syncResult.error);
    return { status: "skipped", error: syncResult.error };
  }

  await persistSyncFailure(supabase, requestId, attemptAt, syncResult.error);
  return { status: "failed", error: syncResult.error };
}

async function persistSyncSkipped(
  supabase: SupabaseServerClient,
  requestId: string,
  attemptAt: string,
  reason: string,
) {
  await supabase
    .from("booking_request")
    .update({
      google_calendar_sync_status: "skipped",
      google_calendar_sync_error: reason,
      google_calendar_last_attempt_at: attemptAt,
      google_calendar_synced_at: null,
      google_calendar_event_id: null,
      google_calendar_event_origin: APP_CALENDAR_SOURCE,
    })
    .eq("request_id", requestId);
}

async function persistSyncFailure(
  supabase: SupabaseServerClient,
  requestId: string,
  attemptAt: string,
  errorMessage: string,
) {
  await supabase
    .from("booking_request")
    .update({
      google_calendar_sync_status: "failed",
      google_calendar_sync_error: errorMessage,
      google_calendar_last_attempt_at: attemptAt,
      google_calendar_synced_at: null,
      google_calendar_event_origin: APP_CALENDAR_SOURCE,
    })
    .eq("request_id", requestId);
}
