import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";
import { sendBookingApproval } from "@/lib/email";
import { syncBookingToCalendar, type SyncResult } from "@/lib/calendarSyncHelpers";

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

type ApprovalRpcResult = { ok: boolean; code: string; message: string };

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

  const { data: approvalData, error: approvalError } = await supabase.rpc(
    "approve_booking_request",
    {
      p_request_id: requestId,
      p_admin_user_id: user.id,
    },
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

  // Send approval email — non-blocking, same pattern as calendar sync.
  if (booking.email) {
    const emailResult = await sendBookingApproval({
      to: booking.email,
      clientName: booking.name ?? "Client",
      slotStartTime: slot.start_time,
      slotEndTime: slot.end_time,
    });
    if (!emailResult.sent) {
      console.error("[approve] Approval email failed:", emailResult.error);
    }
  }

  const syncResult: SyncResult = await syncBookingToCalendar({ supabase, booking, slot });

  return NextResponse.json({
    ok: true,
    bookingStatus: "approved",
    slotStatus: "booked",
    calendarSyncStatus: syncResult.status,
    calendarEventId: syncResult.eventId ?? null,
    calendarSyncError: syncResult.error ?? null,
  });
}
