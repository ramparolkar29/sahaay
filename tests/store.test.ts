import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "@/lib/db";
import { Repository } from "@/lib/store";
import { runReminderScan } from "@/lib/validation";

let db: DatabaseSync;
let repo: Repository;

function makeCircle(name: string) {
  return repo.createCircle({
    name,
    elderName: "Elder One",
    timezone: "Asia/Kolkata",
    reminderLeadMinutes: 30,
    missedGraceMinutes: 90,
    member: { name: "Elder One", passcodeHash: "hash", email: "elder@example.com" },
  });
}

beforeEach(() => {
  db = createDatabase(":memory:");
  repo = new Repository(db);
});

describe("circles and invite codes", () => {
  it("creates a circle with a six-character invite code and one elder", () => {
    const { circle, member } = makeCircle("Sharma family");
    expect(circle.inviteCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(repo.listMembers(circle.id)).toHaveLength(1);
    expect(member.role).toBe("elder");
    expect(repo.listCircleOverviews()[0]).toMatchObject({ name: "Sharma family", memberCount: 1 });
  });

  it("finds invite codes regardless of case and surrounding spaces", () => {
    const { circle } = makeCircle("Sharma family");
    const found = repo.findCircleByInviteCode(`  ${circle.inviteCode.toLowerCase()} `);
    expect(found?.id).toBe(circle.id);
    expect(repo.findCircleByInviteCode("ZZZZZZ")).toBeNull();
  });

  it("keeps invite codes unique across circles", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const { circle } = makeCircle(`Family ${i}`);
      expect(codes.has(circle.inviteCode)).toBe(false);
      codes.add(circle.inviteCode);
    }
  });

  it("orders the elder first when listing members", () => {
    const { circle } = makeCircle("Sharma family");
    repo.addMember({ circleId: circle.id, name: "Family", role: "family", passcodeHash: "h", email: null, phone: null });
    repo.addMember({ circleId: circle.id, name: "Caretaker", role: "caretaker", passcodeHash: "h", email: null, phone: null });
    expect(repo.listMembers(circle.id).map((m) => m.role)).toEqual(["elder", "caretaker", "family"]);
  });

  it("refuses to remove the elder but removes other members", () => {
    const { circle } = makeCircle("Sharma family");
    const elder = repo.listMembers(circle.id)[0];
    const carer = repo.addMember({
      circleId: circle.id,
      name: "Caretaker",
      role: "caretaker",
      passcodeHash: "h",
      email: null,
      phone: null,
    });
    expect(repo.removeMember(circle.id, elder.id)).toBe(false);
    expect(repo.removeMember(circle.id, carer.id)).toBe(true);
    expect(repo.listMembers(circle.id)).toHaveLength(1);
  });
});

describe("cross-circle scoping", () => {
  it("never returns another circle's records", () => {
    const a = makeCircle("A family");
    const b = makeCircle("B family");
    const medicine = repo.createMedicine(a.circle.id, a.member.id, {
      name: "Amlodipine",
      dosage: "5 mg",
      form: "tablet",
      instructions: null,
      times: ["08:00"],
      days: [],
      startDate: "2026-01-01",
      endDate: null,
    });
    const appointment = repo.createAppointment(a.circle.id, a.member.id, {
      title: "Cardiology",
      doctor: null,
      location: null,
      startsAt: "2026-11-20T05:30:00.000Z",
      notes: null,
    });

    expect(repo.getMedicine(b.circle.id, medicine.id)).toBeNull();
    expect(repo.getMedicine(a.circle.id, medicine.id)?.name).toBe("Amlodipine");
    expect(repo.getAppointment(b.circle.id, appointment.id)).toBeNull();
    expect(repo.deleteMedicine(b.circle.id, medicine.id)).toBe(false);
    expect(repo.deleteAppointment(b.circle.id, appointment.id)).toBe(false);
    expect(repo.listMedicines(b.circle.id)).toHaveLength(0);
    expect(repo.listAppointments(b.circle.id)).toHaveLength(0);
  });

  it("scopes dose logs by circle", () => {
    const a = makeCircle("A family");
    const b = makeCircle("B family");
    const medicine = repo.createMedicine(a.circle.id, a.member.id, {
      name: "Metformin",
      dosage: "500 mg",
      form: "tablet",
      instructions: null,
      times: ["08:00"],
      days: [],
      startDate: "2026-01-01",
      endDate: null,
    });

    repo.recordDose({
      circleId: a.circle.id,
      medicineId: medicine.id,
      slotDate: "2026-11-15",
      slotTime: "08:00",
      status: "taken",
      recordedBy: a.member.id,
    });

    expect(repo.listDoseLogs(a.circle.id, "2026-11-01", "2026-11-30")).toHaveLength(1);
    expect(repo.listDoseLogs(b.circle.id, "2026-11-01", "2026-11-30")).toHaveLength(0);
    expect(repo.getDoseLog(b.circle.id, medicine.id, "2026-11-15", "08:00")).toBeNull();
  });
});

describe("dose logging", () => {
  it("updates the existing row instead of duplicating when a dose is re-marked", () => {
    const { circle, member } = makeCircle("Sharma family");
    const medicine = repo.createMedicine(circle.id, member.id, {
      name: "Amlodipine",
      dosage: "5 mg",
      form: "tablet",
      instructions: null,
      times: ["08:00"],
      days: [],
      startDate: "2026-01-01",
      endDate: null,
    });
    const slot = { circleId: circle.id, medicineId: medicine.id, slotDate: "2026-11-15", slotTime: "08:00", recordedBy: member.id };

    repo.recordDose({ ...slot, status: "taken" });
    const updated = repo.recordDose({ ...slot, status: "skipped" });

    expect(updated.status).toBe("skipped");
    expect(repo.listDoseLogs(circle.id, "2026-11-15", "2026-11-15")).toHaveLength(1);

    repo.clearDose(circle.id, medicine.id, "2026-11-15", "08:00");
    expect(repo.getDoseLog(circle.id, medicine.id, "2026-11-15", "08:00")).toBeNull();
  });

  it("sorts and stores medicine times so scheduling is deterministic", () => {
    const { circle, member } = makeCircle("Sharma family");
    const medicine = repo.createMedicine(circle.id, member.id, {
      name: "Metformin",
      dosage: "500 mg",
      form: "tablet",
      instructions: null,
      times: ["20:00", "08:00"],
      days: [5, 1],
      startDate: "2026-01-01",
      endDate: null,
    });
    expect(medicine.times).toEqual(["08:00", "20:00"]);
    expect(medicine.days).toEqual([1, 5]);
  });
});

describe("outbox", () => {
  it("ignores a duplicate dedupe key", () => {
    const { circle } = makeCircle("Sharma family");
    const message = {
      circleId: circle.id,
      toEmail: "family@example.com",
      subject: "Dose in 20 min",
      body: "Hello",
      kind: "dose-upcoming",
      dedupeKey: `${circle.id}|dose-upcoming|med|2026-11-15|08:00`,
    };
    expect(repo.enqueueMessage(message)).toBe(true);
    expect(repo.enqueueMessage(message)).toBe(false);
    expect(repo.listOutbox(circle.id)).toHaveLength(1);
  });

  it("marks messages sent and clears the queue per circle", () => {
    const a = makeCircle("A family");
    const b = makeCircle("B family");
    repo.enqueueMessage({ circleId: a.circle.id, toEmail: "a@example.com", subject: "s", body: "b", kind: "k", dedupeKey: "a-1" });
    repo.enqueueMessage({ circleId: b.circle.id, toEmail: "b@example.com", subject: "s", body: "b", kind: "k", dedupeKey: "b-1" });

    const queued = repo.listOutbox(a.circle.id)[0];
    expect(repo.markOutboxSent(a.circle.id, queued.id)).toBe(true);
    expect(repo.listOutbox(a.circle.id)[0].status).toBe("sent");

    repo.clearOutbox(a.circle.id);
    expect(repo.listOutbox(a.circle.id)).toHaveLength(0);
    expect(repo.listOutbox(b.circle.id)).toHaveLength(1);
  });
});

describe("runReminderScan", () => {
  it("queues an upcoming-dose email once and deduplicates the next scan", () => {
    const { circle, member } = makeCircle("Sharma family");
    repo.updateCircleMedical(circle.id, { reminderLeadMinutes: 30 });
    repo.addMember({
      circleId: circle.id,
      name: "Anil Sharma",
      role: "family",
      passcodeHash: "h",
      email: "anil@example.com",
      phone: null,
    });
    repo.createMedicine(circle.id, member.id, {
      name: "Amlodipine",
      dosage: "5 mg",
      form: "tablet",
      instructions: null,
      times: ["08:00"],
      days: [],
      startDate: "2026-01-01",
      endDate: null,
    });

    // 07:40 in Asia/Kolkata — 20 minutes before the 08:00 dose.
    const now = new Date("2026-11-15T02:10:00Z");

    const first = runReminderScan(repo, circle.id, now);
    expect(first).toMatchObject({ queued: 1, duplicates: 0, considered: 1 });
    const queued = repo.listOutbox(circle.id);
    expect(queued[0]).toMatchObject({ kind: "dose-upcoming", toEmail: "anil@example.com" });
    expect(queued[0].subject).toContain("20 min");

    const second = runReminderScan(repo, circle.id, now);
    expect(second).toMatchObject({ queued: 0, duplicates: 1, considered: 1 });
    expect(repo.listOutbox(circle.id)).toHaveLength(1);
  });

  it("explains why nothing was queued when no member has an email", () => {
    const { circle } = makeCircle("Sharma family");
    db.prepare("UPDATE members SET email = NULL WHERE circle_id = ?").run(circle.id);

    const result = runReminderScan(repo, circle.id, new Date("2026-11-15T02:10:00Z"));
    expect(result.queued).toBe(0);
    expect(result.reason).toContain("No email on file");
  });
});

describe("auth attempts", () => {
  it("counts failures only inside the lock window", () => {
    const { member } = makeCircle("Sharma family");
    repo.recordAttempt(member.id, false);
    expect(repo.failedAttemptsSince(member.id, new Date(Date.now() - 60_000).toISOString())).toBe(1);

    db.prepare("INSERT INTO auth_attempts (member_id, created_at, success) VALUES (?,?,0)").run(
      member.id,
      new Date(Date.now() - 20 * 60_000).toISOString(),
    );
    expect(repo.failedAttemptsSince(member.id, new Date(Date.now() - 15 * 60_000).toISOString())).toBe(1);
  });
});
