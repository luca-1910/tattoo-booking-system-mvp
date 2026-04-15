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
      // Ensure the artist row exists. Awaited so it completes before the
      // response is sent — fire-and-forget can be cut short in serverless.
      try {
        const displayName: string =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          user.email ??
          "Artist";

        const { error } = await supabase
          .from("tattoo_artist")
          .upsert(
            {
              auth_user_id: user.id,
              name: displayName,
              email: user.email ?? "",
              contact_email: user.email ?? null,
            },
            { onConflict: "auth_user_id", ignoreDuplicates: true },
          );

        if (error) console.error("[me] artist upsert failed:", error.message);
      } catch (err) {
        console.error("[me] artist upsert threw:", err);
      }
    }

    // Check whether the artist profile row exists so the client can gate
    // onboarding before the user reaches the dashboard.
    let hasArtistProfile = false;
    if (admin && user) {
      const { data } = await supabase
        .from("tattoo_artist")
        .select("artist_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      hasArtistProfile = Boolean(data?.artist_id);
    }

    return NextResponse.json({ isAdmin: admin, hasArtistProfile });
  } catch {
    // Treat any unexpected error as "not admin" — never expose internals.
    return NextResponse.json({ isAdmin: false });
  }
}
