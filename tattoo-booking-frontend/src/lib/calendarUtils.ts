/** Returns a new Date floored to 00:00:00.000 in local time. */
export function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Returns a 6-week matrix (array of 7-day arrays) for the calendar month view.
 * @param year       Full year, e.g. 2025
 * @param monthIndex0  0-based month index (0 = January)
 */
export function getMonthMatrix(year: number, monthIndex0: number): Date[][] {
  const first = new Date(year, monthIndex0, 1);
  const firstDow = first.getDay(); // 0 (Sun) … 6 (Sat)

  const weeks: Date[][] = [];
  const cur = new Date(year, monthIndex0, 1 - firstDow);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Converts a local date string + time string into an ISO 8601 string
 * using the local timezone (which Postgres interprets as UTC when stored
 * as timestamptz via the ISO format).
 * @param date  "YYYY-MM-DD"
 * @param time  "HH:MM"
 */
export function toIsoLocal(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}
