export const dateShift = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
};
export function payrollPeriod(anchor: string, reference: string, paydayDelay = 5, summaryDays: number[] = [2, 4]) {
  const difference = Math.round((Date.parse(reference + "T12:00:00Z") - Date.parse(anchor + "T12:00:00Z")) / 86400000);
  const start = dateShift(anchor, Math.floor(difference / 14) * 14);
  const end = dateShift(start, 13);
  return { start, end, payday: dateShift(end, paydayDelay), summaryDates: summaryDays.map(days => dateShift(end, days)) };
}
export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
}
