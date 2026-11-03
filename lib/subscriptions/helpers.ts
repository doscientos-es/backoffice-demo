/**
 * Pure subscription helpers — no server-side deps, safe for client + test use.
 */

/**
 * Advance a YYYY-MM-DD date by one billing cycle.
 *
 * Clamps to the last valid day of the target month so months with fewer days
 * than the source never roll over (e.g. Jan 31 + 1 month → Feb 28/29, not
 * Mar 3; Feb 29 + 1 year on a non-leap year → Feb 28).
 */
export function advanceDate(date: string, cycle: string): string {
  const parts = date.split("-").map(Number);
  const [y = 0, m = 1, d = 1] = parts;
  let newYear = y;
  let newMonth = m; // 1-based

  if (cycle === "monthly") newMonth += 1;
  else if (cycle === "quarterly") newMonth += 3;
  else if (cycle === "yearly") newYear += 1;

  // Normalise overflow (e.g. month 13 → January of next year)
  while (newMonth > 12) {
    newMonth -= 12;
    newYear += 1;
  }

  // Clamp day to last valid day of the target month.
  // new Date(year, M_1based, 0) returns the last day of that 1-indexed month.
  const lastDay = new Date(newYear, newMonth, 0).getDate();
  const clampedDay = Math.min(d, lastDay);

  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}
