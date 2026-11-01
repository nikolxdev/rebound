export const TZ = "Europe/Belgrade";
export const OPEN = 8 * 60;
export const CLOSE = 23 * 60;
export const STEP = 30;
export const DURATIONS = [60, 90, 120];
export const DAYS_AHEAD = 14;
export const PRICES = { offPeak: 2400, peak: 3200 };
export const PEAK_FROM = 16 * 60;
export const CANCEL_BEFORE = 120;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zoned(date) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

function offsetMinutes(date) {
  const z = zoned(date);
  const asUtc = Date.UTC(z.y, z.m - 1, z.d, z.h, z.min, z.s);
  return Math.round((asUtc - date.getTime()) / 60000);
}

const pad = (n) => String(n).padStart(2, "0");

export function isDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function toInstant(date, minutes) {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  let t = wall - offsetMinutes(new Date(wall)) * 60000;
  const again = wall - offsetMinutes(new Date(t)) * 60000;
  if (again !== t) t = again;
  return new Date(t);
}

export function toLocal(instant) {
  const z = zoned(instant);
  return { date: `${z.y}-${pad(z.m)}-${pad(z.d)}`, minutes: z.h * 60 + z.min };
}

export function today(now = new Date()) {
  return toLocal(now).date;
}

export function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysBetween(from, to) {
  const a = Date.UTC(...from.split("-").map((v, i) => (i === 1 ? v - 1 : +v)));
  const b = Date.UTC(...to.split("-").map((v, i) => (i === 1 ? v - 1 : +v)));
  return Math.round((b - a) / 86400000);
}

export function weekday(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isPeak(date, minute) {
  const wd = weekday(date);
  return wd === 0 || wd === 6 || minute >= PEAK_FROM;
}

export function price(date, start, duration) {
  let total = 0;
  for (let t = start; t < start + duration; t += STEP) {
    total += (isPeak(date, t) ? PRICES.peak : PRICES.offPeak) * (STEP / 60);
  }
  return Math.round(total);
}

export function hhmm(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function slotError({ date, start, duration }, now = new Date(), { durations = DURATIONS, allowPast = false } = {}) {
  if (!isDate(date)) return "bad_date";
  if (!Number.isInteger(start) || start % STEP !== 0) return "bad_start";
  if (!durations.includes(duration)) return "bad_duration";
  if (start < OPEN || start + duration > CLOSE) return "closed";
  const ahead = daysBetween(today(now), date);
  if (ahead > DAYS_AHEAD) return "too_far";
  if (!allowPast && toInstant(date, start) <= now) return "past";
  return null;
}
