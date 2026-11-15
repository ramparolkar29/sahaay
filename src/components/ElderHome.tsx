import Link from "next/link";
import { recordDoseAction } from "@/app/actions";
import type { DayDose } from "@/lib/schedule";
import type { Appointment, Circle, Member } from "@/lib/types";
import { dateLabelLong, timeLabel, relativeMinutes } from "@/lib/time";
import { DoseRow } from "./DoseRow";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";

function phoneFrom(contact: string | null): { name: string; tel: string } | null {
  if (!contact) return null;
  const match = contact.match(/\+?\d[\d\s-]{7,}\d/);
  if (!match) return null;
  const tel = match[0].replace(/[^\d+]/g, "");
  const name = contact.replace(match[0], "").replace(/[·,–-]\s*$/, "").trim();
  return { name: name || "your emergency contact", tel };
}

function appointmentParts(appointment: Appointment, timezone: string) {
  const at = new Date(appointment.startsAt);
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: timezone }).format(at);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone })
    .format(at)
    .toLowerCase();
  return { day: dateKey.slice(8), month, time };
}

export function ElderHome({
  circle,
  member,
  next,
  doses,
  appointments,
  takenCount,
  today,
  missed,
  greeting,
  nowMinutes,
  welcome,
  joined,
}: {
  circle: Circle;
  member: Member;
  next: DayDose | null;
  doses: DayDose[];
  appointments: Appointment[];
  takenCount: number;
  today: string;
  missed: DayDose[];
  greeting: string;
  nowMinutes: number;
  welcome?: string;
  joined?: string;
}) {
  const firstName = member.name.split(" ")[0];
  const emergency = phoneFrom(circle.emergencyContact);
  const upcoming = appointments[0] ?? null;
  const early = next !== null && next.status === "upcoming" && next.minutes - nowMinutes > 60;

  return (
    <div className="stack elder-home" style={{ gap: 20 }}>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 6 }}>
          <p className="eyebrow">
            {dateLabelLong(today)} · {circle.name}
          </p>
          <h1 className="h1">
            {greeting}, {firstName}
          </h1>
          <p className="muted">
            {doses.length === 0
              ? "No medicines are scheduled for today."
              : `${takenCount} of ${doses.length} medicines logged today.`}
          </p>
        </div>
      </div>

      {welcome ? (
        <div className="banner banner-ok" role="status">
          <Icon name="check" size={18} />
          <div>
            <strong>Your care circle is ready.</strong> Add your first medicine now, or ask a family member to help.
          </div>
        </div>
      ) : null}
      {joined ? (
        <div className="banner banner-ok" role="status">
          <Icon name="check" size={18} />
          <div>
            <strong>You are in.</strong> Everything you update is visible to the whole circle.
          </div>
        </div>
      ) : null}

      {missed.length > 0 ? (
        <div className="banner banner-danger" role="alert">
          <Icon name="alert" size={20} />
          <div>
            <strong>
              {missed.length} medicine{missed.length === 1 ? "" : "s"} not logged today.
            </strong>{" "}
            {missed.map((dose) => `${dose.name} at ${timeLabel(dose.time)}`).join(", ")}. This is also visible to your
            family.
          </div>
        </div>
      ) : null}

      {next ? (
        <section className={`elder-hero${next.status === "missed" ? " elder-hero-late" : ""}`} aria-labelledby="elder-next-title">
          <div className="row-between">
            <span className="pill pill-accent">
              <Icon name="sparkle" size={15} />
              {next.status === "missed" ? "This one is overdue" : "Your next medicine"}
            </span>
            <span className="small muted num">
              {relativeMinutes(next.minutes - nowMinutes)} · {timeLabel(next.time)}
            </span>
          </div>
          <p className="elder-clock num">{timeLabel(next.time)}</p>
          <h2 id="elder-next-title" className="elder-medicine">
            {next.name}
          </h2>
          <p className="elder-dose">
            {next.dosage} · {next.form}
          </p>
          <p className="elder-instructions">{next.instructions ?? "Take as prescribed"}</p>
          <div className="elder-actions">
            <form action={recordDoseAction} className={early ? undefined : "grow"}>
              <input type="hidden" name="medicineId" value={next.medicineId} />
              <input type="hidden" name="slotDate" value={next.date} />
              <input type="hidden" name="slotTime" value={next.time} />
              <input type="hidden" name="status" value="taken" />
              <SubmitButton
                className={early ? "btn btn-elder-quiet" : "btn btn-primary btn-elder btn-block"}
                pendingLabel="Saving…"
              >
                <Icon name={early ? "clock" : "check"} size={early ? 22 : 26} />
                {early ? "I took it early" : "I took it"}
              </SubmitButton>
            </form>
            {early ? null : (
              <form action={recordDoseAction}>
                <input type="hidden" name="medicineId" value={next.medicineId} />
                <input type="hidden" name="slotDate" value={next.date} />
                <input type="hidden" name="slotTime" value={next.time} />
                <input type="hidden" name="status" value="skipped" />
                <SubmitButton className="btn btn-elder-quiet" pendingLabel="Saving…">
                  Skip this dose
                </SubmitButton>
              </form>
            )}
          </div>
          <p className={early ? "tiny muted" : "tiny muted center"}>
            {early
              ? `This medicine is due at ${timeLabel(next.time)}. Only log it early if you are taking it now.`
              : "Tap “I took it” after you swallow this medicine."}
          </p>
        </section>
      ) : (
        <section className="elder-hero elder-hero-done" aria-labelledby="elder-done-title">
          <span className="elder-check" aria-hidden="true">
            <Icon name="check" size={38} />
          </span>
          <h2 id="elder-done-title" className="elder-medicine" style={{ fontSize: "clamp(1.7rem, 1.2rem + 2vw, 2.4rem)" }}>
            All done for today
          </h2>
          <p className="elder-instructions">
            {doses.length === 0
              ? "No medicine is scheduled today. Your family can add one whenever it is needed."
              : "Every medicine for today has been logged. Well done."}
          </p>
          {upcoming ? (
            <p className="small muted">
              Next visit: {upcoming.title} · {appointmentParts(upcoming, circle.timezone).day}{" "}
              {appointmentParts(upcoming, circle.timezone).month}, {appointmentParts(upcoming, circle.timezone).time}
            </p>
          ) : null}
        </section>
      )}

      {doses.length > 0 ? (
        <section className="card" aria-labelledby="elder-list-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="elder-list-title">
                Your medicines today
              </h2>
              <p className="card-sub">{dateLabelLong(today)}</p>
            </div>
          </div>
          <ul>
            {doses.map((dose) => (
              <DoseRow key={`${dose.medicineId}-${dose.time}`} dose={dose} large nowMinutes={nowMinutes} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="elder-grid">
        <section className="card" aria-labelledby="elder-help-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="elder-help-title">
                If you need help
              </h2>
              <p className="card-sub">Your emergency contact and medical ID</p>
            </div>
          </div>
          {emergency ? (
            <a className="btn btn-primary btn-elder btn-block" href={`tel:${emergency.tel}`}>
              <Icon name="phone" size={22} />
              Call {emergency.name}
            </a>
          ) : (
            <p className="small muted">No emergency contact has been saved yet. Family can add one on the Care team page.</p>
          )}
          <dl className="elder-medical">
            <div>
              <dt>Blood group</dt>
              <dd>{circle.bloodGroup ?? "Not saved"}</dd>
            </div>
            <div>
              <dt>Allergies</dt>
              <dd>{circle.allergies ?? "None recorded"}</dd>
            </div>
            <div>
              <dt>Conditions</dt>
              <dd>{circle.conditions ?? "None recorded"}</dd>
            </div>
          </dl>
        </section>

        <section className="card" aria-labelledby="elder-appt-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="elder-appt-title">
                Appointments
              </h2>
              <p className="card-sub">Visits coming up</p>
            </div>
            <Link href="/appointments" className="btn btn-sm btn-quiet">
              All
            </Link>
          </div>
          {appointments.length === 0 ? (
            <div className="empty" style={{ padding: "18px 8px" }}>
              <p className="small">No upcoming appointments.</p>
            </div>
          ) : (
            <ul className="stack-sm">
              {appointments.map((appointment) => {
                const parts = appointmentParts(appointment, circle.timezone);
                return (
                  <li key={appointment.id} className="elder-appt">
                    <span className="date-block">
                      <span className="date-day">{parts.day}</span>
                      <span className="date-month">{parts.month}</span>
                    </span>
                    <div className="grow">
                      <p className="strong">{appointment.title}</p>
                      <p className="small muted">{parts.time}</p>
                      {appointment.doctor || appointment.location ? (
                        <p className="tiny muted">{[appointment.doctor, appointment.location].filter(Boolean).join(" · ")}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <nav className="elder-links" aria-label="More pages">
        <Link href="/medicines">Medicines</Link>
        <Link href="/appointments">Appointments</Link>
        <Link href="/team">Care team</Link>
        <Link href="/outbox">Family reminders</Link>
        <Link href="/activity">Activity</Link>
      </nav>
    </div>
  );
}
