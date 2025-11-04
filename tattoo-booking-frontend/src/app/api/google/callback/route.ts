import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: code!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  console.log("🔐 GOOGLE TOKENS:", tokens);

  // Copy these tokens into your .env.local file once after you authenticate
  // GOOGLE_ACCESS_TOKEN="..."
  // GOOGLE_REFRESH_TOKEN="..."
  // GOOGLE_TOKEN_EXPIRY="..."

  return NextResponse.redirect(new URL("/settings?google=connected", req.url));
}
