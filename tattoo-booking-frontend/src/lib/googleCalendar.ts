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

export async function createGoogleCalendarEvent(
  input: CalendarEventInput,
): Promise<CalendarSyncResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { status: "skipped", error: "Google OAuth is not configured." };
  }

  let accessToken: string;

  try {
    accessToken = await getValidAccessToken();
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}
