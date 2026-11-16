import { describe, expect, it } from "vitest";
import {
  dateLabel,
  dateLabelLong,
  dayDelta,
  formatInZone,
  minutesToTime,
  parseTimeToMinutes,
  relativeMinutes,
  weekdayLabel,
} from "@/lib/time";

describe("clock helpers", () => {
  it("parses and prints minutes since midnight", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("wraps minutes around a single day", () => {
    expect(minutesToTime(1440)).toBe("00:00");
    expect(minutesToTime(1505)).toBe("01:05");
    expect(minutesToTime(-30)).toBe("23:30");
  });
});

describe("dayDelta", () => {
  it("counts calendar days in both directions", () => {
    expect(dayDelta("2026-11-15", "2026-11-16")).toBe(1);
    expect(dayDelta("2026-11-16", "2026-11-15")).toBe(-1);
  });

  it("crosses month and year boundaries", () => {
    expect(dayDelta("2026-01-01", "2026-03-01")).toBe(59);
    expect(dayDelta("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("relativeMinutes", () => {
  it("describes past and future gaps in plain words", () => {
    expect(relativeMinutes(0)).toBe("in 0 min");
    expect(relativeMinutes(45)).toBe("in 45 min");
    expect(relativeMinutes(-12)).toBe("12 min ago");
    expect(relativeMinutes(135)).toBe("in 2 h 15 m");
    expect(relativeMinutes(-1500)).toBe("1 d ago");
  });
});

describe("labels", () => {
  it("formats dates for people", () => {
    expect(dateLabel("2026-11-15")).toMatch(/^Sun,? 15 Nov$/);
    expect(dateLabelLong("2026-11-15")).toMatch(/^Sunday,? 15 November$/);
  });

  it("maps weekday numbers", () => {
    expect(weekdayLabel(0)).toBe("Sun");
    expect(weekdayLabel(6)).toBe("Sat");
  });

  it("formats an instant in the circle time zone", () => {
    const label = formatInZone(new Date("2026-11-15T02:30:00Z"), "Asia/Kolkata");
    expect(label).toContain("15 Nov");
    expect(label).toContain("8:00");
  });
});
