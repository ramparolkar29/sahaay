"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attemptLogin, createSession, destroySession, hashPasscode, requireContext } from "@/lib/auth";
import { deliverQueuedMessages } from "@/lib/delivery";
import { getRepo } from "@/lib/store";
import { medicineRunsOn } from "@/lib/schedule";
import { zonedTimeToUtc, timeLabel } from "@/lib/time";
import {
  appointmentSchema,
  joinSchema,
  medicalIdSchema,
  medicineSchema,
  reminderSettingsSchema,
  runReminderScan,
  setupSchema,
} from "@/lib/validation";

export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(error: unknown): ActionState {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues;
    return { error: issues[0]?.message ?? "Please check the details and try again." };
  }
  return { error: "Something went wrong. Please try again." };
}

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "Asia/Singapore"];

/* ---------------- auth ---------------- */

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = text(formData, "memberId");
  const passcode = text(formData, "passcode");
  if (!memberId) return { error: "Pick a profile first." };
  if (!/^\d{4,8}$/.test(passcode)) return { error: "Enter your 4 to 8 digit passcode." };

  const result = await attemptLogin(memberId, passcode);
  if (!result.ok) return { error: result.error };
  await createSession(result.member);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

/* ---------------- onboarding ---------------- */

export async function setupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setupSchema.safeParse({
    circleName: text(formData, "circleName"),
    elderName: text(formData, "elderName"),
    passcode: text(formData, "passcode"),
    bloodGroup: text(formData, "bloodGroup") || undefined,
    email: text(formData, "email") || undefined,
    timezone: TIMEZONES.includes(text(formData, "timezone")) ? text(formData, "timezone") : "Asia/Kolkata",
  });
  if (!parsed.success) return fail(parsed.error);
  const data = parsed.data;

  const repo = getRepo();
  const { member } = repo.createCircle({
    name: data.circleName,
    elderName: data.elderName,
    timezone: data.timezone,
    reminderLeadMinutes: 30,
    missedGraceMinutes: 90,
    bloodGroup: data.bloodGroup ?? null,
    member: {
      name: data.elderName,
      passcodeHash: await hashPasscode(data.passcode),
      email: data.email ? data.email : null,
    },
  });
  await createSession(member);
  redirect("/dashboard?welcome=1");
}

export async function joinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = joinSchema.safeParse({
    inviteCode: text(formData, "inviteCode"),
    name: text(formData, "name"),
    role: text(formData, "role"),
    passcode: text(formData, "passcode"),
    email: text(formData, "email") || undefined,
  });
  if (!parsed.success) return fail(parsed.error);
  const data = parsed.data;

  const repo = getRepo();
  const circle = repo.findCircleByInviteCode(data.inviteCode);
  if (!circle) return { error: "That invite code does not match any care circle." };

  const member = repo.addMember({
    circleId: circle.id,
    name: data.name,
    role: data.role,
    passcodeHash: await hashPasscode(data.passcode),
    email: data.email ? data.email : null,
    phone: null,
  });
  repo.addActivity(circle.id, member.id, "member", `${member.name} joined the care circle as ${data.role}`);
  await createSession(member);
  redirect("/dashboard?joined=1");
}

/* ---------------- doses ---------------- */

export async function recordDoseAction(formData: FormData): Promise<void> {
  const { member, circle } = await requireContext();
  const medicineId = text(formData, "medicineId");
  const slotDate = text(formData, "slotDate");
  const slotTime = text(formData, "slotTime");
  const status = text(formData, "status");

  const repo = getRepo();
  const medicine = repo.getMedicine(circle.id, medicineId);
  if (!medicine || !medicine.times.includes(slotTime) || !medicineRunsOn(medicine, slotDate)) {
    redirect("/dashboard");
  }

  if (status === "undo") {
    repo.clearDose(circle.id, medicineId, slotDate, slotTime);
    repo.addActivity(circle.id, member.id, "dose", `Cleared the ${timeLabel(slotTime)} ${medicine.name} entry`);
  } else if (status === "taken" || status === "skipped") {
    repo.recordDose({ circleId: circle.id, medicineId, slotDate, slotTime, status, recordedBy: member.id });
    const verb = status === "taken" ? "took" : "skipped";
    repo.addActivity(circle.id, member.id, "dose", `${member.name} ${verb} ${medicine.name} ${medicine.dosage} at ${timeLabel(slotTime)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/medicines");
  revalidatePath("/activity");
  revalidatePath("/outbox");
}

/* ---------------- medicines ---------------- */

function readMedicineForm(formData: FormData) {
  return medicineSchema.safeParse({
    name: text(formData, "name"),
    dosage: text(formData, "dosage"),
    form: text(formData, "form"),
    instructions: text(formData, "instructions") || undefined,
    times: formData.getAll("times").map((value) => String(value).trim()).filter(Boolean),
    days: formData.getAll("days").map((value) => Number(value)).filter((value) => Number.isInteger(value)),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate") || "",
  });
}

export async function saveMedicineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { member, circle } = await requireContext();
  const parsed = readMedicineForm(formData);
  if (!parsed.success) return fail(parsed.error);
  const data = parsed.data;
  if (data.endDate && data.endDate < data.startDate) {
    return { error: "The end date cannot be before the start date." };
  }

  const repo = getRepo();
  const payload = {
    name: data.name,
    dosage: data.dosage,
    form: data.form,
    instructions: data.instructions ? data.instructions : null,
    times: Array.from(new Set(data.times)),
    days: data.days,
    startDate: data.startDate,
    endDate: data.endDate ? data.endDate : null,
  };

  const medicineId = text(formData, "medicineId");
  if (medicineId) {
    const updated = repo.updateMedicine(circle.id, medicineId, payload);
    if (!updated) return { error: "That medicine could not be found." };
    repo.addActivity(circle.id, member.id, "medicine", `Updated ${updated.name} (${updated.dosage})`);
  } else {
    const created = repo.createMedicine(circle.id, member.id, payload);
    repo.addActivity(circle.id, member.id, "medicine", `Added ${created.name} ${created.dosage} · ${created.times.map(timeLabel).join(", ")}`);
  }

  revalidatePath("/medicines");
  revalidatePath("/dashboard");
  redirect("/medicines?saved=1");
}

export async function toggleMedicineAction(formData: FormData): Promise<void> {
  const { member, circle } = await requireContext();
  const id = text(formData, "medicineId");
  const active = text(formData, "active") === "1";
  const repo = getRepo();
  const medicine = repo.getMedicine(circle.id, id);
  if (!medicine) redirect("/medicines");
  repo.setMedicineActive(circle.id, id, active);
  repo.addActivity(circle.id, member.id, "medicine", `${active ? "Resumed" : "Paused"} ${medicine.name}`);
  revalidatePath("/medicines");
  revalidatePath("/dashboard");
}

export async function deleteMedicineAction(formData: FormData): Promise<void> {
  const { member, circle } = await requireContext();
  const id = text(formData, "medicineId");
  const repo = getRepo();
  const medicine = repo.getMedicine(circle.id, id);
  if (!medicine) redirect("/medicines");
  repo.deleteMedicine(circle.id, id);
  repo.addActivity(circle.id, member.id, "medicine", `Removed ${medicine.name} from the schedule`);
  revalidatePath("/medicines");
  revalidatePath("/dashboard");
}

/* ---------------- appointments ---------------- */

export async function saveAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { member, circle } = await requireContext();
  const date = text(formData, "date");
  const time = text(formData, "time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { error: "Pick a valid date and time." };
  }

  const parsed = appointmentSchema.safeParse({
    title: text(formData, "title"),
    doctor: text(formData, "doctor") || undefined,
    location: text(formData, "location") || undefined,
    startsAt: zonedTimeToUtc(date, time, circle.timezone).toISOString(),
    notes: text(formData, "notes") || undefined,
  });
  if (!parsed.success) return fail(parsed.error);

  const repo = getRepo();
  const appointment = repo.createAppointment(circle.id, member.id, {
    title: parsed.data.title,
    doctor: parsed.data.doctor ? parsed.data.doctor : null,
    location: parsed.data.location ? parsed.data.location : null,
    startsAt: parsed.data.startsAt,
    notes: parsed.data.notes ? parsed.data.notes : null,
  });
  repo.addActivity(circle.id, member.id, "appointment", `Added ${appointment.title} on ${date}`);
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  redirect("/appointments?saved=1");
}

export async function deleteAppointmentAction(formData: FormData): Promise<void> {
  const { member, circle } = await requireContext();
  const id = text(formData, "appointmentId");
  const repo = getRepo();
  const appointment = repo.getAppointment(circle.id, id);
  if (!appointment) redirect("/appointments");
  repo.deleteAppointment(circle.id, id);
  repo.addActivity(circle.id, member.id, "appointment", `Removed ${appointment.title}`);
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

/* ---------------- care team & profile ---------------- */

export async function removeMemberAction(formData: FormData): Promise<void> {
  const { member, circle } = await requireContext();
  const id = text(formData, "memberId");
  if (id === member.id) redirect("/team?error=self");
  const target = getRepo().getMember(id);
  if (!target || target.circleId !== circle.id) redirect("/team");
  const removed = getRepo().removeMember(circle.id, id);
  if (removed) getRepo().addActivity(circle.id, member.id, "member", `${target.name} was removed from the care circle`);
  revalidatePath("/team");
}

export async function saveMedicalIdAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { member, circle } = await requireContext();
  const parsed = medicalIdSchema.safeParse({
    bloodGroup: text(formData, "bloodGroup") || undefined,
    allergies: text(formData, "allergies") || undefined,
    conditions: text(formData, "conditions") || undefined,
    emergencyContact: text(formData, "emergencyContact") || undefined,
  });
  if (!parsed.success) return fail(parsed.error);
  getRepo().updateCircleMedical(circle.id, {
    bloodGroup: parsed.data.bloodGroup ?? null,
    allergies: parsed.data.allergies ?? null,
    conditions: parsed.data.conditions ?? null,
    emergencyContact: parsed.data.emergencyContact ?? null,
  });
  getRepo().addActivity(circle.id, member.id, "profile", "Updated the medical ID");
  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { ok: true, message: "Medical ID saved." };
}

export async function saveReminderSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { circle } = await requireContext();
  const parsed = reminderSettingsSchema.safeParse({
    reminderLeadMinutes: text(formData, "reminderLeadMinutes"),
    missedGraceMinutes: text(formData, "missedGraceMinutes"),
  });
  if (!parsed.success) return fail(parsed.error);
  getRepo().updateCircleMedical(circle.id, parsed.data);
  revalidatePath("/outbox");
  return { ok: true, message: "Alert settings updated." };
}

/* ---------------- reminders ---------------- */

export async function runScanAction(): Promise<void> {
  const { circle } = await requireContext();
  const repo = getRepo();
  const result = runReminderScan(repo, circle.id);
  await deliverQueuedMessages(repo, circle.id).catch(() => null);
  revalidatePath("/outbox");
  revalidatePath("/dashboard");
  redirect(`/outbox?ran=1&queued=${result.queued}&dupes=${result.duplicates}`);
}

export async function markSentAction(formData: FormData): Promise<void> {
  const { circle } = await requireContext();
  const id = text(formData, "messageId");
  getRepo().markOutboxSent(circle.id, id);
  revalidatePath("/outbox");
}

export async function clearOutboxAction(): Promise<void> {
  const { circle } = await requireContext();
  getRepo().clearOutbox(circle.id);
  revalidatePath("/outbox");
}
