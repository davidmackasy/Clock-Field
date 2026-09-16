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

function safeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC" }).format();
    return tz || "UTC";
  } catch {
    return "UTC";
  }
}

/** Format an absolute UTC timestamp in the company's configured IANA timezone. */
export function formatCompanyInstant(
  value: string | number | Date,
  tz: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: safeTimeZone(tz),
  }).format(new Date(value));
}

export function companyDateKey(value: string | number | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatCompanyDate(value: string | number | Date, tz: string, short = false): string {
  return formatCompanyInstant(value, tz, short
    ? { year: "2-digit", month: "2-digit", day: "2-digit" }
    : { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatCompanyLongDate(value: string | number | Date, tz: string): string {
  return formatCompanyInstant(value, tz, { year: "numeric", month: "short", day: "numeric" });
}

export function formatCompanyTime(value: string | number | Date, tz: string): string {
  return formatCompanyInstant(value, tz, { hour: "numeric", minute: "2-digit", hour12: true });
}

/**
 * Scheduled shift datetimes are stored as company-local wall-clock strings.
 * Format their HH:mm component without reinterpreting them in the browser timezone.
 */
export function formatLocalWallTime(value: string): string {
  const match = String(value || "").match(/T(\d{2}):(\d{2})/);
  if (!match) return "—";
  const date = new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2])));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Format a stored company-local YYYY-MM-DD date without browser timezone conversion. */
export function formatLocalDate(value: string, short = false, weekday = false): string {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: short ? "2-digit" : "numeric",
    month: "short",
    day: "numeric",
    ...(weekday ? { weekday: "short" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

export function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
