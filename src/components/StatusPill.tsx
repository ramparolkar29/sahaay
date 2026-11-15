import type { DoseStatus } from "@/lib/types";

const LABELS: Record<DoseStatus, string> = {
  taken: "Taken",
  skipped: "Skipped",
  missed: "Missed",
  due: "Due now",
  upcoming: "Upcoming",
};

export function StatusPill({ status }: { status: DoseStatus }) {
  return (
    <span className={`pill pill-${status}`}>
      <span className="dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}

export function AdherenceRing({ pct, size = 108, caption }: { pct: number; size?: number; caption?: string }) {
  const stroke = Math.round(size / 12);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 85 ? "var(--ok)" : clamped >= 60 ? "var(--warn)" : "var(--danger)";

  return (
    <div className="ring-wrap">
      <svg
        className="ring"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${caption ?? "Adherence"}: ${clamped} percent`}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring-value" style={{ fontSize: size / 5 }}>
          {clamped}%
        </text>
      </svg>
      {caption ? (
        <div>
          <div className="stat-label">{caption}</div>
          <div className="small muted">Last 7 days</div>
        </div>
      ) : null}
    </div>
  );
}
