import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";
import {
  canTransitionBookingRequestStatus,
  normalizeBookingRequestStatus,
} from "@/lib/domain";
import { sendBookingRejection } from "@/lib/email";

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

type BookingRejectRow = {
  request_id: string | number;
  status: string | null;
  name: string | null;
  email: string | null;
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
    .select("request_id,status,name,email")
    .eq("request_id", requestId)
    .maybeSingle<BookingRejectRow>();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 400 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking request not found." }, { status: 404 });
  }

  const normalizedStatus = normalizeBookingRequestStatus(booking.status);
  if (!canTransitionBookingRequestStatus(normalizedStatus, "rejected")) {
    return NextResponse.json(
      { error: `Cannot reject booking from status '${normalizedStatus}'.` },
      { status: 409 },
    );
  }

  const { error: rejectError } = await supabase
    .from("booking_request")
    .update({
      status: "rejected",
      rejected_by: user.id,
      rejected_at: new Date().toISOString(),
    })
    .eq("request_id", requestId);

  if (rejectError) {
    return NextResponse.json({ error: rejectError.message }, { status: 400 });
  }

  // Send rejection email — non-blocking, failure must not affect the 200 response.
  if (booking.email) {
    const emailResult = await sendBookingRejection({
      to: booking.email,
      clientName: booking.name ?? "Client",
    });
    if (!emailResult.sent) {
      console.error("[reject] Rejection email failed:", emailResult.error);
    }
  }

  return NextResponse.json({
    ok: true,
    bookingStatus: "rejected",
  });
}
