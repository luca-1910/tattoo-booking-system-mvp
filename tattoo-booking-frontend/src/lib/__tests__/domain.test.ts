import { describe, it, expect } from "vitest";
import {
  normalizeSlotStatus,
  normalizeBookingRequestStatus,
  canTransitionBookingRequestStatus,
  BOOKING_REQUEST_ALLOWED_TRANSITIONS,
  SLOT_STATUSES,
  BOOKING_REQUEST_STATUSES,
} from "../domain";

// ─── normalizeSlotStatus ────────────────────────────────────────────────────

describe("normalizeSlotStatus", () => {
  it("maps lowercase canonical values to themselves", () => {
    for (const s of SLOT_STATUSES) {
      expect(normalizeSlotStatus(s)).toBe(s);
    }
  });

  it("maps Title-cased legacy values correctly", () => {
    expect(normalizeSlotStatus("Available")).toBe("available");
    expect(normalizeSlotStatus("Booked")).toBe("booked");
    expect(normalizeSlotStatus("Blocked")).toBe("blocked");
    expect(normalizeSlotStatus("Completed")).toBe("completed");
    expect(normalizeSlotStatus("Cancelled")).toBe("cancelled");
  });

  it("maps 'open' / 'Open' legacy aliases to 'available'", () => {
    expect(normalizeSlotStatus("open")).toBe("available");
    expect(normalizeSlotStatus("Open")).toBe("available");
  });

  it("returns null for null input", () => {
    expect(normalizeSlotStatus(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeSlotStatus(undefined)).toBeNull();
  });

  it("returns null for unknown strings", () => {
    expect(normalizeSlotStatus("PENDING")).toBeNull();
    expect(normalizeSlotStatus("random")).toBeNull();
    expect(normalizeSlotStatus("")).toBeNull();
  });
});

// ─── normalizeBookingRequestStatus ─────────────────────────────────────────

describe("normalizeBookingRequestStatus", () => {
  it("maps all canonical statuses correctly (case-insensitive)", () => {
    const nonPending = BOOKING_REQUEST_STATUSES.filter((s) => s !== "pending");
    for (const s of nonPending) {
      expect(normalizeBookingRequestStatus(s)).toBe(s);
      expect(normalizeBookingRequestStatus(s.toUpperCase())).toBe(s);
    }
  });

  it("defaults null to 'pending'", () => {
    expect(normalizeBookingRequestStatus(null)).toBe("pending");
  });

  it("defaults undefined to 'pending'", () => {
    expect(normalizeBookingRequestStatus(undefined)).toBe("pending");
  });

  it("defaults unknown strings to 'pending'", () => {
    expect(normalizeBookingRequestStatus("garbage")).toBe("pending");
    expect(normalizeBookingRequestStatus("")).toBe("pending");
  });
});

// ─── canTransitionBookingRequestStatus ─────────────────────────────────────

describe("canTransitionBookingRequestStatus", () => {
  it("allows all transitions defined in the allowed-transitions map", () => {
    for (const [from, targets] of Object.entries(
      BOOKING_REQUEST_ALLOWED_TRANSITIONS,
    )) {
      for (const to of targets) {
        expect(
          canTransitionBookingRequestStatus(
            from as Parameters<typeof canTransitionBookingRequestStatus>[0],
            to,
          ),
        ).toBe(true);
      }
    }
  });

  it("returns true when transitioning to the same status", () => {
    for (const s of BOOKING_REQUEST_STATUSES) {
      expect(canTransitionBookingRequestStatus(s, s)).toBe(true);
    }
  });

  it("blocks transitions from terminal states to other statuses", () => {
    const terminalStates = ["rejected", "completed", "cancelled", "expired"] as const;
    const otherStatuses = BOOKING_REQUEST_STATUSES.filter(
      (s) => !terminalStates.includes(s as (typeof terminalStates)[number]),
    );

    for (const terminal of terminalStates) {
      for (const other of otherStatuses) {
        expect(canTransitionBookingRequestStatus(terminal, other)).toBe(false);
      }
    }
  });

  it("pending → approved is allowed", () => {
    expect(canTransitionBookingRequestStatus("pending", "approved")).toBe(true);
  });

  it("pending → rejected is allowed", () => {
    expect(canTransitionBookingRequestStatus("pending", "rejected")).toBe(true);
  });

  it("approved → completed is allowed", () => {
    expect(canTransitionBookingRequestStatus("approved", "completed")).toBe(true);
  });

  it("approved → cancelled is allowed", () => {
    expect(canTransitionBookingRequestStatus("approved", "cancelled")).toBe(true);
  });

  it("rejected → approved is NOT allowed", () => {
    expect(canTransitionBookingRequestStatus("rejected", "approved")).toBe(false);
  });

  it("completed → pending is NOT allowed", () => {
    expect(canTransitionBookingRequestStatus("completed", "pending")).toBe(false);
  });
});
