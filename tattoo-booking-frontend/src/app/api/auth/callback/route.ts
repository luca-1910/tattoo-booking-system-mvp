import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServerClient";

/**
 * Supabase OAuth callback for Google Sign-In.
 *
 * After the admin signs in with Google (via supabase.auth.signInWithOAuth),
 * Supabase redirects here with a `code` query param. We exchange it for a
 * session, capture the Google provider tokens (which include calendar scopes),
 * and persist them to the tattoo_artist row so calendar sync works immediately.
 */

/**
 * Allowlist of internal paths that `next` may redirect to after login.
 * Any value outside this set falls back to /dashboard, preventing open-redirect
 * attacks where an attacker crafts ?next=https://evil.com.
 */
const ALLOWED_NEXT_PATHS = new Set([
  "/dashboard",
  "/calendar",
  "/settings",
  "/admin/login",
]);

/**
 * Returns `path` if it is in the allowlist, otherwise returns "/dashboard".
 * Also rejects anything that looks like an absolute URL (starts with http,
 * https, //, or contains a colon before the first slash).
 */
function sanitizeNext(path: string | null): string {
  const fallback = "/dashboard";
  if (!path) return fallback;

  // Reject absolute URLs and protocol-relative URLs
  if (/^(https?:)?\/\//i.test(path)) return fallback;

  return ALLOWED_NEXT_PATHS.has(path) ? path : fallback;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

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

  try {
    // Ensure the artist row exists. On first sign-in this inserts a minimal row;
    // on subsequent sign-ins ignoreDuplicates:true means existing data is left untouched.
    const displayName: string =
      (session.user.user_metadata?.full_name as string | undefined) ??
      (session.user.user_metadata?.name as string | undefined) ??
      session.user.email ??
      "Artist";

    // Use the service role key for the upsert so it bypasses any table-level
    // privilege gaps. Falls back to the session client if the key is absent.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
    const dbClient =
      serviceRoleKey
        ? createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { persistSession: false } },
          )
        : supabase;

    await dbClient
      .from("tattoo_artist")
      .upsert(
        { auth_user_id: session.user.id, name: displayName, email: session.user.email ?? "", contact_email: session.user.email ?? null },
        { onConflict: "auth_user_id", ignoreDuplicates: true },
      );

    // Save Google Calendar tokens to DB if they came back with the OAuth session.
    if (providerToken || providerRefreshToken) {
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
    }
  } catch (err) {
    // Non-fatal: user is still logged in; artist profile and calendar sync can be set up via Settings
    console.error("Failed to upsert artist row or persist Google tokens:", err);
  }

  return NextResponse.redirect(new URL(next, req.url));
}
