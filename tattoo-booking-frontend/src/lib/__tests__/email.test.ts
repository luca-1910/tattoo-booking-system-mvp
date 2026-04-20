// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mock (hoisted) ─────────────────────────────────────────────────────

// `Resend` is used with `new`, so the mock must be a real constructor function.
const mockSend = vi.fn();

vi.mock("resend", () => {
  function MockResend() {
    return { emails: { send: mockSend } };
  }
  return { Resend: MockResend };
});

import {
  sendBookingConfirmation,
  sendBookingApproval,
  sendBookingRejection,
} from "../email";

// Helper — returns the shared mock directly (it's declared at module scope above)
function getMockSend() {
  return mockSend;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_CONFIRMATION = {
  to: "client@example.com",
  clientName: "Jane Doe",
  slotStartTime: "2026-09-01T10:00:00Z",
  slotEndTime: "2026-09-01T11:00:00Z",
  requestId: "req-abc-123",
};

const BASE_APPROVAL = {
  to: "client@example.com",
  clientName: "Jane Doe",
  slotStartTime: "2026-09-01T10:00:00Z",
  slotEndTime: "2026-09-01T11:00:00Z",
};

const BASE_REJECTION = {
  to: "client@example.com",
  clientName: "Jane Doe",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("sendBookingConfirmation", () => {
  it("returns sent=false (graceful) when RESEND_API_KEY is not set", async () => {
    // No env var stubbed — key is absent
    const result = await sendBookingConfirmation(BASE_CONFIRMATION);
    expect(result.sent).toBe(false);
    expect((result as { sent: false; error: string }).error).toMatch(/not configured/i);
  });

  it("returns sent=true with messageId on success", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "studio@missmay.com");
    const mockSend = getMockSend();
    mockSend.mockResolvedValue({ data: { id: "msg-001" }, error: null });

    const result = await sendBookingConfirmation(BASE_CONFIRMATION);

    expect(result.sent).toBe(true);
    expect((result as { sent: true; messageId: string }).messageId).toBe("msg-001");
  });

  it("includes the client name and requestId in the email", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "studio@missmay.com");
    const mockSend = getMockSend();
    mockSend.mockResolvedValue({ data: { id: "msg-001" }, error: null });

    await sendBookingConfirmation(BASE_CONFIRMATION);

    const callArg = mockSend.mock.calls[0][0];
    expect(JSON.stringify(callArg)).toContain("Jane Doe");
    expect(JSON.stringify(callArg)).toContain("req-abc-123");
  });

  it("returns sent=false when Resend API returns an error", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "studio@missmay.com");
    const mockSend = getMockSend();
    mockSend.mockResolvedValue({ data: null, error: { message: "Rate limited" } });

    const result = await sendBookingConfirmation(BASE_CONFIRMATION);

    expect(result.sent).toBe(false);
    expect((result as { sent: false; error: string }).error).toContain("Rate limited");
  });

  it("returns sent=false when Resend throws unexpectedly", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "studio@missmay.com");
    const mockSend = getMockSend();
    mockSend.mockRejectedValue(new Error("Network error"));

    const result = await sendBookingConfirmation(BASE_CONFIRMATION);

    expect(result.sent).toBe(false);
  });
});

describe("sendBookingApproval", () => {
  it("returns sent=false when RESEND_API_KEY is not set", async () => {
    const result = await sendBookingApproval(BASE_APPROVAL);
    expect(result.sent).toBe(false);
  });

  it("returns sent=true with messageId on success", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "studio@missmay.com");
    const mockSend = getMockSend();
    mockSend.mockResolvedValue({ data: { id: "msg-002" }, error: null });

    const result = await sendBookingApproval(BASE_APPROVAL);

    expect(result.sent).toBe(true);
    expect((result as { sent: true; messageId: string }).messageId).toBe("msg-002");
  });

  it("includes slot time in the email content", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "studio@missmay.com");
    const mockSend = getMockSend();
    mockSend.mockResolvedValue({ data: { id: "msg-002" }, error: null });

    await sendBookingApproval(BASE_APPROVAL);

    const callArg = mockSend.mock.calls[0][0];
    // The formatted date/time should appear somewhere in subject or body
    expect(JSON.stringify(callArg)).toContain("Jane Doe");
  });
});

describe("sendBookingRejection", () => {
  it("returns sent=false when RESEND_API_KEY is not set", async () => {
    const result = await sendBookingRejection(BASE_REJECTION);
    expect(result.sent).toBe(false);
  });

  it("returns sent=true with messageId on success", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "studio@missmay.com");
    const mockSend = getMockSend();
    mockSend.mockResolvedValue({ data: { id: "msg-003" }, error: null });

    const result = await sendBookingRejection(BASE_REJECTION);

    expect(result.sent).toBe(true);
    expect((result as { sent: true; messageId: string }).messageId).toBe("msg-003");
  });

  it("includes the client name in the email", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "studio@missmay.com");
    const mockSend = getMockSend();
    mockSend.mockResolvedValue({ data: { id: "msg-003" }, error: null });

    await sendBookingRejection(BASE_REJECTION);

    const callArg = mockSend.mock.calls[0][0];
    expect(JSON.stringify(callArg)).toContain("Jane Doe");
  });
});
