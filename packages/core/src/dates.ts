/** A Matrix's date: a plain calendar date, `YYYY-MM-DD`. */
export type CalendarDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar date at `now` in the laptop's local time zone. */
export const localDate = (now: Date): CalendarDate => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** Whether `s` is a real calendar date written `YYYY-MM-DD`. */
export function isCalendarDate(s: string): s is CalendarDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return localDate(new Date(y, m - 1, d)) === s;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** How a date is shown in the header, e.g. "Thursday, 24 September". */
export function formatDate(date: CalendarDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const day = new Date(y, m - 1, d);
  return `${WEEKDAYS[day.getDay()]}, ${d} ${MONTHS[m - 1]}`;
}
