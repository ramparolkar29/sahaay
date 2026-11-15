import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { compare } from "bcryptjs";

const state = vi.hoisted(() => ({ repo: null as import("@/lib/store").Repository | null }));

vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  return { ...actual, getRepo: () => state.repo! };
});

import { createDatabase } from "@/lib/db";
import { Repository } from "@/lib/store";
import { attemptLogin, hashPasscode } from "@/lib/auth";

const ids = { elder: "", bad: "", shape: "", lock: "" };

beforeAll(async () => {
  const db: DatabaseSync = createDatabase(":memory:");
  const repo = new Repository(db);
  state.repo = repo;

  const { circle, member } = repo.createCircle({
    name: "Sharma family",
    elderName: "Kamla Sharma",
    timezone: "Asia/Kolkata",
    reminderLeadMinutes: 30,
    missedGraceMinutes: 90,
    member: { name: "Kamla Sharma", passcodeHash: await hashPasscode("4321"), email: "kamla@example.com" },
  });
  ids.elder = member.id;

  for (const [key, name, code] of [
    ["bad", "Bad Tries", "4321"],
    ["shape", "Shape Tries", "4321"],
    ["lock", "Locked Out", "1111"],
  ] as const) {
    ids[key] = repo.addMember({
      circleId: circle.id,
      name,
      role: "family",
      passcodeHash: await hashPasscode(code),
      email: `${key}@example.com`,
      phone: null,
    }).id;
  }
});

describe("hashPasscode", () => {
  it("stores a bcrypt hash, never the plaintext", async () => {
    const hash = await hashPasscode("2580");
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash).not.toContain("2580");
    expect(await compare("2580", hash)).toBe(true);
    expect(await compare("2581", hash)).toBe(false);
  });

  it("salts each hash so equal passcodes differ", async () => {
    expect(await hashPasscode("2580")).not.toBe(await hashPasscode("2580"));
  });
});

describe("attemptLogin", () => {
  it("accepts the correct passcode and returns the member", async () => {
    const result = await attemptLogin(ids.elder, "4321");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.member.name).toBe("Kamla Sharma");
  });

  it("reports remaining attempts after a wrong passcode", async () => {
    const first = await attemptLogin(ids.bad, "9999");
    expect(first).toEqual({ ok: false, error: "Incorrect passcode. 4 attempts left." });

    const second = await attemptLogin(ids.bad, "8888");
    expect(second).toEqual({ ok: false, error: "Incorrect passcode. 3 attempts left." });
  });

  it("treats a non-digit passcode as a failed attempt", async () => {
    const result = await attemptLogin(ids.shape, "12ab");
    expect(result).toEqual({ ok: false, error: "Incorrect passcode. 4 attempts left." });
  });

  it("locks the profile for 15 minutes after five failures", async () => {
    let last = await attemptLogin(ids.lock, "0000");
    for (let i = 1; i < 5; i += 1) last = await attemptLogin(ids.lock, "0000");
    expect(last).toEqual({ ok: false, error: "Too many attempts. Please wait 15 minutes." });

    const correct = await attemptLogin(ids.lock, "1111");
    expect(correct).toEqual({ ok: false, error: "Too many attempts. Try again in 15 minutes." });
  });

  it("rejects an unknown member id", async () => {
    const result = await attemptLogin("does-not-exist", "1234");
    expect(result).toEqual({ ok: false, error: "That profile is no longer available." });
  });
});
