import { NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";

/**
 * GET /api/auth/me
 *
 * Returns { isAdmin: boolean } based on the current session cookie.
 * Used by client components to verify admin status without exposing
 * ADMIN_EMAIL / ADMIN_UID in the browser bundle.
 *
 * Also lazily ensures the tattoo_artist row exists for the admin user.
 * This is a safety net: the OAuth callback creates the row on first sign-in,
 * but this guarantees creation even if the admin reaches the app via an
 * existing session without going through the callback again.
 *
 * Always responds 200 — callers check `isAdmin`, not the HTTP status.
 */
export async function GET() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = isConfiguredAdmin(user);

    if (admin && user) {
      // Non-blocking: ensure the artist row exists without failing the auth check.
      const displayName: string =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        "Artist";

      supabase
        .from("tattoo_artist")
        .upsert(
          { auth_user_id: user.id, name: displayName, contact_email: user.email ?? null },
          { onConflict: "auth_user_id", ignoreDuplicates: true },
        )
        .then(({ error }) => {
          if (error) console.error("[me] artist upsert failed:", error.message);
        });
    }

    return NextResponse.json({ isAdmin: admin });
  } catch {
    // Treat any unexpected error as "not admin" — never expose internals.
    return NextResponse.json({ isAdmin: false });
  }
}
