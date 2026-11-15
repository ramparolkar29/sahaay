import type { DoseLog, Medicine } from "./types";
import { buildDayDoses, type DayDose } from "./schedule";
import { addDays, lastDays } from "./time";

export interface DayAdherence {
  date: string;
  taken: number;
  skipped: number;
  missed: number;
  total: number;
  pct: number;
}

export interface AdherenceSummary {
  taken: number;
  skipped: number;
  missed: number;
  total: number;
  pct: number;
  days: DayAdherence[];
  streak: number;
  missedToday: number;
}

export function buildAdherence(input: {
  medicines: Medicine[];
  logs: DoseLog[];
  today: string;
  nowMinutes: number;
  graceMinutes: number;
  windowDays?: number;
}): AdherenceSummary {
  const windowDays = input.windowDays ?? 7;
  const days: DayAdherence[] = [];
  const logsByDate = new Map<string, DoseLog[]>();
  for (const log of input.logs) {
    const list = logsByDate.get(log.slotDate);
    if (list) list.push(log);
    else logsByDate.set(log.slotDate, [log]);
  }

  for (const date of lastDays(input.today, windowDays)) {
    const dayOffset = date === input.today ? 0 : -1;
    const doses =
      date === input.today
        ? buildDayDoses({
            medicines: input.medicines,
            logs: logsByDate.get(date) ?? [],
            dateKey: date,
            nowMinutes: input.nowMinutes,
            graceMinutes: input.graceMinutes,
            dayOffset: 0,
          })
        : buildDayDoses({
            medicines: input.medicines,
            logs: logsByDate.get(date) ?? [],
            dateKey: date,
            nowMinutes: null,
            graceMinutes: input.graceMinutes,
            dayOffset: dayOffset,
          });
    const counted = doses.filter((dose) => dose.status === "taken" || dose.status === "skipped" || dose.status === "missed");
    const taken = counted.filter((dose) => dose.status === "taken").length;
    const skipped = counted.filter((dose) => dose.status === "skipped").length;
    const missed = counted.filter((dose) => dose.status === "missed").length;
    const total = counted.length;
    days.push({ date, taken, skipped, missed, total, pct: total === 0 ? 0 : Math.round((taken / total) * 100) });
  }

  const sum = (key: "taken" | "skipped" | "missed" | "total") => days.reduce((acc, day) => acc + day[key], 0);
  const total = sum("total");

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (day.total === 0) continue;
    if (day.missed > 0) break;
    streak += 1;
  }

  return {
    taken: sum("taken"),
    skipped: sum("skipped"),
    missed: sum("missed"),
    total,
    pct: total === 0 ? 100 : Math.round((sum("taken") / total) * 100),
    days,
    streak,
    missedToday: days[days.length - 1]?.missed ?? 0,
  };
}

export function missedDoses(medicines: Medicine[], logs: DoseLog[], today: string, nowMinutes: number, graceMinutes: number): DayDose[] {
  return buildDayDoses({ medicines, logs, dateKey: today, nowMinutes, graceMinutes, dayOffset: 0 }).filter(
    (dose) => dose.status === "missed",
  );
}

export function nextSevenDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}
