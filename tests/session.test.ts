import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  options: null as Record<string, unknown> | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      state.jar.set(name, value);
      state.options = options;
    },
    delete: (name: string) => {
      state.jar.delete(name);
    },
  }),
}));

import { createSession, destroySession, readSession, SESSION_COOKIE } from "@/lib/auth";
import type { Member } from "@/lib/types";

const member: Member = {
  id: "member-1",
  circleId: "circle-1",
  name: "Kamla Sharma",
  role: "elder",
  phone: null,
  email: "kamla@example.com",
  isDemo: false,
  createdAt: new Date().toISOString(),
};

beforeAll(() => {
  process.env.SESSION_SECRET = `test-session-secret-${"x".repeat(24)}`;
});

beforeEach(() => {
  state.jar.clear();
  state.options = null;
});

describe("createSession", () => {
  it("stores an httpOnly, lax, site-wide cookie", async () => {
    await createSession(member);
    expect(state.jar.has(SESSION_COOKIE)).toBe(true);
    expect(state.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(Number(state.options?.maxAge)).toBeGreaterThan(0);
  });
});

describe("readSession", () => {
  it("round-trips the member identity", async () => {
    await createSession(member);
    await expect(readSession()).resolves.toMatchObject({
      memberId: "member-1",
      circleId: "circle-1",
      name: "Kamla Sharma",
      role: "elder",
    });
  });

  it("returns null without a cookie", async () => {
    await expect(readSession()).resolves.toBeNull();
  });

  it("rejects a tampered token", async () => {
    await createSession(member);
    const token = state.jar.get(SESSION_COOKIE)!;
    state.jar.set(SESSION_COOKIE, `${token.slice(0, -3)}abc`);
    await expect(readSession()).resolves.toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    await createSession(member);
    const goodSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = `rotated-session-secret-${"y".repeat(24)}`;
    try {
      await expect(readSession()).resolves.toBeNull();
    } finally {
      process.env.SESSION_SECRET = goodSecret;
    }
  });
});

describe("destroySession", () => {
  it("removes the cookie", async () => {
    await createSession(member);
    await destroySession();
    expect(state.jar.has(SESSION_COOKIE)).toBe(false);
  });
});
