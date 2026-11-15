"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="state-wrap">
      <div className="card state-card" role="alert">
        <span className="state-icon">
          <Icon name="alert" size={28} />
        </span>
        <h1 className="h2">Something went wrong</h1>
        <p className="muted">Your medicines, appointments and notes are safe. Try again, or go back to today.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            <Icon name="refresh" size={17} />
            Try again
          </button>
          <Link href="/dashboard" className="btn btn-quiet">
            Go to today
          </Link>
        </div>
      </div>
    </div>
  );
}
