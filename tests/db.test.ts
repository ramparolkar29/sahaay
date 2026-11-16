import { describe, expect, it } from "vitest";
import { compare } from "bcryptjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDatabase, DEMO_PASSCODES, seedDemo, sessionSecret } from "@/lib/db";
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

describe("sessionSecret", () => {
  async function withSecret(env: { nodeEnv: string; secret: string }, run: () => void) {
    const { vi } = await import("vitest");
    const dir = mkdtempSync(path.join(tmpdir(), "sahaay-secret-"));
    vi.stubEnv("NODE_ENV", env.nodeEnv);
    vi.stubEnv("SESSION_SECRET", env.secret);
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    try {
      run();
    } finally {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
    const file = path.join(dir, "data", ".session-secret");
    const created = (() => {
      try {
        return readFileSync(file, "utf8");
      } catch {
        return null;
      }
    })();
    rmSync(dir, { recursive: true, force: true });
    return created;
  }

  it("requires a 32 character secret in production", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "too-short");
    expect(() => sessionSecret()).toThrow(/SESSION_SECRET/);
    vi.unstubAllEnvs();
  });

  it("uses a configured secret as UTF-8 bytes", async () => {
    const secret = "s".repeat(32);
    const { vi } = await import("vitest");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", secret);
    expect(new TextDecoder().decode(sessionSecret())).toBe(secret);
    vi.unstubAllEnvs();
  });

  it("generates a dev secret file and reuses it across restarts", async () => {
    const file = await withSecret({ nodeEnv: "development", secret: "" }, () => {
      const first = new TextDecoder().decode(sessionSecret());
      expect(first).toMatch(/^[0-9a-f]{64}$/);
      expect(new TextDecoder().decode(sessionSecret())).toBe(first);
    });
    expect(file).toMatch(/^[0-9a-f]{64}$/);
  });
});
