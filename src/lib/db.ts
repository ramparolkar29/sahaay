import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashSync } from "bcryptjs";
import { addDays, zonedMoment, minutesToTime } from "./time";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS circles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  elder_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  invite_code TEXT NOT NULL UNIQUE,
  reminder_lead_minutes INTEGER NOT NULL DEFAULT 30,
  missed_grace_minutes INTEGER NOT NULL DEFAULT 90,
  blood_group TEXT,
  allergies TEXT,
  conditions TEXT,
  emergency_contact TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('elder', 'caretaker', 'family')),
  passcode_hash TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  form TEXT NOT NULL DEFAULT 'tablet',
  instructions TEXT,
  times TEXT NOT NULL,
  days TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dose_logs (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  slot_date TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('taken', 'skipped')),
  note TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (medicine_id, slot_date, slot_time)
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doctor TEXT,
  location TEXT,
  starts_at TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_members_circle ON members(circle_id);
CREATE INDEX IF NOT EXISTS idx_medicines_circle ON medicines(circle_id, active);
CREATE INDEX IF NOT EXISTS idx_dose_circle_date ON dose_logs(circle_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_appt_circle_start ON appointments(circle_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_activity_circle ON activity(circle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_circle ON outbox(circle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_member ON auth_attempts(member_id, created_at);
`;

export function createDatabase(filename: string): DatabaseSync {
  if (filename !== ":memory:") mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(SCHEMA);
  return db;
}

export const DEMO_PASSCODES = { elder: "1234", caretaker: "2580", family: "1990" } as const;

export function seedDemo(db: DatabaseSync, now = new Date()): void {
  const existing = db.prepare("SELECT COUNT(*) AS c FROM circles").get() as { c: number };
  if (existing.c > 0) return;

  const tz = "Asia/Kolkata";
  const today = zonedMoment(now, tz).date;
  const nowMinutes = zonedMoment(now, tz).minutes;
  const iso = now.toISOString();
  const at = (dateKey: string, time: string) => new Date(`${dateKey}T${time}:00+05:30`).toISOString();

  db.prepare(
    `INSERT INTO circles (id, name, elder_name, timezone, invite_code, reminder_lead_minutes, missed_grace_minutes,
      blood_group, allergies, conditions, emergency_contact, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    "demo-sharma",
    "Sharma family",
    "Kamla Sharma",
    tz,
    "SHARMA",
    30,
    90,
    "B+",
    "Penicillin",
    "Hypertension, Type 2 diabetes",
    "Anil Sharma · +91 98765 43210",
    iso,
  );

  const members: Array<[string, string, string, string, string | null, number]> = [
    ["demo-kamla", "Kamla Sharma", "elder", DEMO_PASSCODES.elder, "kamla@example.com", 1],
    ["demo-anil", "Anil Sharma", "caretaker", DEMO_PASSCODES.caretaker, "anil@example.com", 1],
    ["demo-priya", "Priya Sharma", "family", DEMO_PASSCODES.family, "priya@example.com", 1],
  ];
  const insertMember = db.prepare(
    `INSERT INTO members (id, circle_id, name, role, passcode_hash, phone, email, is_demo, created_at)
     VALUES (?, 'demo-sharma', ?, ?, ?, NULL, ?, ?, ?)`,
  );
  for (const [id, name, role, code, email, isDemo] of members) {
    insertMember.run(id, name, role, hashSync(code, 10), email, isDemo, iso);
  }

  const meds: Array<[string, string, string, string, string | null, string[], number[], string]> = [
    ["demo-med-1", "Amlodipine", "5 mg", "tablet", "After breakfast", ["08:00"], [], addDays(today, -40)],
    ["demo-med-2", "Metformin", "500 mg", "tablet", "With meals", ["08:00", "20:00"], [], addDays(today, -180)],
    ["demo-med-3", "Vitamin D3", "1000 IU", "capsule", "After breakfast", ["09:00"], [1, 3, 5], addDays(today, -90)],
    ["demo-med-4", "Atorvastatin", "10 mg", "tablet", "Before bed", ["21:30"], [], addDays(today, -60)],
  ];
  const insertMed = db.prepare(
    `INSERT INTO medicines (id, circle_id, name, dosage, form, instructions, times, days, start_date, end_date, active, created_by, created_at)
     VALUES (?, 'demo-sharma', ?, ?, ?, ?, ?, ?, ?, NULL, 1, 'demo-anil', ?)`,
  );
  for (const [id, name, dosage, form, instructions, times, days, start] of meds) {
    insertMed.run(id, name, dosage, form, instructions, JSON.stringify(times), JSON.stringify(days), start, iso);
  }

  const insertDose = db.prepare(
    `INSERT INTO dose_logs (id, circle_id, medicine_id, slot_date, slot_time, status, note, recorded_by, recorded_at)
     VALUES (?, 'demo-sharma', ?, ?, ?, ?, NULL, ?, ?)`,
  );
  const recorders = ["demo-anil", "demo-priya", "demo-kamla"];
  let counter = 0;
  for (let offset = -7; offset <= 0; offset += 1) {
    const dateKey = addDays(today, offset);
    const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
    meds.forEach(([medId, , , , , times, days], medIndex) => {
      if (days.length > 0 && !days.includes(weekday)) return;
      times.forEach((time, slotIndex) => {
        const [h, m] = time.split(":").map(Number);
        const slotMinutes = h * 60 + m;
        // Only log doses that have already happened.
        if (offset === 0 && slotMinutes > nowMinutes - 5) return;
        counter += 1;
        const missed = (offset + medIndex + slotIndex + 14) % 9 === 0;
        insertDose.run(
          `demo-dose-${counter}`,
          medId,
          dateKey,
          time,
          missed ? "skipped" : "taken",
          recorders[counter % recorders.length],
          at(dateKey, minutesToTime(slotMinutes + 6)),
        );
      });
    });
  }

  const insertAppt = db.prepare(
    `INSERT INTO appointments (id, circle_id, title, doctor, location, starts_at, notes, created_by, created_at)
     VALUES (?, 'demo-sharma', ?, ?, ?, ?, ?, 'demo-priya', ?)`,
  );
  insertAppt.run(
    "demo-appt-1",
    "Cardiology review",
    "Dr. Meera Mehta",
    "Apollo Clinic, Sector 12",
    at(today, "17:00"),
    "Carry the BP diary and latest lipid profile.",
    iso,
  );
  insertAppt.run(
    "demo-appt-2",
    "Eye check-up",
    "Dr. Rao",
    "Vision Care Centre",
    at(addDays(today, 4), "16:30"),
    "Bring old spectacles for comparison.",
    iso,
  );
  insertAppt.run(
    "demo-appt-3",
    "Blood test (fasting)",
    "Healthians lab",
    "Home visit",
    at(addDays(today, -3), "07:30"),
    "Fasting from 10 pm the previous night.",
    iso,
  );

  const insertActivity = db.prepare(
    `INSERT INTO activity (id, circle_id, member_id, kind, message, created_at)
     VALUES (?, 'demo-sharma', ?, ?, ?, ?)`,
  );
  insertActivity.run("demo-act-1", "demo-priya", "appointment", "Added a cardiology review with Dr. Meera Mehta", at(today, "09:12"));
  insertActivity.run("demo-act-2", "demo-anil", "medicine", "Updated Metformin to twice a day", at(addDays(today, -1), "18:40"));
  insertActivity.run("demo-act-3", "demo-kamla", "dose", "Marked morning Metformin as taken", at(today, "08:07"));
  insertActivity.run("demo-act-4", "demo-priya", "member", "Joined the care circle", at(addDays(today, -2), "20:15"));
}

let cached: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (cached) return cached;
  const globalCache = globalThis as typeof globalThis & { __sahaayDb?: DatabaseSync };
  if (globalCache.__sahaayDb) {
    cached = globalCache.__sahaayDb;
    return cached;
  }
  const file =
    process.env.SAHAY_DB_PATH ??
    (process.env.VERCEL ? path.join("/tmp", "sahaay.db") : path.join(process.cwd(), "data", "sahaay.db"));
  const db = createDatabase(file);
  seedDemo(db);
  globalCache.__sahaayDb = db;
  cached = db;
  return db;
}

/** Dev-only fallback secret so restarts keep sessions; production must supply SESSION_SECRET. */
export function sessionSecret(): Uint8Array {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return new TextEncoder().encode(fromEnv);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (32+ characters) is required in production");
  }
  const file = path.join(process.cwd(), "data", ".session-secret");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    const generated = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    writeFileSync(file, generated, { mode: 0o600 });
    return new TextEncoder().encode(generated);
  }
  return new TextEncoder().encode(readFileSync(file, "utf8"));
}
