export const SLOT_STATUSES = [
  "available",
  "booked",
  "blocked",
  "completed",
  "cancelled",
] as const;

export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const BOOKING_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "completed",
  "cancelled",
  "expired",
] as const;

export type BookingRequestStatus = (typeof BOOKING_REQUEST_STATUSES)[number];

export const BOOKING_REQUEST_ALLOWED_TRANSITIONS: Record<
  BookingRequestStatus,
  BookingRequestStatus[]
> = {
  pending: ["approved", "rejected", "expired", "cancelled"],
  approved: ["completed", "cancelled"],
  rejected: [],
  completed: [],
  cancelled: [],
  expired: [],
};

export const GOOGLE_CALENDAR_SYNC_STATUSES = [
  "pending",
  "synced",
  "failed",
  "skipped",
] as const;

export type GoogleCalendarSyncStatus =
  (typeof GOOGLE_CALENDAR_SYNC_STATUSES)[number];

const LEGACY_SLOT_STATUS_MAP: Record<string, SlotStatus> = {
  available: "available",
  Available: "available",
  open: "available",
  Open: "available",
  booked: "booked",
  Booked: "booked",
  blocked: "blocked",
  Blocked: "blocked",
  completed: "completed",
  Completed: "completed",
  cancelled: "cancelled",
  Cancelled: "cancelled",
};

export function normalizeSlotStatus(value: string | null | undefined): SlotStatus | null {
  if (!value) return null;
  return LEGACY_SLOT_STATUS_MAP[value] ?? null;
}

export function normalizeBookingRequestStatus(
  value: string | null | undefined,
): BookingRequestStatus {
  switch ((value ?? "pending").toLowerCase()) {
    case "approved":
    case "rejected":
    case "completed":
    case "cancelled":
    case "expired":
      return value!.toLowerCase() as BookingRequestStatus;
    default:
      return "pending";
  }
}

export function canTransitionBookingRequestStatus(
  from: BookingRequestStatus,
  to: BookingRequestStatus,
): boolean {
  if (from === to) return true;
  return BOOKING_REQUEST_ALLOWED_TRANSITIONS[from].includes(to);
}
