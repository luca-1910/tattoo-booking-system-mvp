import { Resend } from "resend";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmailResult =
  | { sent: true; messageId: string }
  | { sent: false; error: string };

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns a configured Resend client, or null if the API key is absent.
 * Email sending is always optional — a missing key gracefully disables it
 * rather than crashing the server.
 */
function getClient(): { client: Resend; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const from = process.env.EMAIL_FROM ?? "MissMay Tattoos <noreply@missmay.com>";
  return { client: new Resend(apiKey), from };
}

/** Formats an ISO datetime string into a human-readable local string. */
function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  const resolved = getClient();
  if (!resolved) {
    return { sent: false, error: "Email service not configured (RESEND_API_KEY missing)." };
  }

  try {
    const { data, error } = await resolved.client.emails.send({
      from: resolved.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error || !data?.id) {
      return { sent: false, error: error?.message ?? "Resend returned no message id." };
    }

    return { sent: true, messageId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { sent: false, error: message };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sent to the client immediately after they submit a booking request.
 */
export async function sendBookingConfirmation(params: {
  to: string;
  clientName: string;
  slotStartTime: string;
  slotEndTime: string;
  requestId: string;
}): Promise<EmailResult> {
  const { clientName, slotStartTime, slotEndTime, requestId } = params;
  const start = formatSlotTime(slotStartTime);
  const end = formatSlotTime(slotEndTime);

  return send({
    to: params.to,
    subject: "We received your booking request — MissMay Tattoos",
    html: `
      <p>Hi ${clientName},</p>
      <p>Thanks for reaching out! We've received your booking request for:</p>
      <p><strong>${start}</strong> – ${end}</p>
      <p>We'll review your request and get back to you soon.</p>
      <p style="color:#888;font-size:12px;">Reference ID: ${requestId}</p>
      <p>— MissMay Tattoos</p>
    `,
    text: [
      `Hi ${clientName},`,
      ``,
      `Thanks for reaching out! We've received your booking request for:`,
      `${start} – ${end}`,
      ``,
      `We'll review your request and get back to you soon.`,
      ``,
      `Reference ID: ${requestId}`,
      `— MissMay Tattoos`,
    ].join("\n"),
  });
}

/**
 * Sent to the client when the admin approves their booking request.
 */
export async function sendBookingApproval(params: {
  to: string;
  clientName: string;
  slotStartTime: string;
  slotEndTime: string;
}): Promise<EmailResult> {
  const { clientName, slotStartTime, slotEndTime } = params;
  const start = formatSlotTime(slotStartTime);
  const end = formatSlotTime(slotEndTime);

  return send({
    to: params.to,
    subject: "Your tattoo appointment is confirmed! — MissMay Tattoos",
    html: `
      <p>Hi ${clientName},</p>
      <p>Great news — your booking has been <strong>approved</strong>!</p>
      <p>Your appointment is scheduled for:</p>
      <p><strong>${start}</strong> – ${end}</p>
      <p>Please arrive a few minutes early. If you need to reschedule, contact us as soon as possible.</p>
      <p>— MissMay Tattoos</p>
    `,
    text: [
      `Hi ${clientName},`,
      ``,
      `Great news — your booking has been approved!`,
      ``,
      `Your appointment is scheduled for:`,
      `${start} – ${end}`,
      ``,
      `Please arrive a few minutes early. If you need to reschedule, contact us as soon as possible.`,
      ``,
      `— MissMay Tattoos`,
    ].join("\n"),
  });
}

/**
 * Sent to the client when the admin rejects their booking request.
 */
export async function sendBookingRejection(params: {
  to: string;
  clientName: string;
}): Promise<EmailResult> {
  const { clientName } = params;

  return send({
    to: params.to,
    subject: "Update on your booking request — MissMay Tattoos",
    html: `
      <p>Hi ${clientName},</p>
      <p>Thank you for your interest. Unfortunately, we're unable to accommodate your booking request at this time.</p>
      <p>Feel free to check back for other available slots — we'd love to work with you in the future.</p>
      <p>— MissMay Tattoos</p>
    `,
    text: [
      `Hi ${clientName},`,
      ``,
      `Thank you for your interest. Unfortunately, we're unable to accommodate your booking request at this time.`,
      ``,
      `Feel free to check back for other available slots — we'd love to work with you in the future.`,
      ``,
      `— MissMay Tattoos`,
    ].join("\n"),
  });
}
