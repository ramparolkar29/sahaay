import Link from "next/link";
import { toggleMedicineAction } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { MedicineForm } from "@/components/MedicineForm";
import { SubmitButton } from "@/components/SubmitButton";
import { currentContext } from "@/lib/auth";
import { buildDayDoses, scheduleSummary } from "@/lib/schedule";
import { getRepo } from "@/lib/store";
import { addDays, dateLabel, weekdayLabel, zonedMoment } from "@/lib/time";

export const metadata = { title: "Medicines" };

export default async function MedicinesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { circle } = await currentContext();
  const { saved } = await searchParams;
  const repo = getRepo();

  const moment = zonedMoment(new Date(), circle.timezone);
  const today = moment.date;
  const medicines = repo.listMedicines(circle.id, false);
  const logs = repo.listDoseLogs(circle.id, addDays(today, -6), today);

  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 6 }}>
          <p className="eyebrow">Schedule</p>
          <h1 className="h1">Medicines</h1>
          <p className="muted">Every dose on one schedule, visible to the whole care circle.</p>
        </div>
        <span className="circle-chip">{medicines.filter((medicine) => medicine.active).length} active</span>
      </div>

      {saved ? (
        <div className="banner banner-ok" role="status">
          <Icon name="check" size={18} />
          <div>Schedule saved. Today&apos;s doses update straight away.</div>
        </div>
      ) : null}

      <details className="disclosure" open={medicines.length === 0}>
        <summary>
          <span className="row" style={{ gap: 10 }}>
            <span className="plus">
              <Icon name="plus" size={19} />
            </span>
            Add a medicine
          </span>
          <span className="small muted">Name, dose, times, days</span>
        </summary>
        <div className="disclosure-body">
          <MedicineForm today={today} />
        </div>
      </details>

      {medicines.length === 0 ? (
        <div className="card empty">
          <Icon name="pill" size={28} />
          <p>No medicines yet. Add the first one above and today&apos;s schedule will build itself.</p>
        </div>
      ) : (
        <div className="medicine-grid">
          {medicines.map((medicine) => {
            const dots = week.map((date) => {
              const doses = buildDayDoses({
                medicines: [medicine],
                logs: logs.filter((log) => log.slotDate === date),
                dateKey: date,
                nowMinutes: date === today ? moment.minutes : null,
                graceMinutes: circle.missedGraceMinutes,
                dayOffset: date === today ? 0 : -1,
              });
              const total = doses.length;
              const taken = doses.filter((dose) => dose.status === "taken").length;
              const missed = doses.filter((dose) => dose.status === "missed").length;
              const cls = total === 0 ? "" : missed > 0 ? "miss" : taken === total ? "ok" : "partial";
              return { date, cls, total, taken };
            });

            return (
              <article key={medicine.id} className="card">
                <div className="row-between" style={{ alignItems: "flex-start" }}>
                  <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                    <span className="feed-icon" style={{ flex: "none" }}>
                      <Icon name="pill" size={17} />
                    </span>
                    <div>
                      <h2 className="h3">
                        {medicine.name} <span className="muted" style={{ fontWeight: 500 }}>{medicine.dosage}</span>
                      </h2>
                      <p className="small muted">{scheduleSummary(medicine)}</p>
                      {medicine.instructions ? <p className="tiny muted">{medicine.instructions}</p> : null}
                    </div>
                  </div>
                  <span className={`pill ${medicine.active ? "pill-taken" : "pill-skipped"}`}>
                    {medicine.active ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="week-strip" style={{ marginTop: 16 }} aria-label="Last seven days">
                  {dots.map((dot) => (
                    <span key={dot.date} className={`week-dot ${dot.cls}`} title={`${dateLabel(dot.date)}: ${dot.taken}/${dot.total}`}>
                      {weekdayLabel(new Date(`${dot.date}T00:00:00Z`).getUTCDay()).slice(0, 1)}
                    </span>
                  ))}
                </div>

                <div className="row" style={{ marginTop: 16 }}>
                  <Link href={`/medicines/${medicine.id}`} className="btn btn-sm">
                    <Icon name="edit" size={15} />
                    Edit
                  </Link>
                  <form action={toggleMedicineAction}>
                    <input type="hidden" name="medicineId" value={medicine.id} />
                    <input type="hidden" name="active" value={medicine.active ? "0" : "1"} />
                    <SubmitButton className="btn btn-sm btn-quiet" pendingLabel="…">
                      {medicine.active ? "Pause" : "Resume"}
                    </SubmitButton>
                  </form>
                  <span className="tiny muted nowrap">
                    From {dateLabel(medicine.startDate)}
                    {medicine.endDate ? ` to ${dateLabel(medicine.endDate)}` : ""}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
