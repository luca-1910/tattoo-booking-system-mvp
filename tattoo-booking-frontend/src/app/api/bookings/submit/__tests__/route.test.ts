// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock("@/lib/supabaseServerClient", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}));

import { POST } from "../route";
import { supabaseServer } from "@/lib/supabaseServerClient";
import { sendBookingConfirmation } from "@/lib/email";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_BODY = {
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "555-1234",
  dob: "1990-01-01",
  tattoo_idea: "A koi fish",
  reference_image_url: null,
  payment_proof_url: "https://example.com/proof.jpg",
  slot_id: "slot-uuid-123",
};

function buildSupabaseMock({
  slot = { slot_id: "slot-uuid-123", status: "available", start_time: "2026-09-01T10:00:00Z", end_time: "2026-09-01T11:00:00Z" } as object | null,
  slotError = null as { message: string } | null,
  insertError = null as { message: string } | null,
  insertedRequestId = "req-new-001",
} = {}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "slot") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: slot, error: slotError }),
            }),
          }),
        };
      }
      if (table === "booking_request") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: insertError ? null : { request_id: insertedRequestId },
                error: insertError,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  };
}

function makeRequest(body: object = VALID_BODY) {
  return new NextRequest("http://localhost:3000/api/bookings/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendBookingConfirmation).mockResolvedValue({ sent: true, messageId: "msg-1" });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/bookings/submit — validation", () => {
  it("returns 400 when name is missing", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await POST(makeRequest({ ...VALID_BODY, name: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it("returns 400 when email is missing", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await POST(makeRequest({ ...VALID_BODY, email: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 when email format is invalid", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await POST(makeRequest({ ...VALID_BODY, email: "not-an-email" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 when slot_id is missing", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await POST(makeRequest({ ...VALID_BODY, slot_id: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/slot/i);
  });

  it("returns 400 when name exceeds max length", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await POST(makeRequest({ ...VALID_BODY, name: "A".repeat(201) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tattoo_idea exceeds max length", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await POST(makeRequest({ ...VALID_BODY, tattoo_idea: "X".repeat(2001) }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bookings/submit — slot availability", () => {
  it("returns 409 when slot does not exist", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ slot: null }) as never,
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/slot/i);
  });

  it("returns 409 when slot is already booked", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ slot: { slot_id: "slot-uuid-123", status: "booked", start_time: "", end_time: "" } }) as never,
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/not available/i);
  });

  it("returns 409 when slot is blocked", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ slot: { slot_id: "slot-uuid-123", status: "blocked", start_time: "", end_time: "" } }) as never,
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
  });
});

describe("POST /api/bookings/submit — happy path", () => {
  it("returns 200 with requestId when submission succeeds", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.requestId).toBe("req-new-001");
  });

  it("calls sendBookingConfirmation with correct params on success", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);

    await POST(makeRequest());

    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        clientName: "Jane Doe",
        requestId: "req-new-001",
      }),
    );
  });

  it("still returns 200 even when sendBookingConfirmation fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    vi.mocked(sendBookingConfirmation).mockResolvedValue({ sent: false, error: "SMTP down" });

    const res = await POST(makeRequest());
    // Email failure must not block the booking
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("POST /api/bookings/submit — DB errors", () => {
  it("returns 500 when the booking_request insert fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ insertError: { message: "FK violation" } }) as never,
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
