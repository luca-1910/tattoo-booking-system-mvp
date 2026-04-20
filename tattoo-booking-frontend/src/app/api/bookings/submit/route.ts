import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServerClient";
import { sendBookingConfirmation } from "@/lib/email";

// ── Validation constants ──────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 200;
const MAX_TATTOO_IDEA_LENGTH = 2000;

// ── Types ─────────────────────────────────────────────────────────────────────

type SubmitBody = {
  name: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  tattoo_idea?: string | null;
  reference_image_url?: string | null;
  payment_proof_url?: string | null;
  slot_id: string;
};

type SlotRow = {
  slot_id: string;
  status: string;
  start_time: string;
  end_time: string;
};

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/bookings/submit
 *
 * Server-side booking submission. Advantages over the previous client-side
 * direct insert:
 *   1. Input is validated before it reaches the DB.
 *   2. Slot availability is checked server-side (eliminates stale in-memory reads).
 *   3. Confirmation email is sent immediately after the DB insert.
 *
 * Email failure is non-fatal — the booking is confirmed regardless.
 */
export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // ── Validate inputs ─────────────────────────────────────────────────────────
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const slotId = body.slot_id?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${MAX_NAME_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }
  if (!email) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "email format is invalid." }, { status: 400 });
  }
  if (!slotId) {
    return NextResponse.json({ error: "slot_id is required." }, { status: 400 });
  }
  if (body.tattoo_idea && body.tattoo_idea.length > MAX_TATTOO_IDEA_LENGTH) {
    return NextResponse.json(
      { error: `tattoo_idea must be ${MAX_TATTOO_IDEA_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const supabase = await supabaseServer();

  // ── Server-side slot availability check ────────────────────────────────────
  // This eliminates the client-side race where two users read the same
  // in-memory slot list and both submit before either is persisted.
  const { data: slot, error: slotError } = await supabase
    .from("slot")
    .select("slot_id,status,start_time,end_time")
    .eq("slot_id", slotId)
    .maybeSingle<SlotRow>();

  if (slotError) {
    return NextResponse.json({ error: slotError.message }, { status: 500 });
  }
  if (!slot) {
    return NextResponse.json({ error: "The selected slot does not exist." }, { status: 409 });
  }
  if (slot.status !== "available") {
    return NextResponse.json(
      { error: `This slot is not available (current status: ${slot.status}).` },
      { status: 409 },
    );
  }

  // ── Insert booking request ──────────────────────────────────────────────────
  const { data: inserted, error: insertError } = await supabase
    .from("booking_request")
    .insert({
      name,
      email,
      phone: body.phone ?? null,
      dob: body.dob ?? null,
      tattoo_idea: body.tattoo_idea ?? null,
      reference_image_url: body.reference_image_url ?? null,
      payment_proof_url: body.payment_proof_url ?? null,
      requested_slot_id: slotId,
      status: "pending",
    })
    .select("request_id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save booking request." },
      { status: 500 },
    );
  }

  // ── Send confirmation email (non-blocking) ──────────────────────────────────
  // A failed email must never prevent the client from getting a 200.
  const emailResult = await sendBookingConfirmation({
    to: email,
    clientName: name,
    slotStartTime: slot.start_time,
    slotEndTime: slot.end_time,
    requestId: inserted.request_id,
  });

  if (!emailResult.sent) {
    console.error("[submit] Confirmation email failed:", emailResult.error);
  }

  return NextResponse.json({
    ok: true,
    requestId: inserted.request_id,
    emailSent: emailResult.sent,
  });
}
