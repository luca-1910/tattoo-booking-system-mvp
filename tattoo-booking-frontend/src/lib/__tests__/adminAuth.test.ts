import { describe, it, expect, beforeEach, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { isConfiguredAdmin } from "../adminAuth";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    email: "admin@example.com",
    app_metadata: { provider: "email" },
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("isConfiguredAdmin — no env restrictions", () => {
  it("returns false for null user", () => {
    expect(isConfiguredAdmin(null)).toBe(false);
  });

  it("returns true for any authenticated user when no env vars are set", () => {
    expect(isConfiguredAdmin(makeUser())).toBe(true);
  });
});

describe("isConfiguredAdmin — ADMIN_EMAIL restriction (server-only var)", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
  });

  it("returns true when user email matches ADMIN_EMAIL", () => {
    expect(isConfiguredAdmin(makeUser({ email: "admin@example.com" }))).toBe(true);
  });

  it("returns false when user email does not match ADMIN_EMAIL", () => {
    expect(isConfiguredAdmin(makeUser({ email: "other@example.com" }))).toBe(false);
  });

  it("returns false when user has no email", () => {
    expect(isConfiguredAdmin(makeUser({ email: undefined }))).toBe(false);
  });
});

describe("isConfiguredAdmin — ADMIN_UID restriction (email/password user)", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_UID", "correct-uid-456");
  });

  it("returns true when uid matches", () => {
    expect(isConfiguredAdmin(makeUser({ id: "correct-uid-456" }))).toBe(true);
  });

  it("returns false when uid does not match", () => {
    expect(isConfiguredAdmin(makeUser({ id: "wrong-uid" }))).toBe(false);
  });
});

describe("isConfiguredAdmin — NEXT_PUBLIC_ vars are NOT used as fallback", () => {
  it("ignores NEXT_PUBLIC_ADMIN_EMAIL when ADMIN_EMAIL is not set", () => {
    // NEXT_PUBLIC_ADMIN_EMAIL alone must not restrict access — those vars are
    // no longer read by the server guard to prevent them leaking into the bundle.
    vi.stubEnv("NEXT_PUBLIC_ADMIN_EMAIL", "admin@example.com");
    // Any user should pass because ADMIN_EMAIL (server var) is not set
    expect(isConfiguredAdmin(makeUser({ email: "anyone@example.com" }))).toBe(true);
  });

  it("ignores NEXT_PUBLIC_ADMIN_UID when ADMIN_UID is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "some-uid");
    expect(isConfiguredAdmin(makeUser({ id: "different-uid" }))).toBe(true);
  });
});

describe("isConfiguredAdmin — Google OAuth users skip UID check", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.stubEnv("ADMIN_UID", "some-other-uid");
  });

  it("returns true for Google user with correct email regardless of UID", () => {
    const googleUser = makeUser({
      email: "admin@example.com",
      id: "google-uid-does-not-match",
      app_metadata: { provider: "google" },
    });
    expect(isConfiguredAdmin(googleUser)).toBe(true);
  });

  it("returns false for Google user with wrong email", () => {
    const googleUser = makeUser({
      email: "wrong@example.com",
      app_metadata: { provider: "google" },
    });
    expect(isConfiguredAdmin(googleUser)).toBe(false);
  });
});
