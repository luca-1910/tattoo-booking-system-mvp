export async function getValidAccessToken() {
  const expiry = Number(process.env.GOOGLE_TOKEN_EXPIRY || 0);

  // If token not expired, reuse
  if (Date.now() < expiry) {
    return process.env.GOOGLE_ACCESS_TOKEN!;
  }

  // Otherwise, refresh
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  const newTokens = await res.json();

  console.log("🔁 Refreshed Access Token:", newTokens);

  // ⚠️ IMPORTANT: In production, persist this new token somewhere safe
  // (update Supabase, a secure KV store, or local .env in dev)
  return newTokens.access_token;
}
