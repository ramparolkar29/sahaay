import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMedicineAction, toggleMedicineAction } from "@/app/actions";
import { DangerButton } from "@/components/DangerButton";
import { Icon } from "@/components/Icon";
import { MedicineForm } from "@/components/MedicineForm";
import { SubmitButton } from "@/components/SubmitButton";
import { currentContext } from "@/lib/auth";
import { slotsForDate } from "@/lib/schedule";
import { getRepo } from "@/lib/store";
import { addDays, dateLabel, timeLabel, zonedMoment } from "@/lib/time";

export const metadata = { title: "Edit medicine" };

export default async function EditMedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { circle } = await currentContext();
  const repo = getRepo();
  const medicine = repo.getMedicine(circle.id, id);
  if (!medicine) notFound();

  const moment = zonedMoment(new Date(), circle.timezone);
  const upcoming: Array<{ date: string; time: string }> = [];
  for (let offset = 0; offset < 21 && upcoming.length < 5; offset += 1) {
    const date = addDays(moment.date, offset);
    for (const time of slotsForDate(medicine, date)) {
      if (upcoming.length < 5) upcoming.push({ date, time });
    }
  }

  const recent = repo
    .listDoseLogs(circle.id, addDays(moment.date, -14), moment.date)
    .filter((log) => log.medicineId === medicine.id)
    .slice(-8)
    .reverse();

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 6 }}>
          <Link href="/medicines" className="small muted row" style={{ gap: 6 }}>
            <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} />
            All medicines
          </Link>
          <h1 className="h1">{medicine.name}</h1>
          <p className="muted">{medicine.dosage} · {medicine.form}</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <MedicineForm
            today={moment.date}
            medicine={{
              id: medicine.id,
              name: medicine.name,
              dosage: medicine.dosage,
              form: medicine.form,
              instructions: medicine.instructions,
              times: medicine.times,
              days: medicine.days,
              startDate: medicine.startDate,
              endDate: medicine.endDate,
            }}
          />
        </section>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card" aria-labelledby="upcoming-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="upcoming-title">Next doses</h2>
                <p className="card-sub">Based on this schedule</p>
              </div>
            </div>
            {upcoming.length === 0 ? (
              <p className="small muted">No upcoming doses — check the start and end dates or the selected days.</p>
            ) : (
              <ul className="stack-sm">
                {upcoming.map((slot) => (
                  <li key={`${slot.date}-${slot.time}`} className="row-between small">
                    <span>{dateLabel(slot.date)}</span>
                    <span className="num muted">{timeLabel(slot.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="history-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="history-title">Recent doses</h2>
                <p className="card-sub">Last 14 days</p>
              </div>
            </div>
            {recent.length === 0 ? (
              <p className="small muted">Nothing logged yet.</p>
            ) : (
              <ul className="stack-sm">
                {recent.map((log) => (
                  <li key={log.id} className="row-between small">
                    <span>
                      {dateLabel(log.slotDate)} · {timeLabel(log.slotTime)}
                    </span>
                    <span className={`pill ${log.status === "taken" ? "pill-taken" : "pill-skipped"}`}>
                      {log.status === "taken" ? "Taken" : "Skipped"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card stack-sm">
            <h2 className="card-title">Schedule controls</h2>
            <form action={toggleMedicineAction}>
              <input type="hidden" name="medicineId" value={medicine.id} />
              <input type="hidden" name="active" value={medicine.active ? "0" : "1"} />
              <SubmitButton className="btn btn-block" pendingLabel="…">
                {medicine.active ? "Pause this medicine" : "Resume this medicine"}
              </SubmitButton>
            </form>

            <details className="disclosure" style={{ background: "transparent", border: 0 }}>
              <summary style={{ padding: "10px 0", minHeight: 0, color: "var(--muted)" }}>
                <span className="row" style={{ gap: 8 }}>
                  <Icon name="trash" size={16} />
                  Remove medicine
                </span>
                <span className="plus muted">
                  <Icon name="plus" size={16} />
                </span>
              </summary>
              <div style={{ paddingTop: 6 }}>
                <p className="small muted" style={{ marginBottom: 10 }}>
                  This deletes {medicine.name} and all of its dose history. Pausing keeps the history and hides it from
                  today&apos;s schedule.
                </p>
                <form action={deleteMedicineAction}>
                  <input type="hidden" name="medicineId" value={medicine.id} />
                  <DangerButton
                    className="btn btn-danger btn-block"
                    confirmLabel={`Tap again to delete ${medicine.name}`}
                    pendingLabel="Removing…"
                  >
                    Delete permanently
                  </DangerButton>
                </form>
              </div>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
