import { describe, expect, it } from "vitest";
import type { Appointment, Circle, Member } from "@/lib/types";
import { buildReminderDrafts } from "@/lib/reminders";
import { makeLog, makeMedicine } from "./fixtures";

const circle: Circle = {
  id: "circle-1",
  name: "Sharma family",
  elderName: "Kamla Sharma",
  timezone: "Asia/Kolkata",
  inviteCode: "SHARMA",
  reminderLeadMinutes: 30,
  missedGraceMinutes: 90,
  bloodGroup: "B+",
  allergies: "Penicillin",
  conditions: null,
  emergencyContact: "Anil · 98765",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const members: Member[] = [
  { id: "m1", circleId: "circle-1", name: "Kamla Sharma", role: "elder", phone: null, email: "kamla@example.com", isDemo: false, createdAt: "" },
  { id: "m2", circleId: "circle-1", name: "Anil Sharma", role: "caretaker", phone: null, email: "anil@example.com", isDemo: false, createdAt: "" },
  { id: "m3", circleId: "circle-1", name: "Priya Sharma", role: "family", phone: null, email: "priya@example.com", isDemo: false, createdAt: "" },
];

function appointment(startsAt: string): Appointment {
  return {
    id: "appt-1",
    circleId: "circle-1",
    title: "Cardiology review",
    doctor: "Dr. Mehta",
    location: "Apollo",
    startsAt,
    notes: null,
    createdBy: "m2",
    createdAt: "",
  };
}

// 02:10 UTC = 07:40 in Asia/Kolkata
const now = new Date("2026-11-15T02:10:00Z");

describe("buildReminderDrafts", () => {
  it("warns about a dose inside the lead window", () => {
    const drafts = buildReminderDrafts({
      circle,
      members,
      medicines: [makeMedicine({ id: "a", name: "Amlodipine", times: ["08:00"] })],
      logs: [],
      appointments: [],
      now,
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe("dose-upcoming");
    expect(drafts[0].subject).toContain("20 min");
    expect(drafts[0].toEmail).toBe("anil@example.com,priya@example.com");
  });

  it("does not nag about doses that are still hours away", () => {
    const drafts = buildReminderDrafts({
      circle,
      members,
      medicines: [makeMedicine({ times: ["13:00"] })],
      logs: [],
      appointments: [],
      now,
    });
    expect(drafts).toHaveLength(0);
  });

  it("flags a dose missed beyond the grace window", () => {
    const drafts = buildReminderDrafts({
      circle,
      members,
      medicines: [makeMedicine({ times: ["06:00"] })],
      logs: [],
      appointments: [],
      now,
    });
    expect(drafts.map((draft) => draft.kind)).toContain("dose-missed");
  });

  it("stays quiet when the dose was already logged", () => {
    const drafts = buildReminderDrafts({
      circle,
      members,
      medicines: [makeMedicine({ times: ["06:00"] })],
      logs: [makeLog({ slotTime: "06:00" })],
      appointments: [],
      now,
    });
    expect(drafts).toHaveLength(0);
  });

  it("escalates once three doses are missed in a day", () => {
    const medicines = ["a", "b", "c"].map((id) => makeMedicine({ id, times: ["06:00"] }));
    const drafts = buildReminderDrafts({ circle, members, medicines, logs: [], appointments: [], now });
    const escalation = drafts.filter((draft) => draft.kind === "escalation");
    expect(escalation).toHaveLength(1);
    expect(escalation[0].subject).toContain("3 missed doses");
  });

  it("reminds about an appointment inside 24 hours, once", () => {
    const soon = appointment(new Date(now.getTime() + 10 * 3_600_000).toISOString());
    const later = appointment(new Date(now.getTime() + 40 * 3_600_000).toISOString());

    const drafts = buildReminderDrafts({
      circle,
      members,
      medicines: [],
      logs: [],
      appointments: [soon, later],
      now,
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe("appointment");
    expect(drafts[0].dedupeKey).toBe("circle-1|appointment|appt-1|24h");
    expect(drafts[0].subject).toBe("Today · Cardiology review");
  });

  it("labels an appointment on the next day as tomorrow", () => {
    const tomorrow = appointment(new Date(now.getTime() + 20 * 3_600_000).toISOString());
    const drafts = buildReminderDrafts({ circle, members, medicines: [], logs: [], appointments: [tomorrow], now });
    expect(drafts[0].subject).toBe("Tomorrow · Cardiology review");
  });

  it("sends nothing when no one has an email", () => {
    const silent = members.map((member) => ({ ...member, email: null }));
    const drafts = buildReminderDrafts({
      circle,
      members: silent,
      medicines: [makeMedicine({ times: ["06:00"] })],
      logs: [],
      appointments: [],
      now,
    });
    expect(drafts).toHaveLength(0);
  });

  it("produces stable dedupe keys for repeat scans", () => {
    const input = {
      circle,
      members,
      medicines: [makeMedicine({ times: ["08:00"] })],
      logs: [],
      appointments: [],
      now,
    };
    const first = buildReminderDrafts(input);
    const second = buildReminderDrafts(input);
    expect(first[0].dedupeKey).toBe(second[0].dedupeKey);
  });

  it("phrases a recent miss in minutes rather than hours", () => {
    const quick = { ...circle, missedGraceMinutes: 15 };
    const drafts = buildReminderDrafts({
      circle: quick,
      members,
      medicines: [makeMedicine({ times: ["07:00"] })],
      logs: [],
      appointments: [],
      now,
    });
    const missed = drafts.find((draft) => draft.kind === "dose-missed");
    expect(missed?.body).toContain("40 min ago");
    expect(missed?.body).not.toContain("0 h");
  });

  it("falls back to the elder's email and a single-name greeting", () => {
    const onlyElder = members.filter((member) => member.role === "elder");
    const drafts = buildReminderDrafts({
      circle,
      members: onlyElder,
      medicines: [makeMedicine({ times: ["08:00"] })],
      logs: [],
      appointments: [],
      now,
    });
    expect(drafts[0].toEmail).toBe("kamla@example.com");
    expect(drafts[0].body).toContain("Hi Kamla,");
  });

  it("flags an escalation when no emergency contact is saved", () => {
    const noContact = { ...circle, emergencyContact: null };
    const medicines = ["a", "b", "c"].map((id) => makeMedicine({ id, times: ["06:00"] }));
    const drafts = buildReminderDrafts({ circle: noContact, members, medicines, logs: [], appointments: [], now });
    const escalation = drafts.find((draft) => draft.kind === "escalation");
    expect(escalation?.body).toContain("not added yet");
  });

  it("omits optional appointment details that are not set", () => {
    const bare = { ...appointment(new Date(now.getTime() + 5 * 3_600_000).toISOString()), doctor: null, location: null, notes: null };
    const drafts = buildReminderDrafts({ circle, members, medicines: [], logs: [], appointments: [bare], now });
    expect(drafts[0].body).not.toContain("undefined");
    expect(drafts[0].body).toContain("Cardiology review");
  });
});
