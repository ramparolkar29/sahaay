"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function DangerButton({
  children,
  confirmLabel = "Tap again to confirm",
  className = "btn btn-sm btn-quiet",
  pendingLabel = "Working…",
  ariaLabel,
}: {
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
  pendingLabel?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { pending } = useFormStatus();

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="submit"
      className={armed ? `${className} is-armed` : className}
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (armed) return;
        event.preventDefault();
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 4000);
      }}
      onBlur={() => {
        if (!armed) return;
        clearTimeout(timer.current);
        setArmed(false);
      }}
    >
      {pending ? pendingLabel : armed ? confirmLabel : children}
    </button>
  );
}
