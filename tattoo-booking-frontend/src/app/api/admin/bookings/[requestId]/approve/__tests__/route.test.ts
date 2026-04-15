// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mocks (hoisted before imports) ──────────────────────────────────

vi.mock("@/lib/supabaseServerClient", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/lib/googleCalendar", () => ({
  APP_CALENDAR_SOURCE: "tattoo-booking-mvp",
  createGoogleCalendarEvent: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendBookingApproval: vi.fn(),
}));

// next/headers is only available in Next.js runtime; mock it so the module
// can be imported in Vitest without crashing.
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: () => {},
  }),
}));

import { POST } from "../route";
import { supabaseServer } from "@/lib/supabaseServerClient";
import { createGoogleCalendarEvent } from "@/lib/googleCalendar";
import { sendBookingApproval } from "@/lib/email";

// ── Fixture data ────────────────────────────────────────────────────────────

const mockAdminUser = {
  id: "admin-uid",
  email: "admin@example.com",
  app_metadata: { provider: "email" },
};

const mockBooking = {
  request_id: "req-1",
  status: "approved",
  requested_slot_id: "slot-1",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "555-1234",
  tattoo_idea: "A rose on my wrist",
};

const mockSlot = {
  slot_id: "slot-1",
  status: "booked",
  start_time: "2025-07-01T10:00:00.000Z",
  end_time: "2025-07-01T11:00:00.000Z",
};

const mockArtistCalendarEnabled = {
  id: "artist-1",
  calendar_id: "artist@gmail.com",
  google_calendar_sync_enabled: true,
};

const mockArtistCalendarDisabled = {
  id: "artist-1",
  calendar_id: "artist@gmail.com",
  google_calendar_sync_enabled: false,
};

// ── Mock builder ────────────────────────────────────────────────────────────

/**
 * Builds a mock Supabase client tailored for the approve route.
 * Override only what you need per test.
 */
function buildSupabaseMock({
  user = mockAdminUser,
  userError = null,
  rpcData = [{ ok: true, code: "ok", message: "" }],
  rpcError = null as null | { message: string },
  booking = mockBooking as typeof mockBooking | null,
  bookingQueryError = null as null | { message: string },
  slot = mockSlot as typeof mockSlot | null,
  slotQueryError = null as null | { message: string },
  artist = mockArtistCalendarEnabled as object | null,
  artistQueryError = null as null | { message: string },
} = {}) {
  // Track how many times `from('booking_request')` is called:
  // 1st call = select (fetch booking after RPC)
  // 2nd+ calls = update (persist calendar sync result)
  let bookingRequestCalls = 0;

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "booking_request") {
      bookingRequestCalls++;
      if (bookingRequestCalls === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: booking,
                error: bookingQueryError,
              }),
            }),
          }),
        };
      }
      // subsequent calls are `.update().eq()`
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }

    if (table === "slot") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: slot,
              error: slotQueryError,
            }),
          }),
        }),
      };
    }

    if (table === "tattoo_artist") {
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: artist,
              error: artistQueryError,
            }),
          }),
        }),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userError ? null : user },
        error: userError,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
    from: mockFrom,
  };
}

function makeRequest(requestId = "req-1") {
  return new NextRequest(
    `http://localhost:3000/api/admin/bookings/${requestId}/approve`,
    { method: "POST" },
  );
}

function makeContext(requestId = "req-1") {
  return { params: Promise.resolve({ requestId }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no ADMIN_EMAIL/ADMIN_UID restriction so any user passes
  vi.unstubAllEnvs();
  // Email is non-blocking — default to success so it doesn't interfere with other tests
  vi.mocked(sendBookingApproval).mockResolvedValue({ sent: true, messageId: "msg-approve" });
});

describe("POST /api/admin/bookings/[requestId]/approve", () => {
  it("returns 403 when no authenticated user", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ user: undefined, userError: { message: "Not signed in" } }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 400 when the approve RPC returns an error", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        rpcData: [],
        rpcError: { message: "DB constraint violation" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("DB constraint violation");
  });

  it("returns 404 when RPC signals not_found", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        rpcData: [{ ok: false, code: "not_found", message: "Booking not found" }],
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Booking not found");
  });

  it("returns 409 when RPC signals slot_unavailable", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        rpcData: [{ ok: false, code: "slot_unavailable", message: "Slot is taken" }],
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(409);
  });

  it("returns 409 when RPC signals invalid_state", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        rpcData: [{ ok: false, code: "invalid_state", message: "Wrong state" }],
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(409);
  });

  it("returns 400 for generic RPC failure", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        rpcData: [{ ok: false, code: "unknown", message: "Something went wrong" }],
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 500 when RPC returns empty data array", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ rpcData: [] }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 400 when the booking row cannot be fetched after approval", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        booking: null,
        bookingQueryError: { message: "Row not found" },
      }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 200 with calendarSyncStatus='skipped' when sync is disabled", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ artist: mockArtistCalendarDisabled }) as never,
    );
    vi.mocked(createGoogleCalendarEvent).mockResolvedValue({
      status: "skipped",
      error: "sync disabled",
    });

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.bookingStatus).toBe("approved");
    // Calendar sync is skipped because artist.google_calendar_sync_enabled = false
    expect(body.calendarSyncStatus).toBe("skipped");
  });

  it("returns 200 with calendarSyncStatus='synced' on full success", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock() as never,
    );
    vi.mocked(createGoogleCalendarEvent).mockResolvedValue({
      status: "synced",
      eventId: "gcal-event-123",
    });

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.bookingStatus).toBe("approved");
    expect(body.calendarSyncStatus).toBe("synced");
    expect(body.calendarEventId).toBe("gcal-event-123");
  });

  it("approval succeeds even when Google Calendar sync fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock() as never,
    );
    vi.mocked(createGoogleCalendarEvent).mockResolvedValue({
      status: "failed",
      error: "Token expired",
    });

    const res = await POST(makeRequest(), makeContext());
    // Booking is still approved — calendar failure must not block this
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.bookingStatus).toBe("approved");
    expect(body.calendarSyncStatus).toBe("failed");
    expect(body.calendarSyncError).toBe("Token expired");
  });

  it("returns 200 with calendarSyncStatus='skipped' when no Google credentials configured", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ artist: null }) as never,
    );

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.calendarSyncStatus).toBe("skipped");
  });

  it("calls sendBookingApproval with client email and slot times on success", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    vi.mocked(createGoogleCalendarEvent).mockResolvedValue({ status: "synced", eventId: "evt-1" });

    await POST(makeRequest(), makeContext());

    expect(sendBookingApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        to: mockBooking.email,
        clientName: mockBooking.name,
        slotStartTime: mockSlot.start_time,
        slotEndTime: mockSlot.end_time,
      }),
    );
  });

  it("still returns 200 even when sendBookingApproval fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    vi.mocked(createGoogleCalendarEvent).mockResolvedValue({ status: "synced", eventId: "evt-1" });
    vi.mocked(sendBookingApproval).mockResolvedValue({ sent: false, error: "SMTP down" });

    const res = await POST(makeRequest(), makeContext());
    // Approval must succeed regardless of email failure
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.bookingStatus).toBe("approved");
  });

  it("does not call sendBookingApproval when the RPC fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ rpcError: { message: "DB error" } }) as never,
    );

    await POST(makeRequest(), makeContext());

    expect(sendBookingApproval).not.toHaveBeenCalled();
  });
});
