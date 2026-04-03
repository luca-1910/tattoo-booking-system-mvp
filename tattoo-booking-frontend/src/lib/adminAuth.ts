import type { User } from "@supabase/supabase-js";

export function isConfiguredAdmin(user: User | null): boolean {
  if (!user) return false;

  const allowedEmail = process.env.ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const allowedUid = process.env.ADMIN_UID ?? process.env.NEXT_PUBLIC_ADMIN_UID;

  const emailOk = allowedEmail ? user.email === allowedEmail : true;
  const uidOk = allowedUid ? user.id === allowedUid : true;

  return emailOk && uidOk;
}
