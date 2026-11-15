"use client";

import { useActionState } from "react";
import { setupAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India · IST" },
  { value: "Asia/Dubai", label: "Gulf · GST" },
  { value: "Asia/Singapore", label: "Singapore · SGT" },
  { value: "Europe/London", label: "UK · GMT/BST" },
  { value: "America/New_York", label: "US East · ET" },
];

export function SetupForm() {
  const [state, action] = useActionState(setupAction, {} as ActionState);

  return (
    <form action={action} className="stack">
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="circleName">
            Care circle name
          </label>
          <input id="circleName" name="circleName" className="input" placeholder="Sharma family" autoComplete="off" required minLength={2} />
        </div>
        <div className="field">
          <label className="label" htmlFor="elderName">
            Who are we caring for?
          </label>
          <input id="elderName" name="elderName" className="input" placeholder="Kamla Sharma" autoComplete="off" required minLength={2} />
        </div>
        <div className="field">
          <label className="label" htmlFor="passcode">
            Their passcode
          </label>
          <input
            id="passcode"
            name="passcode"
            className="input"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            maxLength={8}
            placeholder="4 to 8 digits"
            autoComplete="new-password"
            aria-describedby="passcode-hint"
            required
          />
          <p id="passcode-hint" className="hint">
            This is the only thing they need to open Sahaay. Change it together, never share it by message.
          </p>
        </div>
        <div className="field">
          <label className="label" htmlFor="email">
            Email for reminders <span className="muted">(optional)</span>
          </label>
          <input id="email" name="email" type="email" className="input" placeholder="family@example.com" autoComplete="email" />
        </div>
        <div className="field">
          <label className="label" htmlFor="bloodGroup">
            Blood group <span className="muted">(optional)</span>
          </label>
          <input id="bloodGroup" name="bloodGroup" className="input" placeholder="B+" maxLength={6} autoComplete="off" />
        </div>
        <div className="field">
          <label className="label" htmlFor="timezone">
            Time zone
          </label>
          <select id="timezone" name="timezone" className="select" defaultValue="Asia/Kolkata">
            {TIMEZONES.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="row-between">
        <SubmitButton className="btn btn-primary btn-xl" pendingLabel="Creating…">
          Create care circle
        </SubmitButton>
        <span className="small muted">Family members join later with one invite code.</span>
      </div>
    </form>
  );
}
