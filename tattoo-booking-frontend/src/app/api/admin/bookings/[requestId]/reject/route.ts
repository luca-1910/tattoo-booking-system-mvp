import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";
<<<<<<< ours
<<<<<<< ours
import { normalizeBookingRequestStatus } from "@/lib/domain";
=======
=======
>>>>>>> theirs
import {
  canTransitionBookingRequestStatus,
  normalizeBookingRequestStatus,
} from "@/lib/domain";
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

type BookingRejectRow = {
  request_id: string | number;
  status: string | null;
};

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const supabase = await supabaseServer();
  const { requestId } = await ctx.params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

<<<<<<< ours
<<<<<<< ours
  if (userError || !isConfiguredAdmin(user)) {
=======
  if (userError || !user || !isConfiguredAdmin(user)) {
>>>>>>> theirs
=======
  if (userError || !user || !isConfiguredAdmin(user)) {
>>>>>>> theirs
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("booking_request")
    .select("request_id,status")
    .eq("request_id", requestId)
    .maybeSingle<BookingRejectRow>();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 400 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking request not found." }, { status: 404 });
  }

  const normalizedStatus = normalizeBookingRequestStatus(booking.status);
<<<<<<< ours
<<<<<<< ours
  if (normalizedStatus !== "pending") {
    return NextResponse.json(
      { error: "Only pending booking requests can be rejected." },
=======
  if (!canTransitionBookingRequestStatus(normalizedStatus, "rejected")) {
    return NextResponse.json(
      { error: `Cannot reject booking from status '${normalizedStatus}'.` },
>>>>>>> theirs
=======
  if (!canTransitionBookingRequestStatus(normalizedStatus, "rejected")) {
    return NextResponse.json(
      { error: `Cannot reject booking from status '${normalizedStatus}'.` },
>>>>>>> theirs
      { status: 409 },
    );
  }

  const { error: rejectError } = await supabase
    .from("booking_request")
<<<<<<< ours
<<<<<<< ours
    .update({ status: "rejected" })
=======
=======
>>>>>>> theirs
    .update({
      status: "rejected",
      rejected_by: user.id,
      rejected_at: new Date().toISOString(),
    })
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    .eq("request_id", requestId);

  if (rejectError) {
    return NextResponse.json({ error: rejectError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    bookingStatus: "rejected",
  });
}
