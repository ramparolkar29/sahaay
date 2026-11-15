import { afterEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "@/lib/db";
import { Repository } from "@/lib/store";
import { deliverQueuedMessages } from "@/lib/delivery";

function setup() {
  const repo = new Repository(createDatabase(":memory:"));
  const { circle, member } = repo.createCircle({
    name: "Sharma family",
    elderName: "Kamla Sharma",
    timezone: "Asia/Kolkata",
    reminderLeadMinutes: 30,
    missedGraceMinutes: 90,
    member: { name: "Kamla Sharma", passcodeHash: "h", email: "kamla@example.com" },
  });
  repo.enqueueMessage({
    circleId: circle.id,
    toEmail: "anil@example.com",
    subject: "Today · Cardiology review",
    body: "Hi Anil",
    kind: "appointment",
    dedupeKey: `${circle.id}|appointment|appt-1|24h`,
  });
  return { repo, circle, member };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("deliverQueuedMessages", () => {
  it("is a no-op when no Google Cloud project is configured", async () => {
    vi.stubEnv("FIRESTORE_PROJECT", "");
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    const { repo, circle } = setup();

    const result = await deliverQueuedMessages(repo, circle.id);
    expect(result).toEqual({ configured: false, delivered: 0, failed: 0 });
    expect(repo.listOutbox(circle.id)[0].status).toBe("queued");
  });

  it("writes each queued message to the Firestore mail collection", async () => {
    vi.stubEnv("FIRESTORE_PROJECT", "sahaay-demo");
    vi.stubEnv("GOOGLE_OAUTH_TOKEN", "test-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { repo, circle } = setup();

    const result = await deliverQueuedMessages(repo, circle.id);

    expect(result).toEqual({ configured: true, delivered: 1, failed: 0 });
    expect(repo.listOutbox(circle.id)[0].status).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/projects/sahaay-demo/databases/(default)/documents/mail?documentId=");
    expect(init.headers.authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body);
    expect(body.fields.to.stringValue).toBe("anil@example.com");
    expect(body.fields.message.mapValue.fields.subject.stringValue).toBe("Today · Cardiology review");
  });

  it("keeps a message queued when Firestore rejects it", async () => {
    vi.stubEnv("FIRESTORE_PROJECT", "sahaay-demo");
    vi.stubEnv("GOOGLE_OAUTH_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    const { repo, circle } = setup();

    const result = await deliverQueuedMessages(repo, circle.id);
    expect(result).toEqual({ configured: true, delivered: 0, failed: 1 });
    expect(repo.listOutbox(circle.id)[0].status).toBe("queued");
  });
});
