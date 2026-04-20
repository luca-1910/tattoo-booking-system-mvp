import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Module mocks ────────────────────────────────────────────────────────────

const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock("@/lib/supabaseBrowserClient", () => ({
  supabaseBrowser: vi.fn(() => ({
    from: mockSupabaseFrom,
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

// useRequireAdmin — skip auth check in component tests
vi.mock("@/hooks/useRequireAdmin", () => ({
  useRequireAdmin: vi.fn(() => false),        // not checking
  useRequireArtistProfile: vi.fn(() => false), // not checking, profile exists
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import CalendarPage from "../CalendarPage";
import { toast } from "sonner";

// ── Helpers ─────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockLogout = vi.fn();

function setupFromMock(slots: object[] = []) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "slot") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: slots, error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: mockInsert,
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: mockDelete,
        }),
      };
    }
    // booking_request queries: .select().eq().eq().not() or .select().eq().not()
    // All resolve with empty data so the slot list still loads correctly.
    const emptyChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          not: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };
    return emptyChain;
  });
}

function renderCalendarPage() {
  return render(
    <CalendarPage onNavigate={mockNavigate} onLogout={mockLogout} />,
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupFromMock();
  mockInsert.mockResolvedValue({ data: null, error: null });
  mockDelete.mockResolvedValue({ error: null });
});

describe("CalendarPage — renders", () => {
  it("shows the My Availability section", async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByText(/my availability/i)).toBeInTheDocument();
    });
  });

  it("shows 'No availability added yet.' when slots list is empty", async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByText(/no availability added yet/i)).toBeInTheDocument();
    });
  });
});

describe("CalendarPage — Add Availability validation", () => {
  // The CalendarPage labels aren't linked via htmlFor, so we query by input type/position.
  // The sidebar has: 1× type="date", then 2× type="time" (start, end).
  function getFormInputs(container: HTMLElement) {
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInputs = container.querySelectorAll('input[type="time"]');
    const startInput = timeInputs[0] as HTMLInputElement;
    const endInput = timeInputs[1] as HTMLInputElement;
    return { dateInput, startInput, endInput };
  }

  it("shows an error toast when end time is before start time", async () => {
    const { container } = renderCalendarPage();
    const user = userEvent.setup();
    const { dateInput, startInput, endInput } = getFormInputs(container);

    fireEvent.change(dateInput, { target: { value: "2025-09-01" } });
    fireEvent.change(startInput, { target: { value: "14:00" } });
    fireEvent.change(endInput, { target: { value: "13:00" } });

    await user.click(screen.getByRole("button", { name: /\+ add availability/i }));

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/end time must be after start time/i),
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("shows an error toast when end time equals start time", async () => {
    const { container } = renderCalendarPage();
    const user = userEvent.setup();
    const { dateInput, startInput, endInput } = getFormInputs(container);

    fireEvent.change(dateInput, { target: { value: "2025-09-01" } });
    fireEvent.change(startInput, { target: { value: "10:00" } });
    fireEvent.change(endInput, { target: { value: "10:00" } });

    await user.click(screen.getByRole("button", { name: /\+ add availability/i }));

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/end time must be after start time/i),
    );
  });

  it("does NOT call the DB when validation fails", async () => {
    const { container } = renderCalendarPage();
    const user = userEvent.setup();
    const { dateInput, startInput, endInput } = getFormInputs(container);

    fireEvent.change(dateInput, { target: { value: "2025-09-01" } });
    fireEvent.change(startInput, { target: { value: "10:00" } });
    fireEvent.change(endInput, { target: { value: "09:00" } });

    await user.click(screen.getByRole("button", { name: /\+ add availability/i }));

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("shows success toast and adds slot to list on valid submission", async () => {
    const newSlot = {
      slot_id: "new-slot-1",
      start_time: "2025-09-01T14:00:00.000Z",
      end_time: "2025-09-01T15:00:00.000Z",
      status: "available",
    };
    mockInsert.mockResolvedValue({ data: newSlot, error: null });

    const { container } = renderCalendarPage();
    const user = userEvent.setup();
    const { dateInput, startInput, endInput } = getFormInputs(container);

    fireEvent.change(dateInput, { target: { value: "2025-09-01" } });
    fireEvent.change(startInput, { target: { value: "14:00" } });
    fireEvent.change(endInput, { target: { value: "15:00" } });

    await user.click(screen.getByRole("button", { name: /\+ add availability/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Availability added.");
    });
  });
});

describe("CalendarPage — Delete slot", () => {
  it("removes slot from the list and shows success toast", async () => {
    const existingSlot = {
      slot_id: "slot-existing",
      start_time: "2025-10-01T10:00:00.000Z",
      end_time: "2025-10-01T11:00:00.000Z",
      status: "available",
    };
    setupFromMock([existingSlot]);

    // deleteSlot calls the API route via fetch
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }));

    renderCalendarPage();

    // Wait for slot to appear
    await waitFor(() => {
      expect(screen.queryByText(/no availability added yet/i)).not.toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle("Delete slot");
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Availability deleted.");
    });
  });
});

describe("CalendarPage — Month navigation", () => {
  it("renders the current month label", () => {
    renderCalendarPage();
    const now = new Date();
    const expected = now.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("advances to the next month on chevron-right click", async () => {
    const { container } = renderCalendarPage();
    const user = userEvent.setup();

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextLabel = nextMonth.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });

    // The month nav row contains exactly two icon-only buttons: prev and next.
    // We find them inside the month header div (first flex row in the calendar panel).
    const navButtons = container.querySelectorAll(
      ".flex.items-center.justify-between button",
    );
    // navButtons[0] = ChevronLeft (prev), navButtons[1] = ChevronRight (next)
    const nextBtn = navButtons[navButtons.length - 1] as HTMLElement;
    await user.click(nextBtn);

    expect(screen.getByText(nextLabel)).toBeInTheDocument();
  });
});
