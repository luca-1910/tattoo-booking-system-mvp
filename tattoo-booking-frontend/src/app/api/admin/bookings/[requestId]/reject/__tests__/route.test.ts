// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/supabaseServerClient", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: () => {},
  }),
}));

vi.mock("@/lib/email", () => ({
  sendBookingRejection: vi.fn(),
}));

import { POST } from "../route";
import { supabaseServer } from "@/lib/supabaseServerClient";
import { sendBookingRejection } from "@/lib/email";

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockAdminUser = {
  id: "admin-uid",
  email: "admin@example.com",
  app_metadata: { provider: "email" },
};

// ── Mock builder ────────────────────────────────────────────────────────────

function buildSupabaseMock({
  user = mockAdminUser,
  userError = null as null | { message: string },
  booking = { request_id: "req-1", status: "pending", name: "Jane Doe", email: "jane@example.com" } as object | null,
  bookingQueryError = null as null | { message: string },
  updateError = null as null | { message: string },
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userError ? null : user },
        error: userError,
      }),
    },
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybySingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: booking,
            error: bookingQueryError,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: updateError }),
      }),
    })),
  };
}

function makeRequest(requestId = "req-1") {
  return new NextRequest(
    `http://localhost:3000/api/admin/bookings/${requestId}/reject`,
    { method: "POST" },
  );
}

function makeContext(requestId = "req-1") {
  return { params: Promise.resolve({ requestId }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.mocked(sendBookingRejection).mockResolvedValue({ sent: true, messageId: "msg-reject" });
});

describe("POST /api/admin/bookings/[requestId]/reject", () => {
  it("returns 403 when not authenticated", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ userError: { message: "Not signed in" } }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 404 when booking does not exist", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ booking: null }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 when the booking query itself fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        bookingQueryError: { message: "Query failed" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query failed");
  });

  it("returns 200 idempotently when booking is already rejected", async () => {
    // canTransitionBookingRequestStatus("rejected", "rejected") returns true
    // because same → same is always allowed, making this an idempotent no-op.
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: { request_id: "req-1", status: "rejected" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 409 when booking is in a terminal state (completed)", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: { request_id: "req-1", status: "completed" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(409);
  });

  it("returns 409 when booking is in a terminal state (cancelled)", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: { request_id: "req-1", status: "cancelled" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(409);
  });

  it("returns 200 and bookingStatus='rejected' for a pending booking", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: { request_id: "req-1", status: "pending" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.bookingStatus).toBe("rejected");
  });

  it("returns 200 for an approved booking being rejected", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: { request_id: "req-1", status: "approved" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    // approved → cancelled is allowed, but approved → rejected is NOT per domain
    // This verifies the route respects the domain state machine
    expect(res.status).toBe(409);
  });

  it("returns 400 when the DB update fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: { request_id: "req-1", status: "pending" },
        updateError: { message: "Update failed" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Update failed");
  });

  it("calls sendBookingRejection with client email on success", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: { request_id: "req-1", status: "pending", name: "Jane Doe", email: "jane@example.com" },
      }) as never,
    );

    await POST(makeRequest(), makeContext());

    expect(sendBookingRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        clientName: "Jane Doe",
      }),
    );
  });

  it("still returns 200 even when sendBookingRejection fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    vi.mocked(sendBookingRejection).mockResolvedValue({ sent: false, error: "SMTP down" });

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("does not call sendBookingRejection when the DB update fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: { request_id: "req-1", status: "pending" },
        updateError: { message: "Update failed" },
      }) as never,
    );

    await POST(makeRequest(), makeContext());

    expect(sendBookingRejection).not.toHaveBeenCalled();
  });
});
