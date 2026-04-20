import type { User } from "@supabase/supabase-js";

export function isConfiguredAdmin(user: User | null): boolean {
  if (!user) return false;

  // Read server-only vars. The NEXT_PUBLIC_ variants are intentionally NOT
  // used as a fallback here — we do not want admin credentials bundled into
  // the client-side JavaScript bundle.
  const allowedEmail = process.env.ADMIN_EMAIL;
  const allowedUid = process.env.ADMIN_UID;

  const emailOk = allowedEmail ? user.email === allowedEmail : true;

  // Google OAuth users are verified by Google — skip the UID check for them.
  // A Google user's Supabase UID will differ from the one stored in ADMIN_UID
  // (which was set for the email/password account), so enforcing it would block them.
  const isGoogleUser = user.app_metadata?.provider === "google";
  const uidOk = isGoogleUser ? true : (allowedUid ? user.id === allowedUid : true);

  return emailOk && uidOk;
}
