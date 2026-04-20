import { describe, it, expect } from "vitest";
import { startOfDayLocal, getMonthMatrix, toIsoLocal } from "../calendarUtils";

// ─── startOfDayLocal ────────────────────────────────────────────────────────

describe("startOfDayLocal", () => {
  it("floors any time to 00:00:00.000 in local time", () => {
    const d = new Date(2025, 5, 15, 14, 30, 45, 500); // June 15, 2025 14:30:45.500
    const result = startOfDayLocal(d);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("preserves the date", () => {
    const d = new Date(2025, 11, 31, 23, 59, 59);
    const result = startOfDayLocal(d);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(31);
  });

  it("does not mutate the input date", () => {
    const d = new Date(2025, 0, 1, 12, 0, 0);
    const original = d.getTime();
    startOfDayLocal(d);
    expect(d.getTime()).toBe(original);
  });
});

// ─── getMonthMatrix ─────────────────────────────────────────────────────────

describe("getMonthMatrix", () => {
  it("always returns exactly 6 weeks", () => {
    // Test several months
    const cases = [
      [2025, 0],  // Jan 2025 — starts Wed
      [2025, 1],  // Feb 2025 — starts Sat
      [2025, 6],  // Jul 2025 — starts Tue
      [2024, 1],  // Feb 2024 — leap year
    ];
    for (const [year, month] of cases) {
      const matrix = getMonthMatrix(year, month);
      expect(matrix).toHaveLength(6);
      for (const week of matrix) {
        expect(week).toHaveLength(7);
      }
    }
  });

  it("first day of each week row is always Sunday", () => {
    const matrix = getMonthMatrix(2025, 0); // January 2025
    for (const week of matrix) {
      expect(week[0].getDay()).toBe(0); // 0 = Sunday
    }
  });

  it("last day of each week row is always Saturday", () => {
    const matrix = getMonthMatrix(2025, 0);
    for (const week of matrix) {
      expect(week[6].getDay()).toBe(6); // 6 = Saturday
    }
  });

  it("the first cell of the grid is the Sunday on or before the 1st of the month", () => {
    // January 2025: 1st is a Wednesday (dow=3), so first cell should be Dec 29 2024 (Sunday)
    const matrix = getMonthMatrix(2025, 0);
    const firstCell = matrix[0][0];
    expect(firstCell.getDay()).toBe(0);
    expect(firstCell <= new Date(2025, 0, 1)).toBe(true);
  });

  it("when the 1st falls on Sunday, the first cell is the 1st itself", () => {
    // June 2025: 1st is a Sunday
    const matrix = getMonthMatrix(2025, 5);
    const firstCell = matrix[0][0];
    expect(firstCell.getFullYear()).toBe(2025);
    expect(firstCell.getMonth()).toBe(5);
    expect(firstCell.getDate()).toBe(1);
  });

  it("handles February in a leap year (2024 — 29 days)", () => {
    const matrix = getMonthMatrix(2024, 1);
    const allDays = matrix.flat();
    const febDays = allDays.filter((d) => d.getMonth() === 1 && d.getFullYear() === 2024);
    expect(febDays).toHaveLength(29);
  });

  it("handles February in a non-leap year (2025 — 28 days)", () => {
    const matrix = getMonthMatrix(2025, 1);
    const allDays = matrix.flat();
    const febDays = allDays.filter((d) => d.getMonth() === 1 && d.getFullYear() === 2025);
    expect(febDays).toHaveLength(28);
  });

  it("matrix days are in ascending order", () => {
    const matrix = getMonthMatrix(2025, 3); // April 2025
    const flat = matrix.flat();
    for (let i = 1; i < flat.length; i++) {
      expect(flat[i].getTime()).toBeGreaterThan(flat[i - 1].getTime());
    }
  });
});

// ─── toIsoLocal ─────────────────────────────────────────────────────────────

describe("toIsoLocal", () => {
  it("returns a valid ISO 8601 string", () => {
    const iso = toIsoLocal("2025-06-15", "10:30");
    expect(() => new Date(iso)).not.toThrow();
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it("encodes the correct local hour and minute", () => {
    const iso = toIsoLocal("2025-06-15", "10:30");
    const dt = new Date(iso);
    // toIsoLocal constructs with local time, then toISOString converts to UTC.
    // We verify by round-tripping through local getters.
    const reconstructed = new Date(
      dt.getFullYear(),
      dt.getMonth(),
      dt.getDate(),
      dt.getHours(),
      dt.getMinutes(),
    );
    // The local date/time should match what we passed in
    expect(reconstructed.getHours()).toBe(10);
    expect(reconstructed.getMinutes()).toBe(30);
  });

  it("handles midnight (00:00)", () => {
    const iso = toIsoLocal("2025-01-01", "00:00");
    const dt = new Date(iso);
    expect(dt.getHours()).toBe(0);
    expect(dt.getMinutes()).toBe(0);
  });

  it("handles end-of-day (23:59)", () => {
    const iso = toIsoLocal("2025-12-31", "23:59");
    const dt = new Date(iso);
    expect(dt.getHours()).toBe(23);
    expect(dt.getMinutes()).toBe(59);
  });

  it("end time string is later than start time string for same day", () => {
    const start = toIsoLocal("2025-06-15", "09:00");
    const end = toIsoLocal("2025-06-15", "11:00");
    expect(new Date(end).getTime()).toBeGreaterThan(new Date(start).getTime());
  });
});
