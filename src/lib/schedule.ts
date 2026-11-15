import type { DoseLog, DoseStatus, Medicine } from "./types";
import { parseTimeToMinutes, timeLabel, weekdayOf } from "./time";

export interface DayDose {
  medicineId: string;
  name: string;
  dosage: string;
  form: string;
  instructions: string | null;
  date: string;
  time: string;
  minutes: number;
  status: DoseStatus;
  log: DoseLog | null;
  isPast: boolean;
  isNow: boolean;
}

/** Does this medicine run on a given date (weekday + start/end window)? */
export function medicineRunsOn(medicine: Medicine, dateKey: string): boolean {
  if (!medicine.active) return false;
  const weekday = weekdayOf(dateKey);
  if (medicine.days.length > 0 && !medicine.days.includes(weekday)) return false;
  if (dateKey < medicine.startDate) return false;
  if (medicine.endDate && dateKey > medicine.endDate) return false;
  return true;
}

export function slotsForDate(medicine: Medicine, dateKey: string): string[] {
  return medicineRunsOn(medicine, dateKey) ? medicine.times : [];
}

export function doseStatus(input: {
  slotMinutes: number;
  nowMinutes: number | null;
  dayOffset: number;
  log: DoseLog | null;
  graceMinutes: number;
}): DoseStatus {
  if (input.log) return input.log.status;
  if (input.dayOffset < 0) return "missed";
  if (input.dayOffset > 0) return "upcoming";
  const now = input.nowMinutes ?? 0;
  if (now > input.slotMinutes + input.graceMinutes) return "missed";
  if (now >= input.slotMinutes - 15) return "due";
  return "upcoming";
}

export function buildDayDoses(input: {
  medicines: Medicine[];
  logs: DoseLog[];
  dateKey: string;
  nowMinutes: number | null;
  graceMinutes: number;
  dayOffset: number;
}): DayDose[] {
  const logIndex = new Map(input.logs.map((log) => [`${log.medicineId}|${log.slotTime}`, log]));
  const doses: DayDose[] = [];
  for (const medicine of input.medicines) {
    for (const time of slotsForDate(medicine, input.dateKey)) {
      const minutes = parseTimeToMinutes(time);
      const log = logIndex.get(`${medicine.id}|${time}`) ?? null;
      doses.push({
        medicineId: medicine.id,
        name: medicine.name,
        dosage: medicine.dosage,
        form: medicine.form,
        instructions: medicine.instructions,
        date: input.dateKey,
        time,
        minutes,
        log,
        status: doseStatus({ slotMinutes: minutes, nowMinutes: input.nowMinutes, dayOffset: input.dayOffset, log, graceMinutes: input.graceMinutes }),
        isPast: input.dayOffset < 0 || (input.dayOffset === 0 && (input.nowMinutes ?? 0) > minutes),
        isNow: input.dayOffset === 0 && Math.abs((input.nowMinutes ?? 0) - minutes) <= 30,
      });
    }
  }
  return doses.sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name));
}

/** The single most useful next action: due/missed first, then the next upcoming dose. */
export function pickNextDose(doses: DayDose[], nowMinutes: number): DayDose | null {
  const actionable = doses.find((d) => d.status === "due" || d.status === "missed");
  if (actionable) return actionable;
  return doses.find((d) => d.minutes >= nowMinutes && d.status === "upcoming") ?? null;
}

export function scheduleSummary(medicine: Medicine): string {
  const times = medicine.times.map(timeLabel).join(" · ");
  if (medicine.days.length === 0) return `Every day · ${times}`;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${medicine.days.map((d) => dayNames[d]).join(", ")} · ${times}`;
}
