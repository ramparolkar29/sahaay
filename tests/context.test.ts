import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  redirects: [] as string[],
  member: null as null | { id: string; circleId: string; name: string; role: string },
  circle: null as null | { id: string; name: string },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    set: (name: string, value: string) => state.jar.set(name, value),
    delete: (name: string) => state.jar.delete(name),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    state.redirects.push(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/store", () => ({
  getRepo: () => ({
    getMember: (id: string) => (state.member && state.member.id === id ? state.member : null),
    getCircle: (id: string) => (state.circle && state.circle.id === id ? state.circle : null),
  }),
}));

import { createSession, requireContext, SESSION_COOKIE } from "@/lib/auth";
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

beforeEach(() => {
  process.env.SESSION_SECRET = `context-session-secret-${"x".repeat(24)}`;
  state.jar.clear();
  state.redirects = [];
  state.member = { id: "member-1", circleId: "circle-1", name: "Kamla Sharma", role: "elder" };
  state.circle = { id: "circle-1", name: "Sharma family" };
});

describe("requireContext", () => {
  it("redirects to the landing page without a session", async () => {
    await expect(requireContext()).rejects.toThrow("REDIRECT:/");
    expect(state.redirects).toEqual(["/"]);
  });

  it("returns the member and circle for a valid session", async () => {
    await createSession(member);
    await expect(requireContext()).resolves.toMatchObject({
      session: { memberId: "member-1", circleId: "circle-1" },
      member: { name: "Kamla Sharma" },
      circle: { name: "Sharma family" },
    });
  });

  it("clears the cookie and redirects when the member no longer exists", async () => {
    await createSession(member);
    state.member = null;
    await expect(requireContext()).rejects.toThrow("REDIRECT:/");
    expect(state.jar.has(SESSION_COOKIE)).toBe(false);
  });

  it("redirects when the member and circle disagree", async () => {
    await createSession(member);
    state.member = { id: "member-1", circleId: "circle-2", name: "Kamla Sharma", role: "elder" };
    await expect(requireContext()).rejects.toThrow("REDIRECT:/");
    expect(state.redirects).toEqual(["/"]);
  });
});
