import { describe, expect, it } from "vitest";
import { buildAdherence } from "@/lib/adherence";
import { makeLog, makeMedicine } from "./fixtures";

describe("buildAdherence", () => {
  const medicine = makeMedicine({ times: ["08:00", "20:00"] });
  const today = "2026-11-15";
  const days = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"];

  const logs = days.flatMap((date) => [
    makeLog({ id: `${date}-am`, slotDate: date, slotTime: "08:00", status: date === "2026-11-10" ? "skipped" : "taken" }),
    ...(date === "2026-11-12" ? [] : [makeLog({ id: `${date}-pm`, slotDate: date, slotTime: "20:00" })]),
  ]);

  const summary = buildAdherence({
    medicines: [medicine],
    logs: [...logs, makeLog({ id: "today-am", slotDate: today })],
    today,
    nowMinutes: 10 * 60,
    graceMinutes: 90,
  });

  it("counts only slots that have come and gone", () => {
    expect(summary.total).toBe(13);
    expect(summary.taken).toBe(11);
    expect(summary.skipped).toBe(1);
    expect(summary.missed).toBe(1);
  });

  it("reports adherence as taken over scheduled", () => {
    expect(summary.pct).toBe(85);
  });

  it("builds a per-day history with today last", () => {
    expect(summary.days).toHaveLength(7);
    expect(summary.days[6].date).toBe(today);
    expect(summary.days[6].total).toBe(1);
  });

  it("breaks the streak at the first day with a missed dose", () => {
    expect(summary.streak).toBe(3);
  });

  it("scores an empty schedule as 100 percent rather than zero", () => {
    const empty = buildAdherence({
      medicines: [],
      logs: [],
      today,
      nowMinutes: 10 * 60,
      graceMinutes: 90,
    });
    expect(empty.pct).toBe(100);
    expect(empty.total).toBe(0);
  });
});
