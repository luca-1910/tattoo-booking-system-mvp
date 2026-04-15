// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/supabaseServerClient", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}));

import { GET } from "../route";
import { supabaseServer } from "@/lib/supabaseServerClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockUpsert = vi.fn().mockResolvedValue({ error: null });

function buildSupabaseMock(user: object | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
}

function buildSupabaseMockWithUpsertSpy(user: object | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      upsert: mockUpsert,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockUpsert.mockResolvedValue({ error: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns isAdmin=false when no user is authenticated", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(buildSupabaseMock(null) as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(false);
  });

  it("returns isAdmin=true for an authenticated user with no env restrictions", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ id: "u1", email: "admin@example.com", app_metadata: { provider: "email" } }) as never,
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
  });

  it("returns isAdmin=false when user email does not match ADMIN_EMAIL", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ id: "u1", email: "other@example.com", app_metadata: { provider: "email" } }) as never,
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(false);
  });

  it("returns isAdmin=true for a Google user with the correct email", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ id: "google-uid", email: "admin@example.com", app_metadata: { provider: "google" } }) as never,
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
  });

  it("does not expose ADMIN_EMAIL or ADMIN_UID values in the response body", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.stubEnv("ADMIN_UID", "secret-uid");
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMock({ id: "u1", email: "admin@example.com", app_metadata: { provider: "email" } }) as never,
    );

    const res = await GET();
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("admin@example.com");
    expect(JSON.stringify(body)).not.toContain("secret-uid");
  });
});

describe("GET /api/auth/me — artist lazy init", () => {
  it("upserts the artist row when the user is an admin", async () => {
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMockWithUpsertSpy({
        id: "u1",
        email: "admin@example.com",
        user_metadata: { full_name: "Admin User" },
        app_metadata: { provider: "google" },
      }) as never,
    );

    await GET();

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ auth_user_id: "u1", name: "Admin User" }),
      expect.objectContaining({ onConflict: "auth_user_id", ignoreDuplicates: true }),
    );
  });

  it("does NOT upsert the artist row when the user is not an admin", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMockWithUpsertSpy({
        id: "u2",
        email: "stranger@example.com",
        user_metadata: {},
        app_metadata: { provider: "google" },
      }) as never,
    );

    await GET();

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("still returns isAdmin=true even when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "DB error" } });
    vi.mocked(supabaseServer).mockResolvedValue(
      buildSupabaseMockWithUpsertSpy({
        id: "u1",
        email: "admin@example.com",
        user_metadata: {},
        app_metadata: { provider: "email" },
      }) as never,
    );

    const res = await GET();
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
  });
});
