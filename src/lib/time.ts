export type ZonedMoment = {
  /** YYYY-MM-DD in the target time zone */
  date: string;
  /** minutes since midnight */
  minutes: number;
  /** 0 = Sunday */
  weekday: number;
};

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    partsCache.set(timeZone, fmt);
  }
  return fmt;
}

export function zonedMoment(at: Date, timeZone: string): ZonedMoment {
  const parts: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(at)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  return { date, minutes: hour * 60 + Number(parts.minute), weekday: weekdayOf(date) };
}

export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + delta));
  return next.toISOString().slice(0, 10);
}

export function lastDays(todayKey: string, count: number): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) days.push(addDays(todayKey, -i));
  return days;
}

export function dayDelta(fromKey: string, toKey: string): number {
  const parse = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toKey) - parse(fromKey)) / 86_400_000);
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const clamped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Converts a wall-clock date/time in `timeZone` into a UTC instant. */
export function zonedTimeToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, h, mi);
  let stamp = target;
  for (let i = 0; i < 3; i += 1) {
    const observed = zonedMoment(new Date(stamp), timeZone);
    const [oy, om, od] = observed.date.split("-").map(Number);
    const observedUtc = Date.UTC(oy, om - 1, od) + observed.minutes * 60_000;
    stamp += target - observedUtc;
  }
  return new Date(stamp);
}

const TIME_LABELS = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

/** "08:00" -> "8:00 am" */
export function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return TIME_LABELS.format(new Date(2020, 0, 1, h, m)).toLowerCase().replace(/\s/g, " ");
}

const DATE_LABELS = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const DATE_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** "2026-11-15" -> "Sat, 15 Nov" */
export function dateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return DATE_LABELS.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function dateLabelLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return DATE_LONG.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_SHORT[weekday];
}

export function formatInZone(at: Date, timeZone: string, withTime = true): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", timeZone };
  if (withTime) Object.assign(opts, { hour: "numeric", minute: "2-digit", hour12: true });
  return new Intl.DateTimeFormat("en-GB", opts).format(at);
}

/** Human countdown such as "in 2 h 15 m" / "12 min ago" from minute distances. */
export function relativeMinutes(diff: number): string {
  const abs = Math.abs(diff);
  const label = abs < 60 ? `${abs} min` : abs < 1440 ? `${Math.floor(abs / 60)} h ${abs % 60} m` : `${Math.floor(abs / 1440)} d`;
  return diff < 0 ? `${label} ago` : `in ${label}`;
}
