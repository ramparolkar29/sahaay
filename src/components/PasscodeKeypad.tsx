"use client";

import { useActionState, useEffect, useState } from "react";
import { loginAction, type ActionState } from "@/app/actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function PasscodeKeypad({ memberId, demoCode }: { memberId: string; demoCode?: string }) {
  const [state, formAction] = useActionState(loginAction, {} as ActionState);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (state.error) setCode("");
  }, [state.error]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) setCode((current) => (current.length >= 8 ? current : current + event.key));
      if (event.key === "Backspace") setCode((current) => current.slice(0, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const boxes = Math.max(4, code.length);

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="passcode" value={code} />

      <div className="login-codes" aria-hidden="true">
        {Array.from({ length: boxes }, (_, index) => (
          <span key={index} className="code-box">
            {index < code.length ? "•" : ""}
          </span>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {code.length} digits entered
      </p>

      <div className="keypad">
        {KEYS.map((key) => (
          <button key={key} type="button" className="key" onClick={() => setCode((current) => (current.length >= 8 ? current : current + key))}>
            {key}
          </button>
        ))}
        <button type="button" className="key key-quiet" onClick={() => setCode("")}>
          Clear
        </button>
        <button type="button" className="key" onClick={() => setCode((current) => (current.length >= 8 ? current : current + "0"))}>
          0
        </button>
        <button type="button" className="key key-quiet" aria-label="Delete last digit" onClick={() => setCode((current) => current.slice(0, -1))}>
          Del
        </button>
      </div>

      <button type="submit" className="btn btn-primary btn-xl btn-block" disabled={code.length < 4}>
        Unlock
      </button>

      {state.error ? (
        <p className="error-text center" role="alert">
          {state.error}
        </p>
      ) : (
        <p className="hint center">4 to 8 digits. Your passcode is never shared with anyone.</p>
      )}

      {demoCode ? (
        <button type="button" className="btn btn-quiet btn-block" onClick={() => setCode(demoCode)}>
          Use demo passcode {demoCode}
        </button>
      ) : null}
    </form>
  );
}
