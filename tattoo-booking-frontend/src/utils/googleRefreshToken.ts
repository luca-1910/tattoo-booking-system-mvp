/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Returns a valid Google access token, refreshing it if expired.
 *
 * Two modes:
 *   1. DB mode  — pass `artistId` + `supabase` client. Reads tokens from
 *                 `tattoo_artist`, writes back after a refresh.
 *   2. Env mode — fallback to GOOGLE_* env vars (dev / backwards-compat).
 *
 * Throws if no refresh token is available or if the refresh API call fails.
 */
export async function getValidAccessToken(
  artistId?: string,
  supabase?: any,
): Promise<string> {
  // ── DB mode ──────────────────────────────────────────────────────────────
  if (artistId && supabase) {
    const { data: artist, error } = await supabase
      .from("tattoo_artist")
      .select("google_access_token,google_refresh_token,google_token_expiry")
      .eq("id", artistId)
      .maybeSingle();

    if (error) throw new Error(`Failed to read artist tokens: ${error.message}`);

    const dbRefreshToken: string | null = artist?.google_refresh_token ?? null;
    const dbAccessToken: string | null = artist?.google_access_token ?? null;
    const dbExpiry: number = Number(artist?.google_token_expiry ?? 0);

    if (!dbRefreshToken) {
      throw new Error("Google Calendar is not connected. No refresh token found.");
    }

    if (dbAccessToken && Date.now() < dbExpiry) {
      return dbAccessToken;
    }

    const refreshed = await refreshAccessToken(dbRefreshToken);

    // Write new token back to DB
    await supabase
      .from("tattoo_artist")
      .update({
        google_access_token: refreshed.access_token,
        google_token_expiry: refreshed.expiry,
      })
      .eq("id", artistId);

    return refreshed.access_token;
  }

  // ── Env fallback (backwards-compat) ──────────────────────────────────────
  const envRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const envAccessToken = process.env.GOOGLE_ACCESS_TOKEN;
  const envExpiry = Number(process.env.GOOGLE_TOKEN_EXPIRY ?? 0);

  if (!envRefreshToken) {
    throw new Error("Google Calendar is not connected. No refresh token configured.");
  }

  if (envAccessToken && Date.now() < envExpiry) {
    return envAccessToken;
  }

  const refreshed = await refreshAccessToken(envRefreshToken);
  // Note: in env-fallback mode we can't persist — caller gets a fresh token
  // but it won't be saved. This is the legacy behaviour.
  console.warn("⚠️  Refreshed Google access token but cannot persist it (env mode). Update GOOGLE_ACCESS_TOKEN manually or switch to DB mode.");
  return refreshed.access_token;
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expiry: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Google token refresh failed: ${data.error_description ?? data.error ?? "unknown error"}`,
    );
  }

  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  return {
    access_token: data.access_token as string,
    expiry: Date.now() + expiresInMs,
  };
}
