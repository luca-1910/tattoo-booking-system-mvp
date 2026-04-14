import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServerClient";

/**
 * Supabase OAuth callback for Google Sign-In.
 *
 * After the admin signs in with Google (via supabase.auth.signInWithOAuth),
 * Supabase redirects here with a `code` query param. We exchange it for a
 * session, capture the Google provider tokens (which include calendar scopes),
 * and persist them to the tattoo_artist row so calendar sync works immediately.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login?error=missing_code", req.url));
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("Supabase OAuth code exchange failed:", error);
    return NextResponse.redirect(new URL("/admin/login?error=auth_failed", req.url));
  }

  const { session } = data;
  const providerToken: string | null = session.provider_token ?? null;
  const providerRefreshToken: string | null = session.provider_refresh_token ?? null;

  // Save Google Calendar tokens to DB if they came back with the OAuth session.
  // This happens when the admin signed in with Google and calendar scopes were requested.
  if (providerToken || providerRefreshToken) {
    try {
      const expiresAt = session.expires_at
        ? session.expires_at * 1000
        : Date.now() + 3600 * 1000;

      await supabase
        .from("tattoo_artist")
        .update({
          ...(providerToken ? { google_access_token: providerToken } : {}),
          ...(providerRefreshToken ? { google_refresh_token: providerRefreshToken } : {}),
          google_token_expiry: expiresAt,
        })
        .eq("auth_user_id", session.user.id);
    } catch (err) {
      // Non-fatal: user is still logged in; calendar sync can be connected later via Settings
      console.error("Failed to persist Google provider tokens:", err);
    }
  }

  return NextResponse.redirect(new URL(next, req.url));
}
