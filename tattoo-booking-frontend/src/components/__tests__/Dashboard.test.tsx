import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Module mocks ─────────────────────────────────────────────────────────────

// Admin guard — always passes so tests focus on dashboard behaviour
vi.mock("@/hooks/useRequireAdmin", () => ({
  useRequireAdmin: vi.fn().mockReturnValue(false), // false = not checking, user is admin
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/supabaseBrowserClient", () => ({
  supabaseBrowser: vi.fn(),
}));

import Dashboard from "../Dashboard";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_BOOKING = {
  request_id: "req-1",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "555",
  tattoo_idea: "rose",
  status: "pending",
  requested_slot_id: "slot-1",
  payment_proof_url: null,
  reference_image_url: null,
  created_at: new Date().toISOString(),
};

const MOCK_SLOT = {
  slot_id: "slot-1",
  status: "available",
  start_time: new Date(Date.now() + 86400000).toISOString(),
  end_time: new Date(Date.now() + 90000000).toISOString(),
};

function buildSupabaseMock({
  bookings = [MOCK_BOOKING] as object[],
  fetchError = null as { message: string } | null,
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "booking_request") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: fetchError ? null : bookings,
                error: fetchError,
              }),
            }),
          }),
        };
      }
      if (table === "slot") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [MOCK_SLOT], error: null }),
          }),
        };
      }
      return {};
    }),
  };
}

function renderDashboard() {
  return render(
    <Dashboard onNavigate={vi.fn()} onLogout={vi.fn()} />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Dashboard — console hygiene", () => {
  it("does NOT call console.error when fetchBookings fails", async () => {
    vi.mocked(supabaseBrowser).mockReturnValue(
      buildSupabaseMock({ fetchError: { message: "Network error" } }) as never,
    );

    renderDashboard();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    // Error surfaced via toast only — never leaks to browser console
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does NOT call console.error when approve API call fails", async () => {
    vi.mocked(supabaseBrowser).mockReturnValue(buildSupabaseMock() as never);

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByText(/Jane Doe/i)).toBeInTheDocument();
    });

    // Stub fetch AFTER bookings have loaded — avoids interfering with supabase init
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: "Slot unavailable" }),
      }),
    );

    const approveButtons = screen.getAllByRole("button", { name: /approve/i });
    await userEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(console.error).not.toHaveBeenCalled();
  });

  it("does NOT call console.error when reject API call fails", async () => {
    vi.mocked(supabaseBrowser).mockReturnValue(buildSupabaseMock() as never);

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByText(/Jane Doe/i)).toBeInTheDocument();
    });

    // Stub fetch AFTER bookings have loaded — avoids interfering with supabase init
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: "Conflict" }),
      }),
    );

    const rejectButtons = screen.getAllByRole("button", { name: /^Reject$/i });
    await userEvent.click(rejectButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(console.error).not.toHaveBeenCalled();
  });
});
