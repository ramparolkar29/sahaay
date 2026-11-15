"use client";

import { useActionState } from "react";
import { saveAppointmentAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function AppointmentForm({ defaultDate }: { defaultDate: string }) {
  const [state, action] = useActionState(saveAppointmentAction, {} as ActionState);

  return (
    <form action={action} className="stack">
      <div className="form-grid">
        <div className="field span-2">
          <label className="label" htmlFor="appt-title">What is it for?</label>
          <input id="appt-title" name="title" className="input" placeholder="Cardiology review" required minLength={2} />
        </div>
        <div className="field">
          <label className="label" htmlFor="appt-doctor">Doctor <span className="muted">(optional)</span></label>
          <input id="appt-doctor" name="doctor" className="input" placeholder="Dr. Meera Mehta" />
        </div>
        <div className="field">
          <label className="label" htmlFor="appt-location">Clinic or place <span className="muted">(optional)</span></label>
          <input id="appt-location" name="location" className="input" placeholder="Apollo Clinic, Sector 12" />
        </div>
        <div className="field">
          <label className="label" htmlFor="appt-date">Date</label>
          <input id="appt-date" type="date" name="date" className="input" defaultValue={defaultDate} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="appt-time">Time</label>
          <input id="appt-time" type="time" name="time" className="input" defaultValue="10:00" required />
        </div>
        <div className="field span-2">
          <label className="label" htmlFor="appt-notes">Notes to carry <span className="muted">(optional)</span></label>
          <textarea id="appt-notes" name="notes" className="textarea" placeholder="Carry the BP diary and latest reports." maxLength={400} />
        </div>
      </div>

      {state.error ? (
        <p className="error-text" role="alert">{state.error}</p>
      ) : null}

      <SubmitButton className="btn btn-primary btn-xl" pendingLabel="Saving…">
        Add appointment
      </SubmitButton>
    </form>
  );
}
