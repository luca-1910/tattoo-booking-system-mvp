import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdmin } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServerClient";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const supabase = await supabaseServer();
  const { requestId } = await ctx.params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !isConfiguredAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Delete the booking and capture the row in one round-trip so we know which slot to release.
  const { data: deletedRows, error: deleteError } = await supabase
    .from("booking_request")
    .delete()
    .eq("request_id", requestId)
    .select("requested_slot_id,status");

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  const deleted = (deletedRows?.[0] ?? null) as { requested_slot_id: string | null; status: string | null } | null;

  // Release the linked slot back to "available" unless the booking was already terminal.
  let slotReleaseError: string | null = null;
  if (deleted?.requested_slot_id && !["completed", "cancelled", "rejected", "expired"].includes(deleted.status ?? "")) {
    const { error: updateError } = await supabase
      .from("slot")
      .update({ status: "available" })
      .eq("slot_id", deleted.requested_slot_id);
    if (updateError) {
      slotReleaseError = updateError.message;
      console.error("[delete-booking] Failed to release slot:", updateError);
    }
  }

  return NextResponse.json({ ok: true, slotReleased: !slotReleaseError, slotReleaseError });
}
