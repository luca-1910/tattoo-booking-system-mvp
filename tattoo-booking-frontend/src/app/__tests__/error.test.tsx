import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GlobalError from "../error";

describe("GlobalError boundary", () => {
  it("renders a user-facing heading instead of a blank screen", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("Boom")} reset={reset} />);
    expect(screen.getByRole("heading")).toBeTruthy();
  });

  it("does not expose the raw error message to the user", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("Secret internal detail")} reset={reset} />);
    expect(screen.queryByText("Secret internal detail")).toBeNull();
  });

  it("renders a retry button", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("Boom")} reset={reset} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("calls reset() when the retry button is clicked", async () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("Boom")} reset={reset} />);
    await userEvent.click(screen.getByRole("button"));
    expect(reset).toHaveBeenCalledOnce();
  });
});
