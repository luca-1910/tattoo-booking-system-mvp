/* eslint-disable @typescript-eslint/no-explicit-any */
import { getValidAccessToken } from "@/utils/googleRefreshToken";

export const APP_CALENDAR_SOURCE = "tattoo-booking-mvp";

export type CalendarSyncStatus = "pending" | "synced" | "failed" | "skipped";

type CalendarEventInput = {
  calendarId: string;
  requestId: string;
  clientName: string;
  email: string | null;
  phone: string | null;
  tattooIdea: string | null;
  startTimeIso: string;
  endTimeIso: string;
};

type CalendarSyncResult =
  | { status: "synced"; eventId: string }
  | { status: "failed"; error: string }
  | { status: "skipped"; error: string };

/**
 * Creates a Google Calendar event for an approved booking.
 *
 * Pass `opts.artistId` + `opts.supabase` so tokens are read from / written
 * back to the `tattoo_artist` row (DB mode). Falls back to env vars when
 * those options are omitted (dev / legacy use).
 */
export async function createGoogleCalendarEvent(
  input: CalendarEventInput,
  opts?: { artistId?: string; supabase?: any },
): Promise<CalendarSyncResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { status: "skipped", error: "Google OAuth credentials are not configured." };
  }

  let accessToken: string;

  try {
    accessToken = await getValidAccessToken(opts?.artistId, opts?.supabase);
  } catch (error) {
    return {
      status: "failed",
      error: `Failed to get Google access token: ${getErrorMessage(error)}`,
    };
  }

  const payload = {
    summary: `Tattoo Appointment — ${input.clientName}`,
    description: [
      `Booking request ID: ${input.requestId}`,
      input.email ? `Email: ${input.email}` : null,
      input.phone ? `Phone: ${input.phone}` : null,
      input.tattooIdea ? `Tattoo idea: ${input.tattooIdea}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: input.startTimeIso },
    end: { dateTime: input.endTimeIso },
    extendedProperties: {
      private: {
        source: APP_CALENDAR_SOURCE,
        app_origin: "true",
        booking_request_id: input.requestId,
      },
    },
  };

  const eventRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const responseBody = await eventRes.json().catch(() => null);

  if (!eventRes.ok) {
    return {
      status: "failed",
      error: `Google Calendar API error (${eventRes.status}): ${JSON.stringify(responseBody)}`,
    };
  }

  const eventId = responseBody?.id;
  if (!eventId || typeof eventId !== "string") {
    return {
      status: "failed",
      error: "Google Calendar API did not return an event id.",
    };
  }

  return { status: "synced", eventId };
}

/**
 * Updates the start/end time of an existing Google Calendar event.
 */
export async function updateGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  patch: { startTimeIso: string; endTimeIso: string },
  opts?: { artistId?: string; supabase?: any },
): Promise<{ status: "updated" | "failed"; error?: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { status: "failed", error: "Google OAuth credentials are not configured." };
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(opts?.artistId, opts?.supabase);
  } catch (error) {
    return { status: "failed", error: `Failed to get Google access token: ${getErrorMessage(error)}` };
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start: { dateTime: patch.startTimeIso },
        end: { dateTime: patch.endTimeIso },
      }),
    },
  );

  if (res.ok) return { status: "updated" };

  const body = await res.json().catch(() => null);
  return { status: "failed", error: `Google Calendar API error (${res.status}): ${JSON.stringify(body)}` };
}

/**
 * Deletes a Google Calendar event.
 * Returns "deleted" on success, "not_found" if already gone, "failed" on error.
 */
export async function deleteGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  opts?: { artistId?: string; supabase?: any },
): Promise<{ status: "deleted" | "not_found" | "failed"; error?: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { status: "failed", error: "Google OAuth credentials are not configured." };
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(opts?.artistId, opts?.supabase);
  } catch (error) {
    return { status: "failed", error: `Failed to get Google access token: ${getErrorMessage(error)}` };
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (res.status === 204) return { status: "deleted" };
  if (res.status === 404 || res.status === 410) return { status: "not_found" };

  const body = await res.json().catch(() => null);
  return { status: "failed", error: `Google Calendar API error (${res.status}): ${JSON.stringify(body)}` };
}

/**
 * Checks whether a Google Calendar event still exists.
 * Returns "exists", "not_found", or "failed".
 */
export async function checkGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  opts?: { artistId?: string; supabase?: any },
): Promise<{ status: "exists" | "not_found" | "failed"; error?: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { status: "failed", error: "Google OAuth credentials are not configured." };
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(opts?.artistId, opts?.supabase);
  } catch (error) {
    return { status: "failed", error: `Failed to get Google access token: ${getErrorMessage(error)}` };
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (res.ok) return { status: "exists" };
  if (res.status === 404 || res.status === 410) return { status: "not_found" };

  const body = await res.json().catch(() => null);
  return { status: "failed", error: `Google Calendar API error (${res.status}): ${JSON.stringify(body)}` };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}
