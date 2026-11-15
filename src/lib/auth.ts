import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { sessionSecret } from "./db";
import { getRepo } from "./store";
import type { Circle, Member, SessionPayload } from "./types";

export const SESSION_COOKIE = "sahaay_session";
const SESSION_SECONDS = 60 * 60 * 12;
const LOCK_WINDOW_MINUTES = 15;
const MAX_FAILURES = 5;

export async function hashPasscode(passcode: string): Promise<string> {
  return hash(passcode, 10);
}

export type LoginResult = { ok: true; member: Member } | { ok: false; error: string };

export async function attemptLogin(memberId: string, passcode: string): Promise<LoginResult> {
  const repo = getRepo();
  const secret = repo.getMemberSecret(memberId);
  if (!secret) return { ok: false, error: "That profile is no longer available." };

  const since = new Date(Date.now() - LOCK_WINDOW_MINUTES * 60_000).toISOString();
  const failures = repo.failedAttemptsSince(memberId, since);
  if (failures >= MAX_FAILURES) {
    return { ok: false, error: `Too many attempts. Try again in ${LOCK_WINDOW_MINUTES} minutes.` };
  }

  const shapeOk = /^\d{4,8}$/.test(passcode);
  const valid = shapeOk && (await compare(passcode, secret.passcodeHash));
  repo.recordAttempt(memberId, valid);

  if (!valid) {
    const left = MAX_FAILURES - failures - 1;
    return {
      ok: false,
      error: left > 0 ? `Incorrect passcode. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many attempts. Please wait 15 minutes.",
    };
  }
  return { ok: true, member: secret.member };
}

export async function createSession(member: Member): Promise<void> {
  const payload: SessionPayload = {
    memberId: member.id,
    circleId: member.circleId,
    name: member.name,
    role: member.role,
  };
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(sessionSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (typeof payload.memberId !== "string" || typeof payload.circleId !== "string") return null;
    return {
      memberId: payload.memberId,
      circleId: payload.circleId,
      name: String(payload.name ?? ""),
      role: payload.role as SessionPayload["role"],
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export interface AppContext {
  session: SessionPayload;
  member: Member;
  circle: Circle;
}

export async function requireContext(): Promise<AppContext> {
  const session = await readSession();
  if (!session) redirect("/");
  const repo = getRepo();
  const member = repo.getMember(session.memberId);
  const circle = repo.getCircle(session.circleId);
  if (!member || !circle || member.circleId !== circle.id) {
    await destroySession();
    redirect("/");
  }
  return { session, member, circle };
}

/** Per-request memoised context so layout and page share one lookup. */
export const currentContext = cache(requireContext);
