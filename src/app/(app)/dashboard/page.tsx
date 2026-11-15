import Link from "next/link";
import { recordDoseAction, runScanAction } from "@/app/actions";
import { AdherenceRing, StatusPill } from "@/components/StatusPill";
import { Avatar } from "@/components/Brand";
import { DoseRow } from "@/components/DoseRow";
import { ElderHome } from "@/components/ElderHome";
import { Icon, type IconName } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { buildAdherence } from "@/lib/adherence";
import { currentContext } from "@/lib/auth";
import { buildDayDoses, pickNextDose } from "@/lib/schedule";
import { getRepo } from "@/lib/store";
import { addDays, dateLabel, dateLabelLong, formatInZone, relativeMinutes, timeLabel, zonedMoment } from "@/lib/time";

const ACTIVITY_ICON: Record<string, IconName> = {
  medicine: "pill",
  dose: "check",
  appointment: "calendar",
  member: "users",
  profile: "shield",
};

function greetingFor(minutes: number): string {
  if (minutes < 12 * 60) return "Good morning";
  if (minutes < 17 * 60) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; joined?: string }>;
}) {
  const { member, circle } = await currentContext();
  const { welcome, joined } = await searchParams;
  const repo = getRepo();

  const now = new Date();
  const moment = zonedMoment(now, circle.timezone);
  const today = moment.date;

  const medicines = repo.listMedicines(circle.id);
  const logs = repo.listDoseLogs(circle.id, addDays(today, -7), today);
  const todayDoses = buildDayDoses({
    medicines,
    logs: logs.filter((log) => log.slotDate === today),
    dateKey: today,
    nowMinutes: moment.minutes,
    graceMinutes: circle.missedGraceMinutes,
    dayOffset: 0,
  });
  const adherence = buildAdherence({
    medicines,
    logs,
    today,
    nowMinutes: moment.minutes,
    graceMinutes: circle.missedGraceMinutes,
  });
  const next = pickNextDose(todayDoses, moment.minutes);
  const early = next !== null && next.status === "upcoming" && next.minutes - moment.minutes > 60;
  const missed = todayDoses.filter((dose) => dose.status === "missed");
  const takenCount = todayDoses.filter((dose) => dose.status === "taken").length;

  const appointments = repo
    .listAppointments(circle.id)
    .filter((appointment) => new Date(appointment.startsAt).getTime() >= now.getTime() - 3_600_000)
    .slice(0, 2);
  const members = repo.listMembers(circle.id);
  const activity = repo.listActivity(circle.id, 5);
  const emailCount = members.filter((m) => m.email && m.role !== "elder").length;
  const firstName = member.name.split(" ")[0];

  if (member.role === "elder") {
    return (
      <ElderHome
        circle={circle}
        member={member}
        next={next}
        doses={todayDoses}
        appointments={appointments}
        takenCount={takenCount}
        today={today}
        missed={missed}
        greeting={greetingFor(moment.minutes)}
        nowMinutes={moment.minutes}
        welcome={welcome}
        joined={joined}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 6 }}>
          <p className="eyebrow">
            {dateLabelLong(today)} · {circle.name}
          </p>
          <h1 className="h1">
            {greetingFor(moment.minutes)}, {firstName}
          </h1>
          <p className="muted">
            {todayDoses.length === 0
              ? "No doses scheduled today."
              : `${takenCount} of ${todayDoses.length} doses logged today.`}
          </p>
        </div>
        <div className="row">
          <Link href="/medicines" className="btn btn-sm">
            <Icon name="plus" size={16} />
            Medicine
          </Link>
          <form action={runScanAction}>
            <SubmitButton className="btn btn-sm btn-teal" pendingLabel="Scanning…">
              <Icon name="mail" size={16} />
              Run reminders
            </SubmitButton>
          </form>
        </div>
      </div>

      {welcome ? (
        <div className="banner banner-ok" role="status">
          <Icon name="check" size={18} />
          <div>
            <strong>Care circle created.</strong> Add the first medicine and invite family from the Care team page.
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
          <Icon name="alert" size={19} />
          <div>
            <strong>
              {missed.length} dose{missed.length === 1 ? "" : "s"} missed today.
            </strong>{" "}
            {missed.map((dose) => `${dose.name} at ${timeLabel(dose.time)}`).join(", ")}. A reminder email has been
            prepared for the family.
            <div className="row" style={{ marginTop: 8 }}>
              <Link href="/outbox" className="btn btn-sm">Review reminders</Link>
              <Link href="/medicines" className="btn btn-sm btn-quiet">Change schedule</Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="dashboard-grid">
        <div className="stack" style={{ gap: 18 }}>
          {next ? (
            <section className="hero stack" aria-labelledby="next-dose-title">
              <div className="row-between">
                <span className="pill pill-accent">
                  <Icon name="sparkle" size={14} />
                  {next.status === "missed" ? "Missed dose" : next.status === "due" ? "Due now" : "Next dose"}
                </span>
                <span className="small muted num">
                  {relativeMinutes(next.minutes - moment.minutes)} · {timeLabel(next.time)}
                </span>
              </div>
              <div>
                <h2 id="next-dose-title" style={{ fontSize: "clamp(1.75rem, 1.2rem + 2.4vw, 2.5rem)" }}>
                  {next.name} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{next.dosage}</span>
                </h2>
                <p className="muted">{next.instructions ?? "Take as prescribed"}</p>
              </div>
              <div className="row">
                <form action={recordDoseAction}>
                  <input type="hidden" name="medicineId" value={next.medicineId} />
                  <input type="hidden" name="slotDate" value={next.date} />
                  <input type="hidden" name="slotTime" value={next.time} />
                  <input type="hidden" name="status" value="taken" />
                  <SubmitButton className={early ? "btn btn-xl" : "btn btn-primary btn-xl"} pendingLabel="Saving…">
                    <Icon name={early ? "clock" : "check"} size={20} />
                    {early ? "I took it early" : "I took it"}
                  </SubmitButton>
                </form>
                {early ? null : (
                  <form action={recordDoseAction}>
                    <input type="hidden" name="medicineId" value={next.medicineId} />
                    <input type="hidden" name="slotDate" value={next.date} />
                    <input type="hidden" name="slotTime" value={next.time} />
                    <input type="hidden" name="status" value="skipped" />
                    <SubmitButton className="btn btn-xl" pendingLabel="Saving…">
                      Skip this dose
                    </SubmitButton>
                  </form>
                )}
              </div>
              {early ? (
                <p className="tiny muted">
                  Due at {timeLabel(next.time)}. Only log it early if the dose has actually been taken.
                </p>
              ) : null}
            </section>
          ) : (
            <section className="hero stack" aria-labelledby="all-done-title">
              <span className="pill pill-taken">
                <Icon name="check" size={14} />
                All clear
              </span>
              <h2 id="all-done-title" style={{ fontSize: "clamp(1.6rem, 1.2rem + 2vw, 2.2rem)" }}>
                Nothing pending for the rest of today.
              </h2>
              <p className="muted">
                {adherence.streak > 0 ? `${adherence.streak}-day streak. ` : ""}Adherence is {adherence.pct}% over the
                last 7 days.
              </p>
              <div className="row">
                <Link href="/appointments" className="btn">Check appointments</Link>
                <Link href="/activity" className="btn btn-quiet">See the activity log</Link>
              </div>
            </section>
          )}

          <section className="card" aria-labelledby="today-schedule">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="today-schedule">
                  Today&apos;s schedule
                </h2>
                <p className="card-sub">{dateLabel(today)} · tap Taken or Skip to log a dose</p>
              </div>
              <Link href="/medicines" className="btn btn-sm btn-quiet">Manage</Link>
            </div>

            {todayDoses.length === 0 ? (
              <div className="empty">
                <Icon name="pill" size={26} />
                <p>No medicine is scheduled for today.</p>
                <Link href="/medicines" className="btn btn-sm btn-primary">Add a medicine</Link>
              </div>
            ) : (
              <ul>
                {todayDoses.map((dose) => (
                  <DoseRow key={`${dose.medicineId}-${dose.time}`} dose={dose} nowMinutes={moment.minutes} />
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="recent-activity">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="recent-activity">Recent activity</h2>
                <p className="card-sub">Every change is attributed to a person</p>
              </div>
              <Link href="/activity" className="btn btn-sm btn-quiet">View all</Link>
            </div>
            <ol className="feed">
              {activity.map((entry) => (
                <li key={entry.id} className="feed-item">
                  <span className="feed-icon">
                    <Icon name={ACTIVITY_ICON[entry.kind] ?? "pulse"} size={16} />
                  </span>
                  <div>
                    <p className="feed-text">{entry.message}</p>
                    <p className="feed-time">
                      {entry.memberName} · {formatInZone(new Date(entry.createdAt), circle.timezone)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card" aria-labelledby="adherence-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="adherence-title">Adherence</h2>
                <p className="card-sub">
                  {adherence.taken} taken · {adherence.skipped} skipped · {adherence.missed} missed
                </p>
              </div>
            </div>
            <AdherenceRing pct={adherence.pct} />
            <div className="week-strip" style={{ marginTop: 18 }} aria-hidden="true">
              {adherence.days.map((day) => {
                const cls = day.total === 0 ? "" : day.missed > 0 ? "miss" : day.taken === day.total ? "ok" : "partial";
                return (
                  <span key={day.date} className={`week-dot ${cls}`} title={`${dateLabel(day.date)}: ${day.taken}/${day.total}`}>
                    {dateLabel(day.date).slice(0, 1)}
                  </span>
                );
              })}
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              {adherence.streak > 0 ? `${adherence.streak} full day${adherence.streak === 1 ? "" : "s"} without a missed dose.` : "A missed dose resets the streak — the goal is consistency, not perfection."}
            </p>
          </section>

          <section className="card" aria-labelledby="appointments-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="appointments-title">Appointments</h2>
                <p className="card-sub">Next visits</p>
              </div>
              <Link href="/appointments" className="btn btn-sm btn-quiet">All</Link>
            </div>
            {appointments.length === 0 ? (
              <div className="empty" style={{ padding: "18px 8px" }}>
                <p className="small">No upcoming appointments.</p>
                <Link href="/appointments" className="btn btn-sm">Add one</Link>
              </div>
            ) : (
              <ul className="stack-sm">
                {appointments.map((appointment) => (
                  <li key={appointment.id} className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                    <span className="feed-icon" style={{ flex: "none" }}>
                      <Icon name="calendar" size={16} />
                    </span>
                    <div className="grow">
                      <p className="strong small">{appointment.title}</p>
                      <p className="tiny muted">{formatInZone(new Date(appointment.startsAt), circle.timezone)}</p>
                      <p className="tiny muted">
                        {[appointment.doctor, appointment.location].filter(Boolean).join(" · ") || "No location yet"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="team-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="team-title">Care team</h2>
                <p className="card-sub">{members.length} people can update this profile</p>
              </div>
              <Link href="/team" className="btn btn-sm btn-quiet">Manage</Link>
            </div>
            <ul className="stack-sm">
              {members.map((person) => (
                <li key={person.id} className="row" style={{ gap: 12 }}>
                  <Avatar name={person.name} />
                  <div className="grow">
                    <p className="small strong">{person.name}</p>
                    <p className="tiny muted">{person.role === "elder" ? "Elder" : person.role === "caretaker" ? "Caretaker" : "Family"}</p>
                  </div>
                  {person.id === member.id ? <span className="pill pill-accent">You</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="reminders-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="reminders-title">Email reminders</h2>
                <p className="card-sub">
                  {emailCount > 0 ? `${emailCount} recipient${emailCount === 1 ? "" : "s"} on file` : "No family email yet"}
                </p>
              </div>
            </div>
            <p className="small muted">
              Upcoming doses, missed doses and appointments are emailed to family. Three missed doses in a day triggers
              an escalation.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <form action={runScanAction}>
                <SubmitButton className="btn btn-sm btn-teal" pendingLabel="Scanning…">
                  <Icon name="refresh" size={15} />
                  Run scan
                </SubmitButton>
              </form>
              <Link href="/outbox" className="btn btn-sm btn-quiet">Outbox</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
