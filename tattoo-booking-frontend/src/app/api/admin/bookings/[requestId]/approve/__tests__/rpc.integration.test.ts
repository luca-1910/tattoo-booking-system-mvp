// @vitest-environment node
/**
 * Integration test — runs against the real hosted Supabase project.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY=<service_role_jwt>
 *
 * Run with:
 *   npm run test:integration
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// ── Client ──────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local",
  );
}

// Service-role client: bypasses RLS for seed / teardown
const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// ── Seed state ───────────────────────────────────────────────────────────────

let seededSlotId: string | null = null;
let seededRequestId: string | null = null;

beforeEach(async () => {
  // 1. Create an available slot in the future
  const { data: slot, error: slotErr } = await db
    .from("slot")
    .insert({
      start_time: "2026-09-01T10:00:00Z",
      end_time: "2026-09-01T11:00:00Z",
      status: "available",
    })
    .select("slot_id")
    .single();

  if (slotErr || !slot) throw new Error(`Slot seed failed: ${slotErr?.message}`);
  seededSlotId = slot.slot_id;

  // 2. Create a pending booking request pointing at that slot
  const { data: booking, error: bookingErr } = await db
    .from("booking_request")
    .insert({
      name: "Integration Test Client",
      email: "integration-test@example.com",
      phone: null,
      dob: null,
      tattoo_idea: "A dragon",
      requested_slot_id: seededSlotId,
      status: "pending",
    })
    .select("request_id")
    .single();

  if (bookingErr || !booking)
    throw new Error(`Booking seed failed: ${bookingErr?.message}`);
  seededRequestId = booking.request_id;
});

afterEach(async () => {
  // Clean up in dependency order: booking first, then slot
  if (seededRequestId) {
    await db.from("booking_request").delete().eq("request_id", seededRequestId);
    seededRequestId = null;
  }
  if (seededSlotId) {
    await db.from("slot").delete().eq("slot_id", seededSlotId);
    seededSlotId = null;
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("approve_booking_request RPC (real DB)", () => {
  it("returns ok=true and flips booking to approved + slot to booked", async () => {
    const { data, error } = await db.rpc("approve_booking_request", {
      p_request_id: seededRequestId,
      p_admin_user_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].ok).toBe(true);
    expect(data[0].code).toBe("ok");

    // Verify slot status in DB
    const { data: slot } = await db
      .from("slot")
      .select("status")
      .eq("slot_id", seededSlotId)
      .single();
    expect(slot?.status).toBe("booked");

    // Verify booking_request status in DB
    const { data: booking } = await db
      .from("booking_request")
      .select("status")
      .eq("request_id", seededRequestId)
      .single();
    expect(booking?.status).toBe("approved");
  });

  it("returns not_found when the request_id does not exist", async () => {
    const { data, error } = await db.rpc("approve_booking_request", {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_admin_user_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).toBeNull();
    expect(data[0].ok).toBe(false);
    expect(data[0].code).toBe("not_found");
  });

  it("returns invalid_state when trying to approve an already-approved booking", async () => {
    // Approve once
    await db.rpc("approve_booking_request", {
      p_request_id: seededRequestId,
      p_admin_user_id: "00000000-0000-0000-0000-000000000000",
    });

    // Approve again — should fail
    const { data, error } = await db.rpc("approve_booking_request", {
      p_request_id: seededRequestId,
      p_admin_user_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).toBeNull();
    expect(data[0].ok).toBe(false);
    // RPC should signal either invalid_state or slot_unavailable
    expect(["invalid_state", "slot_unavailable"]).toContain(data[0].code);
  });
});
