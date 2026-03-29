/**
 * Returns today's date string YYYY-MM-DD in the given IANA timezone.
 * Falls back to UTC if timezone is invalid or missing.
 */
export function localToday(tz: string): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
  } catch {
    return new Date().toLocaleDateString("en-CA", { timeZone: "UTC" });
  }
}

/**
 * Returns an array of 7 date strings (YYYY-MM-DD) for Mon–Sun of the
 * current week, computed in the given IANA timezone.
 */
export function localWeekDates(tz: string): string[] {
  const todayStr = localToday(tz);
  const base = new Date(todayStr + "T12:00:00");
  const dow = base.getDay();
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + offsetToMon);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toLocaleDateString("en-CA", { timeZone: tz || "UTC" }));
  }
  return dates;
}
