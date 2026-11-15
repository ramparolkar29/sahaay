"use client";

import { useActionState } from "react";
import { joinAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function JoinForm({ presetCode = "" }: { presetCode?: string }) {
  const [state, action] = useActionState(joinAction, {} as ActionState);

  return (
    <form action={action} className="stack">
      <div className="form-grid">
        <div className="field span-2">
          <label className="label" htmlFor="inviteCode">
            6-character invite code
          </label>
          <input
            id="inviteCode"
            name="inviteCode"
            className="input num"
            defaultValue={presetCode}
            placeholder="SHARMA"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            style={{ letterSpacing: "0.32em", textTransform: "uppercase", fontWeight: 700 }}
            required
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input id="name" name="name" className="input" placeholder="Priya Sharma" autoComplete="name" required minLength={2} />
        </div>
        <div className="field">
          <label className="label" htmlFor="role">
            You are joining as
          </label>
          <select id="role" name="role" className="select" defaultValue="family">
            <option value="family">Family member</option>
            <option value="caretaker">Caretaker / nurse</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="passcode">
            Choose your passcode
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
            required
          />
          <p className="hint">Only you use this passcode — every action stays attributed to you.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="email">
            Email for reminders <span className="muted">(optional but recommended)</span>
          </label>
          <input id="email" name="email" type="email" className="input" placeholder="you@example.com" autoComplete="email" />
        </div>
      </div>

      {state.error ? (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton className="btn btn-primary btn-xl" pendingLabel="Joining…">
        Join care circle
      </SubmitButton>
    </form>
  );
}
