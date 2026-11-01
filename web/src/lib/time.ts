const pad = (n: number) => String(n).padStart(2, "0");

export const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

const utc = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const DAYS = ["ned", "pon", "uto", "sre", "čet", "pet", "sub"];
const DAYS_LONG = ["nedelja", "ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota"];
const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

export const weekday = (date: string) => utc(date).getUTCDay();
export const dayShort = (date: string) => DAYS[weekday(date)];
export const dayLong = (date: string) => DAYS_LONG[weekday(date)];
export const dayNumber = (date: string) => utc(date).getUTCDate();
export const monthShort = (date: string) => MONTHS[utc(date).getUTCMonth()];

export function niceDate(date: string) {
  const dt = utc(date);
  return `${DAYS_LONG[dt.getUTCDay()]}, ${dt.getUTCDate()}. ${MONTHS[dt.getUTCMonth()]}`;
}

export function belgradeNowMinutes(nowIso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(nowIso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return get("hour") * 60 + get("minute");
}

export const rsd = (n: number) => `${n.toLocaleString("sr-RS")} RSD`;

export function priceFor(date: string, start: number, duration: number, prices: { offPeak: number; peak: number }, peakFrom: number) {
  const wd = weekday(date);
  let total = 0;
  for (let t = start; t < start + duration; t += 30) {
    total += ((wd === 0 || wd === 6 || t >= peakFrom) ? prices.peak : prices.offPeak) / 2;
  }
  return total;
}
