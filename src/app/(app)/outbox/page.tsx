import Link from "next/link";
import { clearOutboxAction, markSentAction, runScanAction } from "@/app/actions";
import { DangerButton } from "@/components/DangerButton";
import { Icon } from "@/components/Icon";
import { ReminderSettingsForm } from "@/components/ReminderSettingsForm";
import { SubmitButton } from "@/components/SubmitButton";
import { currentContext } from "@/lib/auth";
import { getRepo } from "@/lib/store";
import { formatInZone } from "@/lib/time";

export const metadata = { title: "Reminders" };

const KIND_LABEL: Record<string, string> = {
  "dose-upcoming": "Upcoming dose",
  "dose-missed": "Missed dose",
  escalation: "Escalation",
  appointment: "Appointment",
};

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ ran?: string; queued?: string; dupes?: string }>;
}) {
  const { circle } = await currentContext();
  const { ran, queued, dupes } = await searchParams;
  const repo = getRepo();
  const messages = repo.listOutbox(circle.id, 40);
  const recipients = repo.listMembers(circle.id).filter((person) => person.email && person.role !== "elder");
  const pending = messages.filter((message) => message.status === "queued").length;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 6 }}>
          <p className="eyebrow">Email reminders</p>
          <h1 className="h1">Reminder outbox</h1>
          <p className="muted">
            Every alert is built from the live schedule, de-duplicated, and handed to email delivery.
          </p>
        </div>
        <form action={runScanAction}>
          <SubmitButton className="btn btn-primary" pendingLabel="Scanning…">
            <Icon name="refresh" size={17} />
            Run reminder scan
          </SubmitButton>
        </form>
      </div>

      {ran ? (
        <div className="banner banner-info" role="status">
          <Icon name="mail" size={18} />
          <div>
            {Number(queued) > 0 ? (
              <>
                <strong>{queued} new reminder{Number(queued) === 1 ? "" : "s"} queued.</strong>{" "}
                {Number(dupes) > 0 ? `${dupes} already sent or queued were skipped.` : "No duplicates found."}
              </>
            ) : (
              <>
                <strong>Nothing new to send.</strong>{" "}
                {Number(dupes) > 0 ? `${dupes} existing reminder${Number(dupes) === 1 ? "" : "s"} already cover this window.` : "Everything is on schedule."}
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="dashboard-grid">
        <div className="stack" style={{ gap: 18 }}>
          <section className="card" aria-labelledby="outbox-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="outbox-title">Queue</h2>
                <p className="card-sub">
                  {messages.length} message{messages.length === 1 ? "" : "s"} · {pending} waiting to send
                </p>
              </div>
              <span className={`pill ${pending > 0 ? "pill-due" : "pill-taken"}`}>{pending > 0 ? "Pending" : "Clear"}</span>
            </div>

            {messages.length === 0 ? (
              <div className="empty">
                <Icon name="mail" size={26} />
                <p>No reminders yet.</p>
                <p className="small">
                  Run a scan to generate upcoming-dose, missed-dose and appointment emails from today&apos;s schedule.
                </p>
              </div>
            ) : (
              <ul className="stack">
                {messages.map((message) => (
                  <li key={message.id} className="mail">
                    <div className="mail-head">
                      <div>
                        <p className="strong small">{message.subject}</p>
                        <p className="tiny muted">To {message.toEmail}</p>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <span className={`pill ${message.status === "sent" ? "pill-taken" : "pill-due"}`}>
                          {message.status === "sent" ? "Sent" : "Queued"}
                        </span>
                        <span className="pill">{KIND_LABEL[message.kind] ?? message.kind}</span>
                      </div>
                    </div>
                    <div className="mail-body">{message.body}</div>
                    <div className="row-between" style={{ padding: "0 16px 14px" }}>
                      <span className="tiny muted">
                        {message.sentAt
                          ? `Sent ${formatInZone(new Date(message.sentAt), circle.timezone)}`
                          : `Queued ${formatInZone(new Date(message.createdAt), circle.timezone)}`}
                      </span>
                      {message.status === "queued" ? (
                        <form action={markSentAction}>
                          <input type="hidden" name="messageId" value={message.id} />
                          <SubmitButton className="btn btn-sm btn-teal" pendingLabel="…">
                            Mark as sent
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card" aria-labelledby="settings-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="settings-title">Alert settings</h2>
                <p className="card-sub">Tuned for {circle.elderName}</p>
              </div>
            </div>
            <ReminderSettingsForm lead={circle.reminderLeadMinutes} grace={circle.missedGraceMinutes} />
          </section>

          <section className="card" aria-labelledby="recipients-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="recipients-title">Recipients</h2>
                <p className="card-sub">{recipients.length} email{recipients.length === 1 ? "" : "s"} on file</p>
              </div>
              <Link href="/team" className="btn btn-sm btn-quiet">Edit</Link>
            </div>
            {recipients.length === 0 ? (
              <p className="small muted">
                No family email yet, so reminders cannot leave the app. Add an email from the Care team page.
              </p>
            ) : (
              <ul className="stack-sm">
                {recipients.map((person) => (
                  <li key={person.id} className="row-between small">
                    <span>{person.name}</span>
                    <span className="muted">{person.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="delivery-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="delivery-title">How delivery works</h2>
              </div>
            </div>
            <ol className="stack-sm small muted" style={{ paddingLeft: 18, listStyle: "decimal" }}>
              <li>Cloud Scheduler calls <code className="tiny">/api/cron/reminders</code> every 15 minutes with a bearer secret.</li>
              <li>The scan reads the live schedule and writes each new email to this outbox.</li>
              <li>When a Google Cloud project is configured, queued mail is written to the Firestore <code className="tiny">mail</code> collection and the Trigger Email extension delivers it. Locally it stays queued here for inspection.</li>
              <li>De-duplicated by a stable key, so a cron retry never double-mails a family.</li>
            </ol>
          </section>

          {messages.length > 0 ? (
            <details className="disclosure" style={{ background: "transparent" }}>
              <summary style={{ padding: "12px 0", minHeight: 0, color: "var(--muted)" }}>
                <span className="row" style={{ gap: 8 }}>
                  <Icon name="trash" size={15} />
                  Clear the outbox
                </span>
                <span className="plus muted"><Icon name="plus" size={15} /></span>
              </summary>
              <div style={{ paddingTop: 8 }}>
                <p className="small muted" style={{ marginBottom: 10 }}>
                  This only clears queued and sent previews. It does not change any medication data.
                </p>
                <form action={clearOutboxAction}>
                  <DangerButton className="btn btn-danger btn-block" confirmLabel="Tap again to clear all messages" pendingLabel="Clearing…">
                    Clear all messages
                  </DangerButton>
                </form>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
