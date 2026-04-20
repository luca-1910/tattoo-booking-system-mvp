import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Module mocks ────────────────────────────────────────────────────────────

const mockInsert = vi.fn();
const mockStorageUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("@/lib/supabaseBrowserClient", () => ({
  supabaseBrowser: vi.fn(() => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "slot") {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        slot_id: "slot-1",
                        start_time: new Date(Date.now() + 86400000)
                          .toISOString()
                          .replace("Z", "+00:00"),
                        end_time: new Date(Date.now() + 90000000)
                          .toISOString()
                          .replace("Z", "+00:00"),
                        status: "available",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        insert: mockInsert,
      };
    }),
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  })),
}));

// Sonner toast — prevent real DOM side-effects
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { BookingPage } from "../BookingPage";
import { toast } from "sonner";

// ── Helpers ─────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

function renderBookingPage() {
  return render(<BookingPage onNavigate={mockNavigate} />);
}

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/proof.jpg" } });
  mockInsert.mockResolvedValue({ error: null });
});

describe("BookingPage — Step 1 (Personal Details)", () => {
  it("renders the personal details form on mount", () => {
    renderBookingPage();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
  });

  it("Continue button is disabled when required fields are empty", () => {
    renderBookingPage();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("Continue button is enabled when all required fields are filled", async () => {
    renderBookingPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");

    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("advances to Step 2 after filling step 1 and clicking Continue", async () => {
    renderBookingPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/tattoo details/i)).toBeInTheDocument();
  });
});

describe("BookingPage — Step 2 (Tattoo Details)", () => {
  async function advanceToStep2() {
    renderBookingPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    return user;
  }

  it("Continue is disabled without a tattoo idea", async () => {
    await advanceToStep2();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("Continue is enabled once a tattoo idea is entered", async () => {
    const user = await advanceToStep2();
    await user.type(screen.getByLabelText(/tattoo idea/i), "A rose on my wrist");
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("Back button returns to Step 1", async () => {
    const user = await advanceToStep2();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });
});

describe("BookingPage — Step 4 Submit validation", () => {
  it("shows error toast when submitting without a time slot selected", async () => {
    renderBookingPage();
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
  });
});

describe("BookingPage — Step 1 email validation", () => {
  it("shows an inline email error when Continue is clicked with an invalid email", async () => {
    renderBookingPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");

    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Should stay on step 1 and show an error
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it("does not advance to step 2 when email is invalid", async () => {
    renderBookingPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "bad@@email");
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.queryByText(/tattoo details/i)).not.toBeInTheDocument();
  });

  it("clears the email error when the user corrects the email and advances", async () => {
    renderBookingPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "bad-email");
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Error shown
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();

    // Fix the email
    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Should advance — tattoo details visible
    expect(screen.getByText(/tattoo details/i)).toBeInTheDocument();
  });

  it("shows an error when name exceeds 200 characters", async () => {
    renderBookingPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), "A".repeat(201));
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/200 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/tattoo details/i)).not.toBeInTheDocument();
  });
});
