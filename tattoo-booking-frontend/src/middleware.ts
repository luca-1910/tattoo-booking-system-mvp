import { type NextRequest, NextResponse } from "next/server";

// No route-level auth guards needed here.
// - /booking is public (clients book without an account)
// - /dashboard, /calendar, /settings are protected by useRequireAdmin (client-side)
// - /admin/login is public by definition
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
