import { z } from "zod";
import type { Repository } from "./store";
import { buildReminderDrafts } from "./reminders";
import { addDays, zonedMoment } from "./time";

export const passcodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "Passcode must be 4 to 8 digits");

export const setupSchema = z.object({
  circleName: z.string().trim().min(2, "Give the care circle a name").max(60),
  elderName: z.string().trim().min(2, "What should we call them?").max(60),
  passcode: passcodeSchema,
  bloodGroup: z.string().trim().max(6).optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  timezone: z.string().trim().min(1).default("Asia/Kolkata"),
});

export const joinSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6}$/, "Invite codes are 6 characters"),
  name: z.string().trim().min(2, "Enter your name").max(60),
  role: z.enum(["caretaker", "family"]),
  passcode: passcodeSchema,
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
});

export const medicineSchema = z.object({
  name: z.string().trim().min(2, "Medicine name is required").max(80),
  dosage: z.string().trim().min(1, "Dosage is required").max(40),
  form: z.enum(["tablet", "capsule", "syrup", "drops", "injection", "inhaler", "other"]),
  instructions: z.string().trim().max(160).optional(),
  times: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM"))
    .min(1, "Add at least one time")
    .max(6),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export const appointmentSchema = z.object({
  title: z.string().trim().min(2, "What is the appointment for?").max(80),
  doctor: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  startsAt: z.string().min(1, "Pick a date and time"),
  notes: z.string().trim().max(400).optional(),
});

export const medicalIdSchema = z.object({
  bloodGroup: z.string().trim().max(6).optional(),
  allergies: z.string().trim().max(160).optional(),
  conditions: z.string().trim().max(160).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
});

export const reminderSettingsSchema = z.object({
  reminderLeadMinutes: z.coerce.number().int().min(5).max(240),
  missedGraceMinutes: z.coerce.number().int().min(15).max(360),
});

export interface ScanResult {
  queued: number;
  duplicates: number;
  considered: number;
  reason?: string;
}

/** Generates reminder emails for one circle (or all) and queues anything new. */
export function runReminderScan(repo: Repository, circleId?: string, now = new Date()): ScanResult {
  const circles = circleId ? [repo.getCircle(circleId)].filter(Boolean) : repo.listCircleOverviews();
  let queued = 0;
  let duplicates = 0;
  let considered = 0;
  let reason: string | undefined;

  for (const circle of circles) {
    if (!circle) continue;
    const members = repo.listMembers(circle.id);
    const medicines = repo.listMedicines(circle.id);
    const today = zonedMoment(now, circle.timezone).date;
    const logs = repo.listDoseLogs(circle.id, addDays(today, -1), today);
    const appointments = repo.listAppointments(circle.id);

    const drafts = buildReminderDrafts({ circle, members, medicines, logs, appointments, now });
    considered += drafts.length;
    if (drafts.length === 0 && !reason) {
      const hasEmail = members.some((m) => m.email);
      reason = hasEmail ? "Nothing needs a reminder right now." : "No email on file — add one in Care team to enable reminders.";
    }
    for (const draft of drafts) {
      const inserted = repo.enqueueMessage({ circleId: circle.id, ...draft });
      if (inserted) queued += 1;
      else duplicates += 1;
    }
  }

  return { queued, duplicates, considered, reason };
}
