import type { Repository } from "./store";

export interface DeliveryResult {
  configured: boolean;
  delivered: number;
  failed: number;
  reason?: string;
}

function projectId(): string | null {
  return process.env.FIRESTORE_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? null;
}

async function accessToken(): Promise<string | null> {
  if (process.env.GOOGLE_OAUTH_TOKEN) return process.env.GOOGLE_OAUTH_TOKEN;
  try {
    const response = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(1500) },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

function mailDocument(toEmail: string, subject: string, body: string, kind: string) {
  return {
    fields: {
      to: { stringValue: toEmail },
      sahaayKind: { stringValue: kind },
      message: {
        mapValue: {
          fields: {
            subject: { stringValue: subject },
            text: { stringValue: body },
          },
        },
      },
    },
  };
}

/**
 * Hands queued reminders to the Firestore `mail` collection used by the
 * Trigger Email extension. No-ops outside Google Cloud so the demo can run
 * offline with the local outbox only.
 */
export async function deliverQueuedMessages(repo: Repository, circleId?: string): Promise<DeliveryResult> {
  const project = projectId();
  if (!project) return { configured: false, delivered: 0, failed: 0 };

  const token = await accessToken();
  if (!token) {
    return { configured: true, delivered: 0, failed: 0, reason: "Could not obtain a Google access token." };
  }

  const circleIds = circleId ? [circleId] : repo.listCircleOverviews().map((circle) => circle.id);
  const endpoint = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/mail`;
  let delivered = 0;
  let failed = 0;

  for (const id of circleIds) {
    const queued = repo.listOutbox(id, 40).filter((message) => message.status === "queued");
    for (const message of queued) {
      try {
        const response = await fetch(`${endpoint}?documentId=${encodeURIComponent(message.id)}`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(mailDocument(message.toEmail, message.subject, message.body, message.kind)),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok || response.status === 409) {
          repo.markOutboxSent(id, message.id);
          delivered += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
  }

  return { configured: true, delivered, failed };
}
