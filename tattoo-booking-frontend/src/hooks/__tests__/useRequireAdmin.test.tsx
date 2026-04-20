import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import { useRequireAdmin, useRequireArtistProfile } from "../useRequireAdmin";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stub the global fetch used by the hook to call /api/auth/me */
function mockMeEndpoint(
  isAdmin: boolean,
  ok = true,
  hasArtistProfile = true,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: vi.fn().mockResolvedValue({ isAdmin, hasArtistProfile }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ── useRequireAdmin ───────────────────────────────────────────────────────────

describe("useRequireAdmin", () => {
  it("starts with checking=true before the fetch resolves", () => {
    // fetch never resolves — hook should remain in loading state
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    const { result } = renderHook(() => useRequireAdmin());
    expect(result.current).toBe(true);
  });

  it("redirects to /admin/login when isAdmin=false", async () => {
    mockMeEndpoint(false);

    renderHook(() => useRequireAdmin());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("returns checking=false when isAdmin=true", async () => {
    mockMeEndpoint(true);

    const { result } = renderHook(() => useRequireAdmin());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to /admin/login when the /api/auth/me fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    renderHook(() => useRequireAdmin());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("redirects when /api/auth/me returns a non-ok HTTP status", async () => {
    mockMeEndpoint(false, false /* ok=false */);

    renderHook(() => useRequireAdmin());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("calls /api/auth/me — does not read any NEXT_PUBLIC_ env vars", async () => {
    mockMeEndpoint(true);

    renderHook(() => useRequireAdmin());

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/auth/me");
    });
    // Confirm no NEXT_PUBLIC_ env reads are triggering (they simply aren't referenced)
    expect(process.env.NEXT_PUBLIC_ADMIN_EMAIL).toBeUndefined();
    expect(process.env.NEXT_PUBLIC_ADMIN_UID).toBeUndefined();
  });
});

// ── useRequireArtistProfile ───────────────────────────────────────────────────

describe("useRequireArtistProfile", () => {
  it("starts with checking=true before the fetch resolves", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    const { result } = renderHook(() => useRequireArtistProfile());
    expect(result.current).toBe(true);
  });

  it("returns checking=false when admin and artist profile exist", async () => {
    mockMeEndpoint(true, true, true);

    const { result } = renderHook(() => useRequireArtistProfile());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to /settings when admin but no artist profile", async () => {
    mockMeEndpoint(true, true, false /* hasArtistProfile=false */);

    renderHook(() => useRequireArtistProfile());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/settings");
    });
  });

  it("redirects to /admin/login when not admin", async () => {
    mockMeEndpoint(false);

    renderHook(() => useRequireArtistProfile());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("redirects to /admin/login on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    renderHook(() => useRequireArtistProfile());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("redirects when /api/auth/me returns a non-ok HTTP status", async () => {
    mockMeEndpoint(false, false);

    renderHook(() => useRequireArtistProfile());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/login");
    });
  });
});
