import type { Appointment, Circle, DoseLog, Member, Medicine } from "./types";
import { buildDayDoses } from "./schedule";
import { formatInZone, timeLabel, zonedMoment } from "./time";

export interface ReminderDraft {
  kind: "dose-upcoming" | "dose-missed" | "escalation" | "appointment";
  toEmail: string;
  subject: string;
  body: string;
  dedupeKey: string;
}

function recipients(circle: Circle, members: Member[]): Member[] {
  const family = members.filter((m) => m.role !== "elder" && m.email);
  if (family.length > 0) return family;
  return members.filter((m) => m.email);
}

function greeting(members: Member[]): string {
  const names = members.map((m) => m.name.split(" ")[0]);
  if (names.length === 0) return "Hello";
  if (names.length === 1) return `Hi ${names[0]}`;
  return `Hi ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function buildReminderDrafts(input: {
  circle: Circle;
  members: Member[];
  medicines: Medicine[];
  logs: DoseLog[];
  appointments: Appointment[];
  now: Date;
}): ReminderDraft[] {
  const { circle, medicines, logs, appointments, now } = input;
  const recipientsList = recipients(circle, input.members);
  if (recipientsList.length === 0) return [];

  const toEmail = recipientsList.map((m) => m.email!).join(",");
  const hello = greeting(recipientsList);
  const moment = zonedMoment(now, circle.timezone);
  const drafts: ReminderDraft[] = [];

  const todayDoses = buildDayDoses({
    medicines,
    logs: logs.filter((log) => log.slotDate === moment.date),
    dateKey: moment.date,
    nowMinutes: moment.minutes,
    graceMinutes: circle.missedGraceMinutes,
    dayOffset: 0,
  });

  for (const dose of todayDoses) {
    if (dose.status === "upcoming" && dose.minutes >= moment.minutes && dose.minutes - moment.minutes <= circle.reminderLeadMinutes) {
      drafts.push({
        kind: "dose-upcoming",
        toEmail,
        subject: `Dose in ${dose.minutes - moment.minutes} min · ${dose.name} ${dose.dosage}`,
        body: `${hello},\n\n${circle.elderName} has a dose coming up at ${timeLabel(dose.time)}.\n\n• ${dose.name} ${dose.dosage} (${dose.form})${dose.instructions ? `\n• ${dose.instructions}` : ""}\n\nIf it is already taken, mark it in Sahaay so the whole care circle can see it.`,
        dedupeKey: `${circle.id}|dose-upcoming|${dose.medicineId}|${dose.date}|${dose.time}`,
      });
    }

    if (dose.status === "missed") {
      const late = moment.minutes - dose.minutes;
      drafts.push({
        kind: "dose-missed",
        toEmail,
        subject: `Missed dose · ${dose.name} ${dose.dosage} at ${timeLabel(dose.time)}`,
        body: `${hello},\n\n${circle.elderName} has not logged the ${timeLabel(dose.time)} dose of ${dose.name} ${dose.dosage}.\n\nIt was due ${Math.floor(late / 60) > 0 ? `${Math.floor(late / 60)} h ${late % 60} min` : `${late} min`} ago and is now marked as missed.\n\nPlease check in and update Sahaay once you know what happened.`,
        dedupeKey: `${circle.id}|dose-missed|${dose.medicineId}|${dose.date}|${dose.time}`,
      });
    }
  }

  const missedToday = todayDoses.filter((dose) => dose.status === "missed").length;
  if (missedToday >= 3) {
    drafts.push({
      kind: "escalation",
      toEmail,
      subject: `Needs attention · ${missedToday} missed doses today`,
      body: `${hello},\n\n${circle.elderName} has missed ${missedToday} doses today.\n\nA pattern of missed medication is worth a phone call. Sahaay escalates after three missed doses in a day so nothing slips quietly.\n\nEmergency contact on file: ${circle.emergencyContact ?? "not added yet"}.`,
      dedupeKey: `${circle.id}|escalation|${moment.date}`,
    });
  }

  for (const appointment of appointments) {
    const starts = new Date(appointment.startsAt);
    const hoursAway = (starts.getTime() - now.getTime()) / 3_600_000;
    if (hoursAway <= 0 || hoursAway > 24) continue;
    const dayWord = zonedMoment(starts, circle.timezone).date === moment.date ? "Today" : "Tomorrow";
    drafts.push({
      kind: "appointment",
      toEmail,
      subject: `${dayWord} · ${appointment.title}`,
      body: `${hello},\n\nA reminder for ${circle.elderName}'s appointment.\n\n• ${appointment.title}\n• ${formatInZone(starts, circle.timezone)}\n${appointment.doctor ? `• ${appointment.doctor}\n` : ""}${appointment.location ? `• ${appointment.location}\n` : ""}${appointment.notes ? `\n${appointment.notes}\n` : ""}\nLeave a little extra time for travel.`,
      dedupeKey: `${circle.id}|appointment|${appointment.id}|24h`,
    });
  }

  return drafts;
}
