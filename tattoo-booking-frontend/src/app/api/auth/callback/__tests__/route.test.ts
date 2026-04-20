// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/supabaseServerClient", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}));

// Mock @supabase/supabase-js so we can spy on createClient (used for service role upsert)
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { GET } from "../route";
import { supabaseServer } from "@/lib/supabaseServerClient";
import { createClient } from "@supabase/supabase-js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

function buildSupabaseMock({
  session = {
    provider_token: "goog-access",
    provider_refresh_token: "goog-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "user-1", email: "admin@example.com", user_metadata: { full_name: "Admin User" } },
  } as object | null,
  exchangeError = null as { message: string } | null,
} = {}) {
  mockUpsert.mockResolvedValue({ error: null });
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });

  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { session },
        error: exchangeError,
      }),
    },
    from: vi.fn().mockReturnValue({
      upsert: mockUpsert,
      update: mockUpdate,
    }),
  };
}

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/auth/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function buildAdminClientMock() {
  return {
    from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default implementations cleared by clearAllMocks
  mockUpsert.mockResolvedValue({ error: null });
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  // Default: no service role key set
  vi.unstubAllEnvs();
  vi.mocked(createClient).mockReturnValue(buildAdminClientMock() as never);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/callback — open redirect protection", () => {
  it("redirects to /dashboard when `next` is omitted", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await GET(makeRequest({ code: "valid-code" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("redirects to a safe relative path when `next` is /calendar", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await GET(makeRequest({ code: "valid-code", next: "/calendar" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/calendar");
  });

  it("redirects to a safe relative path when `next` is /settings", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await GET(makeRequest({ code: "valid-code", next: "/settings" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/settings");
  });

  it("falls back to /dashboard when `next` is an absolute external URL", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await GET(makeRequest({ code: "valid-code", next: "https://evil.com/phish" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("falls back to /dashboard when `next` is a protocol-relative URL", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await GET(makeRequest({ code: "valid-code", next: "//evil.com" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("falls back to /dashboard when `next` is an unknown path", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await GET(makeRequest({ code: "valid-code", next: "/not-a-real-page" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("redirects to /admin/login when code is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("redirects to /admin/login when Supabase code exchange fails", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ session: null, exchangeError: { message: "bad code" } }) as never,
    );
    const res = await GET(makeRequest({ code: "bad-code" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/login");
  });
});

describe("GET /api/auth/callback — artist row upsert", () => {
  it("upserts the artist row on every successful sign-in", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    await GET(makeRequest({ code: "valid-code" }));
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ auth_user_id: "user-1" }),
      expect.objectContaining({ onConflict: "auth_user_id", ignoreDuplicates: true }),
    );
  });

  it("seeds name from Google user_metadata on first sign-in", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    await GET(makeRequest({ code: "valid-code" }));
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Admin User", contact_email: "admin@example.com" }),
      expect.anything(),
    );
  });

  it("also updates Google tokens when they are present", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    await GET(makeRequest({ code: "valid-code" }));
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ google_access_token: "goog-access", google_refresh_token: "goog-refresh" }),
    );
  });

  it("skips the token update when no provider tokens are returned", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({
        session: {
          provider_token: null,
          provider_refresh_token: null,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: "user-1", email: "admin@example.com", user_metadata: {} },
        },
      }) as never,
    );
    await GET(makeRequest({ code: "valid-code" }));
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("still redirects to /dashboard even when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "DB error" } });
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);
    const res = await GET(makeRequest({ code: "valid-code" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("uses createClient (service role) for the upsert when SUPABASE_SERVICE_ROLE_KEY is set", async () => {
    vi.stubEnv("SUPABASE_SERVICE_KEY", "service-role-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);

    await GET(makeRequest({ code: "valid-code" }));

    expect(createClient).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "service-role-secret",
      expect.objectContaining({ auth: { persistSession: false } }),
    );
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("falls back to the session client when SUPABASE_SERVICE_ROLE_KEY is absent", async () => {
    // SUPABASE_SERVICE_ROLE_KEY is not set (unstubAllEnvs in beforeEach)
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock() as never);

    await GET(makeRequest({ code: "valid-code" }));

    expect(createClient).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalled();
  });
});
