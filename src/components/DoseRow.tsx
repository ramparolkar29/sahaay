import { recordDoseAction } from "@/app/actions";
import type { DayDose } from "@/lib/schedule";
import { timeLabel } from "@/lib/time";
import { SubmitButton } from "./SubmitButton";
import { StatusPill } from "./StatusPill";

function HiddenFields({ dose, status }: { dose: DayDose; status: "taken" | "skipped" | "undo" }) {
  return (
    <>
      <input type="hidden" name="medicineId" value={dose.medicineId} />
      <input type="hidden" name="slotDate" value={dose.date} />
      <input type="hidden" name="slotTime" value={dose.time} />
      <input type="hidden" name="status" value={status} />
    </>
  );
}

export function DoseRow({ dose, large = false, nowMinutes }: { dose: DayDose; large?: boolean; nowMinutes?: number }) {
  const buttonSize = large ? "btn-elder-small" : "btn-sm";
  const tooEarly = !dose.log && nowMinutes !== undefined && dose.minutes - nowMinutes > 60;
  return (
    <li className={large ? "dose dose-elder" : "dose"}>
      <div className="dose-time">
        {timeLabel(dose.time)}
        <small>{dose.form}</small>
      </div>
      <div className="dose-body">
        <div className="dose-name">
          {dose.name} <span className="muted">{dose.dosage}</span>
        </div>
        <div className="dose-meta">{dose.instructions ?? "Take as prescribed"}</div>
      </div>
      <StatusPill status={dose.status} />
      <div className="dose-actions">
        {tooEarly ? (
          <span className="tiny muted nowrap">Due at {timeLabel(dose.time)}</span>
        ) : dose.log ? (
          <form action={recordDoseAction}>
            <HiddenFields dose={dose} status="undo" />
            <SubmitButton className={`btn ${buttonSize} btn-quiet`} pendingLabel="…">
              Undo
            </SubmitButton>
          </form>
        ) : (
          <>
            <form action={recordDoseAction}>
              <HiddenFields dose={dose} status="taken" />
              <SubmitButton className={`btn ${buttonSize} btn-primary`} pendingLabel="Saving…">
                Taken
              </SubmitButton>
            </form>
            <form action={recordDoseAction}>
              <HiddenFields dose={dose} status="skipped" />
              <SubmitButton className={`btn ${buttonSize}`} pendingLabel="…">
                Skip
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </li>
  );
}
