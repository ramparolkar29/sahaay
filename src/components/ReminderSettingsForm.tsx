"use client";

import { useActionState } from "react";
import { saveReminderSettingsAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function ReminderSettingsForm({ lead, grace }: { lead: number; grace: number }) {
  const [state, action] = useActionState(saveReminderSettingsAction, {} as ActionState);

  return (
    <form action={action} className="stack">
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="lead">Upcoming dose alert</label>
          <select id="lead" name="reminderLeadMinutes" className="select" defaultValue={String(lead)}>
            {[10, 15, 30, 45, 60, 120].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min before
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="grace">Mark as missed after</label>
          <select id="grace" name="missedGraceMinutes" className="select" defaultValue={String(grace)}>
            {[30, 45, 60, 90, 120, 180].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min late
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? <p className="error-text" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="banner banner-ok" role="status">{state.message}</p> : null}

      <SubmitButton className="btn" pendingLabel="Saving…">
        Save alert settings
      </SubmitButton>
    </form>
  );
}
