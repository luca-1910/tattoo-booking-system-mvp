import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServerClient";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/settings?google=error&reason=missing_code", req.url));
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokenRes.ok || !tokens.access_token) {
    console.error("Google token exchange failed:", tokens);
    return NextResponse.redirect(new URL("/settings?google=error&reason=token_exchange", req.url));
  }

  const expiresInMs = (tokens.expires_in ?? 3600) * 1000;
  const tokenExpiry = Date.now() + expiresInMs;

  // Persist tokens to the tattoo_artist row for the current admin session
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("tattoo_artist")
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token ?? undefined,
          google_token_expiry: tokenExpiry,
          google_calendar_sync_enabled: true,
        })
        .eq("auth_user_id", user.id);

      // Default calendar_id to "primary" only when it has never been set.
      await supabase
        .from("tattoo_artist")
        .update({ calendar_id: "primary" })
        .eq("auth_user_id", user.id)
        .is("calendar_id", null);
    }
  } catch (err) {
    console.error("Failed to persist Google tokens to DB:", err);
    // Non-fatal: redirect to settings with a warning
    return NextResponse.redirect(new URL("/settings?google=error&reason=db_write", req.url));
  }

  return NextResponse.redirect(new URL("/settings?google=connected", req.url));
}
