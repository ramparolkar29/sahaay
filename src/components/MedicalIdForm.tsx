"use client";

import { useActionState } from "react";
import { saveMedicalIdAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function MedicalIdForm({
  initial,
}: {
  initial: { bloodGroup: string; allergies: string; conditions: string; emergencyContact: string };
}) {
  const [state, action] = useActionState(saveMedicalIdAction, {} as ActionState);

  return (
    <form action={action} className="stack">
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="bloodGroup">Blood group</label>
          <input id="bloodGroup" name="bloodGroup" className="input" defaultValue={initial.bloodGroup} placeholder="B+" maxLength={6} />
        </div>
        <div className="field">
          <label className="label" htmlFor="emergencyContact">Emergency contact</label>
          <input id="emergencyContact" name="emergencyContact" className="input" defaultValue={initial.emergencyContact} placeholder="Anil Sharma · +91 98765 43210" maxLength={120} />
        </div>
        <div className="field">
          <label className="label" htmlFor="allergies">Allergies</label>
          <input id="allergies" name="allergies" className="input" defaultValue={initial.allergies} placeholder="Penicillin, sulfa drugs" maxLength={160} />
        </div>
        <div className="field">
          <label className="label" htmlFor="conditions">Conditions</label>
          <input id="conditions" name="conditions" className="input" defaultValue={initial.conditions} placeholder="Hypertension, Type 2 diabetes" maxLength={160} />
        </div>
      </div>

      {state.error ? <p className="error-text" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="banner banner-ok" role="status">{state.message}</p> : null}

      <SubmitButton className="btn btn-primary" pendingLabel="Saving…">
        Save medical ID
      </SubmitButton>
    </form>
  );
}
