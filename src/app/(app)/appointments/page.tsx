import { deleteAppointmentAction } from "@/app/actions";
import { AppointmentForm } from "@/components/AppointmentForm";
import { DangerButton } from "@/components/DangerButton";
import { Icon } from "@/components/Icon";
import { currentContext } from "@/lib/auth";
import { getRepo } from "@/lib/store";
import { addDays, formatInZone, zonedMoment } from "@/lib/time";

export const metadata = { title: "Appointments" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { circle } = await currentContext();
  const { saved } = await searchParams;
  const repo = getRepo();
  const moment = zonedMoment(new Date(), circle.timezone);
  const now = Date.now();
  const all = repo.listAppointments(circle.id);
  const upcoming = all.filter((appointment) => new Date(appointment.startsAt).getTime() >= now - 3_600_000);
  const past = all.filter((appointment) => new Date(appointment.startsAt).getTime() < now - 3_600_000).reverse();

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 6 }}>
          <p className="eyebrow">Calendar</p>
          <h1 className="h1">Appointments</h1>
          <p className="muted">Visits, tests and follow-ups — with a reminder the day before.</p>
        </div>
        <span className="circle-chip">{upcoming.length} upcoming</span>
      </div>

      {saved ? (
        <div className="banner banner-ok" role="status">
          <Icon name="check" size={18} />
          <div>Appointment added. Family gets a reminder within 24 hours of the visit.</div>
        </div>
      ) : null}

      <details className="disclosure" open={all.length === 0}>
        <summary>
          <span className="row" style={{ gap: 10 }}>
            <span className="plus">
              <Icon name="plus" size={19} />
            </span>
            Add an appointment
          </span>
          <span className="small muted">Date, time, doctor</span>
        </summary>
        <div className="disclosure-body">
          <AppointmentForm defaultDate={addDays(moment.date, 1)} />
        </div>
      </details>

      <section className="stack" aria-labelledby="upcoming-appointments">
        <h2 className="h2" id="upcoming-appointments">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="card empty">
            <Icon name="calendar" size={26} />
            <p>No upcoming appointments.</p>
          </div>
        ) : (
          upcoming.map((appointment) => {
            const starts = new Date(appointment.startsAt);
            const parts = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: circle.timezone }).formatToParts(starts);
            const day = parts.find((part) => part.type === "day")?.value ?? "";
            const month = parts.find((part) => part.type === "month")?.value ?? "";
            const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: circle.timezone }).format(starts);
            const dayDelta = Math.round((starts.getTime() - now) / 86_400_000);

            return (
              <article key={appointment.id} className="card">
                <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
                  <div className="date-block" aria-hidden="true">
                    <span className="date-day">{day}</span>
                    <span className="date-month">{month}</span>
                  </div>
                  <div className="grow">
                    <div className="row-between">
                      <h3 className="h3">{appointment.title}</h3>
                      <span className={`pill ${dayDelta <= 1 ? "pill-due" : "pill-upcoming"}`}>
                        {formatInZone(starts, circle.timezone)}
                      </span>
                    </div>
                    <p className="small muted">
                      {[appointment.doctor, appointment.location].filter(Boolean).join(" · ") || "No clinician or place added"}
                    </p>
                    {appointment.notes ? <p className="small" style={{ marginTop: 8 }}>{appointment.notes}</p> : null}
                    <div className="row" style={{ marginTop: 12 }}>
                      <form action={deleteAppointmentAction}>
                        <input type="hidden" name="appointmentId" value={appointment.id} />
                        <DangerButton className="btn btn-sm btn-quiet" confirmLabel="Remove this visit?" pendingLabel="Removing…">
                          <Icon name="trash" size={14} />
                          Remove
                        </DangerButton>
                      </form>
                      <span className="tiny muted">Reminder goes out 24 h before</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {past.length > 0 ? (
        <section className="card" aria-labelledby="past-appointments">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="past-appointments">Past visits</h2>
              <p className="card-sub">Kept for the medical record</p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Appointment</th>
                <th scope="col">With</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {past.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="nowrap">{formatInZone(new Date(appointment.startsAt), circle.timezone)}</td>
                  <td>{appointment.title}</td>
                  <td className="muted">{appointment.doctor ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action={deleteAppointmentAction}>
                      <input type="hidden" name="appointmentId" value={appointment.id} />
                      <DangerButton
                        className="btn btn-sm btn-quiet"
                        confirmLabel="Remove?"
                        pendingLabel="…"
                        ariaLabel={`Remove ${appointment.title} from the record`}
                      >
                        <Icon name="trash" size={14} />
                      </DangerButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
