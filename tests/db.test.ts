import { describe, expect, it } from "vitest";
import { compare } from "bcryptjs";
import { createDatabase, DEMO_PASSCODES, seedDemo } from "@/lib/db";
import { Repository } from "@/lib/store";

const count = (db: ReturnType<typeof createDatabase>, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

describe("createDatabase", () => {
  it("creates every table needed by the app", () => {
    const db = createDatabase(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String((row as { name: string }).name));

    for (const table of ["circles", "members", "medicines", "dose_logs", "appointments", "activity", "outbox", "auth_attempts"]) {
      expect(tables).toContain(table);
    }
  });
});

describe("seedDemo", () => {
  it("seeds one rich demo circle with a week of history", () => {
    const db = createDatabase(":memory:");
    seedDemo(db, new Date("2026-11-15T02:00:00Z"));

    expect(count(db, "circles")).toBe(1);
    expect(count(db, "members")).toBe(3);
    expect(count(db, "medicines")).toBe(4);
    expect(count(db, "appointments")).toBe(3);
    expect(count(db, "activity")).toBe(4);
    expect(count(db, "dose_logs")).toBeGreaterThan(10);
  });

  it("stores usable passcodes for every demo profile", async () => {
    const db = createDatabase(":memory:");
    seedDemo(db, new Date("2026-11-15T02:00:00Z"));
    const rows = db
      .prepare("SELECT id, passcode_hash FROM members ORDER BY id")
      .all() as Array<{ id: string; passcode_hash: string }>;
    const byId = new Map(rows.map((row) => [row.id, row.passcode_hash]));

    expect(await compare(DEMO_PASSCODES.elder, byId.get("demo-kamla")!)).toBe(true);
    expect(await compare(DEMO_PASSCODES.caretaker, byId.get("demo-anil")!)).toBe(true);
    expect(await compare(DEMO_PASSCODES.family, byId.get("demo-priya")!)).toBe(true);
  });

  it("never seeds twice into the same database", () => {
    const db = createDatabase(":memory:");
    seedDemo(db, new Date("2026-11-15T02:00:00Z"));
    const before = count(db, "dose_logs");
    seedDemo(db, new Date("2026-11-16T02:00:00Z"));
    expect(count(db, "circles")).toBe(1);
    expect(count(db, "dose_logs")).toBe(before);
  });
});

describe("activity trail", () => {
  it("lists entries newest first with the member name attached", async () => {
    const db = createDatabase(":memory:");
    const repo = new Repository(db);
    const { circle, member } = repo.createCircle({
      name: "Test family",
      elderName: "Test elder",
      timezone: "Asia/Kolkata",
      reminderLeadMinutes: 30,
      missedGraceMinutes: 90,
      member: { name: "Asha Rao", passcodeHash: "$2a$10$notarealhash", email: "asha@example.com" },
    });

    repo.addActivity(circle.id, member.id, "medicine", "Added Metformin");
    await new Promise((resolve) => setTimeout(resolve, 5));
    repo.addActivity(circle.id, member.id, "dose", "Marked morning dose taken");

    const entries = repo.listActivity(circle.id);
    expect(entries).toHaveLength(2);
    expect(entries[0].message).toBe("Marked morning dose taken");
    expect(entries[0].memberName).toBe("Asha Rao");
    expect(repo.listActivity(circle.id, 1)).toHaveLength(1);
  });
});
