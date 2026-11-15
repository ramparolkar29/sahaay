"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveMedicineAction, type ActionState } from "@/app/actions";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";

const FORMS = ["tablet", "capsule", "syrup", "drops", "injection", "inhaler", "other"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface MedicineFormValues {
  id?: string;
  name: string;
  dosage: string;
  form: string;
  instructions: string | null;
  times: string[];
  days: number[];
  startDate: string;
  endDate: string | null;
}

export function MedicineForm({ medicine, today }: { medicine?: MedicineFormValues; today: string }) {
  const [state, action] = useActionState(saveMedicineAction, {} as ActionState);
  const [times, setTimes] = useState<string[]>(medicine?.times.length ? medicine.times : ["08:00"]);

  function addTime() {
    if (times.length >= 6) return;
    const fallback = ["20:00", "13:00", "10:00", "22:00", "16:00"];
    const next = fallback.find((candidate) => !times.includes(candidate)) ?? "12:00";
    setTimes([...times, next].sort());
  }

  return (
    <form action={action} className="stack">
      {medicine?.id ? <input type="hidden" name="medicineId" value={medicine.id} /> : null}

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="med-name">Medicine name</label>
          <input id="med-name" name="name" className="input" defaultValue={medicine?.name} placeholder="Metformin" required minLength={2} />
        </div>
        <div className="field">
          <label className="label" htmlFor="med-dosage">Dosage</label>
          <input id="med-dosage" name="dosage" className="input" defaultValue={medicine?.dosage} placeholder="500 mg" required />
        </div>

        <div className="field">
          <label className="label" htmlFor="med-form">Form</label>
          <select id="med-form" name="form" className="select" defaultValue={medicine?.form ?? "tablet"}>
            {FORMS.map((option) => (
              <option key={option} value={option}>
                {option[0].toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="med-instructions">Instructions</label>
          <input id="med-instructions" name="instructions" className="input" defaultValue={medicine?.instructions ?? ""} placeholder="After breakfast" maxLength={160} />
        </div>

        <div className="field span-2">
          <span className="label" id="times-label">Times of day</span>
          <div className="stack-sm" role="group" aria-labelledby="times-label">
            {times.map((time, index) => (
              <div className="row" key={index} style={{ gap: 8 }}>
                <input
                  type="time"
                  name="times"
                  className="input"
                  value={time}
                  required
                  aria-label={`Dose time ${index + 1}`}
                  onChange={(event) => setTimes(times.map((value, position) => (position === index ? event.target.value : value)))}
                  style={{ maxWidth: 190 }}
                />
                {times.length > 1 ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    aria-label={`Remove dose time ${index + 1}`}
                    onClick={() => setTimes(times.filter((_, position) => position !== index))}
                  >
                    <Icon name="x" size={15} />
                  </button>
                ) : null}
              </div>
            ))}
            {times.length < 6 ? (
              <button type="button" className="btn btn-sm btn-quiet" onClick={addTime} style={{ justifySelf: "start" }}>
                <Icon name="plus" size={15} />
                Add another time
              </button>
            ) : null}
          </div>
        </div>

        <div className="field span-2">
          <span className="label">Days</span>
          <div className="days" role="group" aria-label="Days of the week">
            {DAYS.map((day, index) => (
              <label key={day} className="day-toggle">
                <input type="checkbox" name="days" value={index} defaultChecked={medicine ? medicine.days.includes(index) : false} />
                <span>{day}</span>
              </label>
            ))}
          </div>
          <p className="hint">Leave every day unchecked to run the schedule daily.</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="med-start">Starts on</label>
          <input id="med-start" type="date" name="startDate" className="input" defaultValue={medicine?.startDate ?? today} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="med-end">Ends on <span className="muted">(optional)</span></label>
          <input id="med-end" type="date" name="endDate" className="input" defaultValue={medicine?.endDate ?? ""} />
        </div>
      </div>

      {state.error ? (
        <p className="error-text" role="alert">{state.error}</p>
      ) : null}

      <div className="row">
        <SubmitButton className="btn btn-primary btn-xl" pendingLabel="Saving…">
          {medicine?.id ? "Save changes" : "Add medicine"}
        </SubmitButton>
        <Link href="/medicines" className="btn btn-xl btn-quiet">Cancel</Link>      </div>
    </form>
  );
}
