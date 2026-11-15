import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { getDatabase } from "./db";
import type {
  ActivityEntry,
  Appointment,
  Circle,
  DoseLog,
  Medicine,
  Member,
  OutboxMessage,
  Role,
} from "./types";

type Row = Record<string, unknown>;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function inviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function toCircle(row: Row): Circle {
  return {
    id: String(row.id),
    name: String(row.name),
    elderName: String(row.elder_name),
    timezone: String(row.timezone),
    inviteCode: String(row.invite_code),
    reminderLeadMinutes: Number(row.reminder_lead_minutes),
    missedGraceMinutes: Number(row.missed_grace_minutes),
    bloodGroup: row.blood_group == null ? null : String(row.blood_group),
    allergies: row.allergies == null ? null : String(row.allergies),
    conditions: row.conditions == null ? null : String(row.conditions),
    emergencyContact: row.emergency_contact == null ? null : String(row.emergency_contact),
    createdAt: String(row.created_at),
  };
}

function toMember(row: Row): Member {
  return {
    id: String(row.id),
    circleId: String(row.circle_id),
    name: String(row.name),
    role: String(row.role) as Role,
    phone: row.phone == null ? null : String(row.phone),
    email: row.email == null ? null : String(row.email),
    isDemo: Number(row.is_demo) === 1,
    createdAt: String(row.created_at),
  };
}

function toMedicine(row: Row): Medicine {
  return {
    id: String(row.id),
    circleId: String(row.circle_id),
    name: String(row.name),
    dosage: String(row.dosage),
    form: String(row.form),
    instructions: row.instructions == null ? null : String(row.instructions),
    times: JSON.parse(String(row.times)) as string[],
    days: JSON.parse(String(row.days)) as number[],
    startDate: String(row.start_date),
    endDate: row.end_date == null ? null : String(row.end_date),
    active: Number(row.active) === 1,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

function toDoseLog(row: Row): DoseLog {
  return {
    id: String(row.id),
    circleId: String(row.circle_id),
    medicineId: String(row.medicine_id),
    slotDate: String(row.slot_date),
    slotTime: String(row.slot_time),
    status: String(row.status) as DoseLog["status"],
    note: row.note == null ? null : String(row.note),
    recordedBy: String(row.recorded_by),
    recordedAt: String(row.recorded_at),
  };
}

function toAppointment(row: Row): Appointment {
  return {
    id: String(row.id),
    circleId: String(row.circle_id),
    title: String(row.title),
    doctor: row.doctor == null ? null : String(row.doctor),
    location: row.location == null ? null : String(row.location),
    startsAt: String(row.starts_at),
    notes: row.notes == null ? null : String(row.notes),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

function toOutbox(row: Row): OutboxMessage {
  return {
    id: String(row.id),
    circleId: String(row.circle_id),
    toEmail: String(row.to_email),
    subject: String(row.subject),
    body: String(row.body),
    kind: String(row.kind),
    status: String(row.status) as OutboxMessage["status"],
    dedupeKey: String(row.dedupe_key),
    createdAt: String(row.created_at),
    sentAt: row.sent_at == null ? null : String(row.sent_at),
  };
}

export interface NewMedicine {
  name: string;
  dosage: string;
  form: string;
  instructions: string | null;
  times: string[];
  days: number[];
  startDate: string;
  endDate: string | null;
}

export interface NewAppointment {
  title: string;
  doctor: string | null;
  location: string | null;
  startsAt: string;
  notes: string | null;
}

export class Repository {
  constructor(readonly db: DatabaseSync) {}

  /* ---------------- circles ---------------- */

  listCircleOverviews(): Array<Circle & { memberCount: number }> {
    const rows = this.db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM members m WHERE m.circle_id = c.id) AS member_count
         FROM circles c ORDER BY c.created_at ASC`,
      )
      .all() as Row[];
    return rows.map((row) => ({ ...toCircle(row), memberCount: Number(row.member_count) }));
  }

  getCircle(id: string): Circle | null {
    const row = this.db.prepare("SELECT * FROM circles WHERE id = ?").get(id) as Row | undefined;
    return row ? toCircle(row) : null;
  }

  findCircleByInviteCode(code: string): Circle | null {
    const row = this.db
      .prepare("SELECT * FROM circles WHERE upper(invite_code) = ?")
      .get(code.trim().toUpperCase()) as Row | undefined;
    return row ? toCircle(row) : null;
  }

  createCircle(input: {
    name: string;
    elderName: string;
    timezone: string;
    reminderLeadMinutes: number;
    missedGraceMinutes: number;
    bloodGroup?: string | null;
    member: { name: string; passcodeHash: string; email: string | null };
  }): { circle: Circle; member: Member } {
    const now = new Date().toISOString();
    const circleId = randomUUID();
    const memberId = randomUUID();
    let code = inviteCode();
    while (this.findCircleByInviteCode(code)) code = inviteCode();

    this.db
      .prepare(
        `INSERT INTO circles (id, name, elder_name, timezone, invite_code, reminder_lead_minutes,
          missed_grace_minutes, blood_group, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        circleId,
        input.name,
        input.elderName,
        input.timezone,
        code,
        input.reminderLeadMinutes,
        input.missedGraceMinutes,
        input.bloodGroup ?? null,
        now,
      );
    this.db
      .prepare(
        `INSERT INTO members (id, circle_id, name, role, passcode_hash, phone, email, is_demo, created_at)
         VALUES (?,?,?,'elder',?,NULL,?,0,?)`,
      )
      .run(memberId, circleId, input.member.name, input.member.passcodeHash, input.member.email, now);

    return {
      circle: this.getCircle(circleId)!,
      member: this.getMember(memberId)!,
    };
  }

  updateCircleMedical(
    circleId: string,
    patch: Partial<Pick<Circle, "bloodGroup" | "allergies" | "conditions" | "emergencyContact" | "reminderLeadMinutes" | "missedGraceMinutes" | "name">>,
  ): void {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const map: Array<[keyof typeof patch, string]> = [
      ["bloodGroup", "blood_group"],
      ["allergies", "allergies"],
      ["conditions", "conditions"],
      ["emergencyContact", "emergency_contact"],
      ["reminderLeadMinutes", "reminder_lead_minutes"],
      ["missedGraceMinutes", "missed_grace_minutes"],
      ["name", "name"],
    ];
    for (const [key, column] of map) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = ?`);
        values.push(patch[key] as string | number | null);
      }
    }
    if (fields.length === 0) return;
    values.push(circleId);
    this.db.prepare(`UPDATE circles SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  /* ---------------- members & auth ---------------- */

  getMember(id: string): Member | null {
    const row = this.db.prepare("SELECT * FROM members WHERE id = ?").get(id) as Row | undefined;
    return row ? toMember(row) : null;
  }

  getMemberSecret(id: string): { member: Member; passcodeHash: string } | null {
    const row = this.db.prepare("SELECT * FROM members WHERE id = ?").get(id) as Row | undefined;
    if (!row) return null;
    return { member: toMember(row), passcodeHash: String(row.passcode_hash) };
  }

  listMembers(circleId: string): Member[] {
    const rows = this.db
      .prepare("SELECT * FROM members WHERE circle_id = ? ORDER BY CASE role WHEN 'elder' THEN 0 WHEN 'caretaker' THEN 1 ELSE 2 END, created_at")
      .all(circleId) as Row[];
    return rows.map(toMember);
  }

  listMembersByCircle(): Map<string, Member[]> {
    const rows = this.db.prepare("SELECT * FROM members ORDER BY created_at").all() as Row[];
    const grouped = new Map<string, Member[]>();
    for (const row of rows) {
      const member = toMember(row);
      const list = grouped.get(member.circleId);
      if (list) list.push(member);
      else grouped.set(member.circleId, [member]);
    }
    return grouped;
  }

  addMember(input: {
    circleId: string;
    name: string;
    role: Role;
    passcodeHash: string;
    email: string | null;
    phone: string | null;
  }): Member {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO members (id, circle_id, name, role, passcode_hash, phone, email, is_demo, created_at)
         VALUES (?,?,?,?,?,?,?,0,?)`,
      )
      .run(id, input.circleId, input.name, input.role, input.passcodeHash, input.phone, input.email, new Date().toISOString());
    return this.getMember(id)!;
  }

  removeMember(circleId: string, memberId: string): boolean {
    const result = this.db
      .prepare("DELETE FROM members WHERE id = ? AND circle_id = ? AND role <> 'elder'")
      .run(memberId, circleId);
    return Number(result.changes) > 0;
  }

  recordAttempt(memberId: string, success: boolean): void {
    this.db
      .prepare("INSERT INTO auth_attempts (member_id, created_at, success) VALUES (?,?,?)")
      .run(memberId, new Date().toISOString(), success ? 1 : 0);
  }

  failedAttemptsSince(memberId: string, sinceIso: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS c FROM auth_attempts WHERE member_id = ? AND success = 0 AND created_at > ?")
      .get(memberId, sinceIso) as { c: number };
    return Number(row.c);
  }

  /* ---------------- medicines ---------------- */

  listMedicines(circleId: string, activeOnly = true): Medicine[] {
    const sql = activeOnly
      ? "SELECT * FROM medicines WHERE circle_id = ? AND active = 1 ORDER BY times, name"
      : "SELECT * FROM medicines WHERE circle_id = ? ORDER BY active DESC, times, name";
    return (this.db.prepare(sql).all(circleId) as Row[]).map(toMedicine);
  }

  getMedicine(circleId: string, id: string): Medicine | null {
    const row = this.db.prepare("SELECT * FROM medicines WHERE id = ? AND circle_id = ?").get(id, circleId) as Row | undefined;
    return row ? toMedicine(row) : null;
  }

  createMedicine(circleId: string, createdBy: string, input: NewMedicine): Medicine {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO medicines (id, circle_id, name, dosage, form, instructions, times, days, start_date, end_date, active, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      )
      .run(
        id,
        circleId,
        input.name,
        input.dosage,
        input.form,
        input.instructions,
        JSON.stringify(input.times.slice().sort()),
        JSON.stringify(input.days.slice().sort()),
        input.startDate,
        input.endDate,
        createdBy,
        new Date().toISOString(),
      );
    return this.getMedicine(circleId, id)!;
  }

  updateMedicine(circleId: string, id: string, input: NewMedicine): Medicine | null {
    const result = this.db
      .prepare(
        `UPDATE medicines SET name = ?, dosage = ?, form = ?, instructions = ?, times = ?, days = ?,
           start_date = ?, end_date = ? WHERE id = ? AND circle_id = ?`,
      )
      .run(
        input.name,
        input.dosage,
        input.form,
        input.instructions,
        JSON.stringify(input.times.slice().sort()),
        JSON.stringify(input.days.slice().sort()),
        input.startDate,
        input.endDate,
        id,
        circleId,
      );
    if (Number(result.changes) === 0) return null;
    return this.getMedicine(circleId, id);
  }

  setMedicineActive(circleId: string, id: string, active: boolean): boolean {
    const result = this.db
      .prepare("UPDATE medicines SET active = ? WHERE id = ? AND circle_id = ?")
      .run(active ? 1 : 0, id, circleId);
    return Number(result.changes) > 0;
  }

  deleteMedicine(circleId: string, id: string): boolean {
    const result = this.db.prepare("DELETE FROM medicines WHERE id = ? AND circle_id = ?").run(id, circleId);
    return Number(result.changes) > 0;
  }

  /* ---------------- dose logs ---------------- */

  listDoseLogs(circleId: string, fromDate: string, toDate: string): DoseLog[] {
    return (
      this.db
        .prepare("SELECT * FROM dose_logs WHERE circle_id = ? AND slot_date BETWEEN ? AND ? ORDER BY slot_date, slot_time")
        .all(circleId, fromDate, toDate) as Row[]
    ).map(toDoseLog);
  }

  getDoseLog(circleId: string, medicineId: string, slotDate: string, slotTime: string): DoseLog | null {
    const row = this.db
      .prepare("SELECT * FROM dose_logs WHERE circle_id = ? AND medicine_id = ? AND slot_date = ? AND slot_time = ?")
      .get(circleId, medicineId, slotDate, slotTime) as Row | undefined;
    return row ? toDoseLog(row) : null;
  }

  recordDose(input: {
    circleId: string;
    medicineId: string;
    slotDate: string;
    slotTime: string;
    status: "taken" | "skipped";
    recordedBy: string;
  }): DoseLog {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO dose_logs (id, circle_id, medicine_id, slot_date, slot_time, status, note, recorded_by, recorded_at)
         VALUES (?,?,?,?,?,?,NULL,?,?)
         ON CONFLICT(medicine_id, slot_date, slot_time)
         DO UPDATE SET status = excluded.status, recorded_by = excluded.recorded_by, recorded_at = excluded.recorded_at`,
      )
      .run(
        id,
        input.circleId,
        input.medicineId,
        input.slotDate,
        input.slotTime,
        input.status,
        input.recordedBy,
        new Date().toISOString(),
      );
    return this.getDoseLog(input.circleId, input.medicineId, input.slotDate, input.slotTime)!;
  }

  clearDose(circleId: string, medicineId: string, slotDate: string, slotTime: string): void {
    this.db
      .prepare("DELETE FROM dose_logs WHERE circle_id = ? AND medicine_id = ? AND slot_date = ? AND slot_time = ?")
      .run(circleId, medicineId, slotDate, slotTime);
  }

  /* ---------------- appointments ---------------- */

  listAppointments(circleId: string): Appointment[] {
    return (
      this.db
        .prepare("SELECT * FROM appointments WHERE circle_id = ? ORDER BY starts_at ASC")
        .all(circleId) as Row[]
    ).map(toAppointment);
  }

  getAppointment(circleId: string, id: string): Appointment | null {
    const row = this.db
      .prepare("SELECT * FROM appointments WHERE id = ? AND circle_id = ?")
      .get(id, circleId) as Row | undefined;
    return row ? toAppointment(row) : null;
  }

  createAppointment(circleId: string, createdBy: string, input: NewAppointment): Appointment {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO appointments (id, circle_id, title, doctor, location, starts_at, notes, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        circleId,
        input.title,
        input.doctor,
        input.location,
        input.startsAt,
        input.notes,
        createdBy,
        new Date().toISOString(),
      );
    return this.getAppointment(circleId, id)!;
  }

  deleteAppointment(circleId: string, id: string): boolean {
    const result = this.db.prepare("DELETE FROM appointments WHERE id = ? AND circle_id = ?").run(id, circleId);
    return Number(result.changes) > 0;
  }

  /* ---------------- activity ---------------- */

  addActivity(circleId: string, memberId: string, kind: string, message: string): void {
    this.db
      .prepare("INSERT INTO activity (id, circle_id, member_id, kind, message, created_at) VALUES (?,?,?,?,?,?)")
      .run(randomUUID(), circleId, memberId, kind, message, new Date().toISOString());
  }

  listActivity(circleId: string, limit = 40): ActivityEntry[] {
    const rows = this.db
      .prepare(
        `SELECT a.*, m.name AS member_name FROM activity a
         LEFT JOIN members m ON m.id = a.member_id
         WHERE a.circle_id = ? ORDER BY a.created_at DESC LIMIT ?`,
      )
      .all(circleId, limit) as Row[];
    return rows.map((row) => ({
      id: String(row.id),
      circleId: String(row.circle_id),
      memberId: String(row.member_id),
      memberName: row.member_name == null ? "Someone" : String(row.member_name),
      kind: String(row.kind),
      message: String(row.message),
      createdAt: String(row.created_at),
    }));
  }

  /* ---------------- outbox ---------------- */

  enqueueMessage(input: {
    circleId: string;
    toEmail: string;
    subject: string;
    body: string;
    kind: string;
    dedupeKey: string;
  }): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO outbox (id, circle_id, to_email, subject, body, kind, status, dedupe_key, created_at)
         VALUES (?,?,?,?,?,?,'queued',?,?)`,
      )
      .run(
        randomUUID(),
        input.circleId,
        input.toEmail,
        input.subject,
        input.body,
        input.kind,
        input.dedupeKey,
        new Date().toISOString(),
      );
    return Number(result.changes) > 0;
  }

  listOutbox(circleId: string, limit = 60): OutboxMessage[] {
    return (
      this.db
        .prepare("SELECT * FROM outbox WHERE circle_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(circleId, limit) as Row[]
    ).map(toOutbox);
  }

  markOutboxSent(circleId: string, id: string): boolean {
    const result = this.db
      .prepare("UPDATE outbox SET status = 'sent', sent_at = ? WHERE id = ? AND circle_id = ?")
      .run(new Date().toISOString(), id, circleId);
    return Number(result.changes) > 0;
  }

  clearOutbox(circleId: string): void {
    this.db.prepare("DELETE FROM outbox WHERE circle_id = ?").run(circleId);
  }
}

let repo: Repository | null = null;

export function getRepo(): Repository {
  if (!repo) repo = new Repository(getDatabase());
  return repo;
}
