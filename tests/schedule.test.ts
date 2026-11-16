import { describe, expect, it } from "vitest";
import { buildDayDoses, doseStatus, medicineRunsOn, pickNextDose, scheduleSummary, slotsForDate } from "@/lib/schedule";
import { addDays, lastDays, timeLabel, weekdayOf, zonedMoment, zonedTimeToUtc } from "@/lib/time";
import { makeLog, makeMedicine } from "./fixtures";

describe("time helpers", () => {
  it("reads a wall clock moment in the circle time zone", () => {
    // 02:10 UTC is 07:40 in Asia/Kolkata
    const moment = zonedMoment(new Date("2026-11-15T02:10:00Z"), "Asia/Kolkata");
    expect(moment.date).toBe("2026-11-15");
    expect(moment.minutes).toBe(7 * 60 + 40);
    expect(moment.weekday).toBe(0);
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("builds an inclusive trailing window", () => {
    expect(lastDays("2026-11-15", 3)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);
  });

  it("converts a zoned wall clock to the right UTC instant", () => {
    const utc = zonedTimeToUtc("2026-11-15", "08:00", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-11-15T02:30:00.000Z");
  });

  it("formats times for people, not machines", () => {
    expect(timeLabel("08:00")).toBe("8:00 am");
    expect(timeLabel("21:30")).toBe("9:30 pm");
  });

  it("computes weekdays without timezone drift", () => {
    expect(weekdayOf("2026-11-15")).toBe(0);
    expect(weekdayOf("2026-11-16")).toBe(1);
  });
});

describe("medicineRunsOn", () => {
  it("runs every day when no days are selected", () => {
    expect(medicineRunsOn(makeMedicine(), "2026-11-16")).toBe(true);
  });

  it("respects selected weekdays", () => {
    const med = makeMedicine({ days: [1, 3, 5] });
    expect(medicineRunsOn(med, "2026-11-16")).toBe(true); // Monday
    expect(medicineRunsOn(med, "2026-11-17")).toBe(false); // Tuesday
  });

  it("honours the start and end window", () => {
    const med = makeMedicine({ startDate: "2026-11-10", endDate: "2026-11-20" });
    expect(medicineRunsOn(med, "2026-11-09")).toBe(false);
    expect(medicineRunsOn(med, "2026-11-15")).toBe(true);
    expect(medicineRunsOn(med, "2026-11-21")).toBe(false);
  });

  it("never runs a paused medicine", () => {
    expect(medicineRunsOn(makeMedicine({ active: false }), "2026-11-15")).toBe(false);
    expect(slotsForDate(makeMedicine({ active: false }), "2026-11-15")).toEqual([]);
  });
});

describe("doseStatus", () => {
  const base = { slotMinutes: 480, nowMinutes: 470, dayOffset: 0, log: null, graceMinutes: 90 };

  it("marks the 15 minute run-up as due", () => {
    expect(doseStatus(base)).toBe("due");
  });

  it("keeps later doses upcoming", () => {
    expect(doseStatus({ ...base, nowMinutes: 400 })).toBe("upcoming");
  });

  it("marks the dose missed once the grace window passes", () => {
    expect(doseStatus({ ...base, nowMinutes: 480 + 91 })).toBe("missed");
  });

  it("trusts a recorded log over the clock", () => {
    expect(doseStatus({ ...base, nowMinutes: 700, log: makeLog({ status: "taken" }) })).toBe("taken");
    expect(doseStatus({ ...base, nowMinutes: 700, log: makeLog({ status: "skipped" }) })).toBe("skipped");
  });

  it("treats silent past days as missed", () => {
    expect(doseStatus({ ...base, dayOffset: -1 })).toBe("missed");
  });
});

describe("buildDayDoses", () => {
  it("merges medicines with logs and sorts by time", () => {
    const morning = makeMedicine({ id: "a", name: "Amlodipine", times: ["21:30"] });
    const evening = makeMedicine({ id: "b", name: "Metformin", times: ["08:00"] });
    const doses = buildDayDoses({
      medicines: [morning, evening],
      logs: [makeLog({ medicineId: "b" })],
      dateKey: "2026-11-15",
      nowMinutes: 600,
      graceMinutes: 90,
      dayOffset: 0,
    });

    expect(doses.map((dose) => dose.time)).toEqual(["08:00", "21:30"]);
    expect(doses[0].status).toBe("taken");
    expect(doses[1].status).toBe("upcoming");
  });

  it("picks the actionable dose before the upcoming one", () => {
    const med = makeMedicine({ times: ["08:00", "20:00"] });
    const doses = buildDayDoses({
      medicines: [med],
      logs: [],
      dateKey: "2026-11-15",
      nowMinutes: 8 * 60 + 50,
      graceMinutes: 30,
      dayOffset: 0,
    });
    expect(pickNextDose(doses, 8 * 60 + 50)?.time).toBe("08:00");

    const logged = buildDayDoses({
      medicines: [med],
      logs: [makeLog()],
      dateKey: "2026-11-15",
      nowMinutes: 8 * 60 + 50,
      graceMinutes: 30,
      dayOffset: 0,
    });
    expect(pickNextDose(logged, 8 * 60 + 50)?.time).toBe("20:00");
  });

  it("returns nothing when every dose is handled", () => {
    const med = makeMedicine();
    const doses = buildDayDoses({
      medicines: [med],
      logs: [makeLog()],
      dateKey: "2026-11-15",
      nowMinutes: 9 * 60,
      graceMinutes: 90,
      dayOffset: 0,
    });
    expect(pickNextDose(doses, 9 * 60)).toBeNull();
  });
});

describe("scheduleSummary", () => {
  it("describes a daily schedule", () => {
    const summary = scheduleSummary(makeMedicine({ times: ["08:00", "20:00"], days: [] }));
    expect(summary).toBe("Every day · 8:00 am · 8:00 pm");
  });

  it("lists the selected weekdays", () => {
    const summary = scheduleSummary(makeMedicine({ times: ["09:30"], days: [1, 4] }));
    expect(summary).toBe("Mon, Thu · 9:30 am");
  });
});
