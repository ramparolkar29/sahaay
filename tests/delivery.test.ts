import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "@/lib/db";
import { deliverQueuedMessages } from "@/lib/delivery";
import { Repository } from "@/lib/store";

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

function queue(circleId: string, dedupeKey: string) {
  return repo.enqueueMessage({
    circleId,
    toEmail: "family@example.com",
    subject: "Dose at 08:00",
    body: "Take Amlodipine",
    kind: "dose-upcoming",
    dedupeKey,
  });
}

function response(status: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) } as Response;
}

beforeEach(() => {
  db = createDatabase(":memory:");
  repo = new Repository(db);
  vi.stubEnv("FIRESTORE_PROJECT", "sahaay-test");
  vi.stubEnv("GOOGLE_OAUTH_TOKEN", "test-token");
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("deliverQueuedMessages", () => {
  it("no-ops without a Google Cloud project", async () => {
    vi.stubEnv("FIRESTORE_PROJECT", "");
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { circle } = makeCircle("Sharma family");
    queue(circle.id, "k1");

    await expect(deliverQueuedMessages(repo, circle.id)).resolves.toEqual({
      configured: false,
      delivered: 0,
      failed: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(repo.listOutbox(circle.id)[0].status).toBe("queued");
  });

  it("posts queued mail to Firestore and marks it sent", async () => {
    const fetchSpy = vi.fn(async () => response(200));
    vi.stubGlobal("fetch", fetchSpy);

    const { circle } = makeCircle("Sharma family");
    queue(circle.id, "k1");

    const result = await deliverQueuedMessages(repo, circle.id);
    expect(result).toEqual({ configured: true, delivered: 1, failed: 0 });

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("projects/sahaay-test/databases/(default)/documents/mail");
    expect(url).toContain("documentId=");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-token");
    expect(repo.listOutbox(circle.id)[0].status).toBe("sent");
  });

  it("treats a 409 conflict as already delivered", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(409)));

    const { circle } = makeCircle("Sharma family");
    queue(circle.id, "k1");

    await expect(deliverQueuedMessages(repo, circle.id)).resolves.toMatchObject({ delivered: 1, failed: 0 });
    expect(repo.listOutbox(circle.id)[0].status).toBe("sent");
  });

  it("counts a rejected write as failed and leaves the message queued", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(500)));

    const { circle } = makeCircle("Sharma family");
    queue(circle.id, "k1");

    await expect(deliverQueuedMessages(repo, circle.id)).resolves.toMatchObject({ delivered: 0, failed: 1 });
    expect(repo.listOutbox(circle.id)[0].status).toBe("queued");
  });

  it("survives a network error per message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("socket hang up");
      }),
    );

    const { circle } = makeCircle("Sharma family");
    queue(circle.id, "k1");

    await expect(deliverQueuedMessages(repo, circle.id)).resolves.toMatchObject({ delivered: 0, failed: 1 });
  });

  it("reports a missing access token instead of throwing", async () => {
    vi.stubEnv("GOOGLE_OAUTH_TOKEN", "");
    const fetchSpy = vi.fn(async () => response(403));
    vi.stubGlobal("fetch", fetchSpy);

    const { circle } = makeCircle("Sharma family");
    queue(circle.id, "k1");

    const result = await deliverQueuedMessages(repo, circle.id);
    expect(result).toEqual({
      configured: true,
      delivered: 0,
      failed: 0,
      reason: "Could not obtain a Google access token.",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("delivers across every circle when no circle is given", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(200)));

    const a = makeCircle("A family");
    const b = makeCircle("B family");
    queue(a.circle.id, "a-1");
    queue(b.circle.id, "b-1");

    await expect(deliverQueuedMessages(repo)).resolves.toMatchObject({ delivered: 2, failed: 0 });
    expect(repo.listOutbox(a.circle.id)[0].status).toBe("sent");
    expect(repo.listOutbox(b.circle.id)[0].status).toBe("sent");
  });
});
