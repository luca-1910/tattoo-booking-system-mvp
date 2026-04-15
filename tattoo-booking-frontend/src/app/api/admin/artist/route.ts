import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";

/**
 * POST /api/admin/artist
 *
 * Creates (or no-ops if already exists) the tattoo_artist row for the
 * authenticated admin. Uses the service role key so it bypasses any
 * table-level privilege restrictions on the anon/authenticated role.
 *
 * Body: { name?: string; contactEmail?: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !isConfiguredAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { name?: string; contactEmail?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — we fall back to session values
  }

  const displayName =
    body.name?.trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    "Artist";

  const contactEmail = body.contactEmail?.trim() || user.email || null;

  // Use service role key to guarantee the insert succeeds regardless of
  // table-level grants. Falls back to the session client if key is absent.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
  const dbClient = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
        auth: { persistSession: false },
      })
    : supabase;

  const { error } = await dbClient
    .from("tattoo_artist")
    .upsert(
      { auth_user_id: user.id, name: displayName, contact_email: contactEmail },
      { onConflict: "auth_user_id", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
