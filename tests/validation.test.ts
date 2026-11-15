import { describe, expect, it } from "vitest";
import {
  appointmentSchema,
  joinSchema,
  medicalIdSchema,
  medicineSchema,
  passcodeSchema,
  reminderSettingsSchema,
  setupSchema,
} from "@/lib/validation";

describe("passcodeSchema", () => {
  it("accepts 4 to 8 digits, including surrounding spaces", () => {
    expect(passcodeSchema.safeParse("1234").success).toBe(true);
    expect(passcodeSchema.safeParse(" 12345678 ").success).toBe(true);
  });

  it("rejects short, long and non-numeric passcodes", () => {
    expect(passcodeSchema.safeParse("123").success).toBe(false);
    expect(passcodeSchema.safeParse("123456789").success).toBe(false);
    expect(passcodeSchema.safeParse("12ab").success).toBe(false);
  });
});

describe("setupSchema", () => {
  const base = { circleName: "Sharma family", elderName: "Kamla Sharma", passcode: "1234" };

  it("defaults the timezone and allows an empty email", () => {
    const parsed = setupSchema.parse({ ...base, email: "" });
    expect(parsed.timezone).toBe("Asia/Kolkata");
    expect(parsed.email).toBe("");
  });

  it("rejects a one-character name or a malformed email", () => {
    expect(setupSchema.safeParse({ ...base, circleName: "S" }).success).toBe(false);
    expect(setupSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(setupSchema.safeParse({ ...base, email: "family@example.com" }).success).toBe(true);
  });

  it("never allows an elder to be created with a caretaker role", () => {
    const parsed = setupSchema.parse(base);
    expect(parsed.passcode).toBe("1234");
    expect("role" in parsed).toBe(false);
  });
});

describe("joinSchema", () => {
  const base = { inviteCode: "SHARMA", name: "Anil Sharma", role: "caretaker", passcode: "2580" };

  it("accepts a six-character invite code", () => {
    expect(joinSchema.safeParse(base).success).toBe(true);
    expect(joinSchema.safeParse({ ...base, inviteCode: "sharma" }).success).toBe(true);
  });

  it("rejects wrong-length codes and self-assigned elder roles", () => {
    expect(joinSchema.safeParse({ ...base, inviteCode: "SHARM" }).success).toBe(false);
    expect(joinSchema.safeParse({ ...base, inviteCode: "SHARMAS" }).success).toBe(false);
    expect(joinSchema.safeParse({ ...base, role: "elder" }).success).toBe(false);
    expect(joinSchema.safeParse({ ...base, role: "family" }).success).toBe(true);
  });
});

describe("medicineSchema", () => {
  const base = {
    name: "Amlodipine",
    dosage: "5 mg",
    form: "tablet",
    times: ["08:00"],
    days: [],
    startDate: "2026-11-15",
  };

  it("accepts a valid daily medicine", () => {
    expect(medicineSchema.safeParse(base).success).toBe(true);
    expect(medicineSchema.safeParse({ ...base, days: [1, 3, 5], endDate: "" }).success).toBe(true);
  });

  it("rejects bad times, empty schedules and invalid dates", () => {
    expect(medicineSchema.safeParse({ ...base, times: ["8:00"] }).success).toBe(false);
    expect(medicineSchema.safeParse({ ...base, times: ["24:00"] }).success).toBe(false);
    expect(medicineSchema.safeParse({ ...base, times: [] }).success).toBe(false);
    expect(medicineSchema.safeParse({ ...base, times: ["01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00"] }).success).toBe(false);
    expect(medicineSchema.safeParse({ ...base, startDate: "15-11-2026" }).success).toBe(false);
    expect(medicineSchema.safeParse({ ...base, days: [7] }).success).toBe(false);
    expect(medicineSchema.safeParse({ ...base, form: "powder" }).success).toBe(false);
  });
});

describe("appointmentSchema and medicalIdSchema", () => {
  it("requires an appointment title and start", () => {
    expect(appointmentSchema.safeParse({ title: "Cardiology review", startsAt: "2026-11-20T05:30:00.000Z" }).success).toBe(true);
    expect(appointmentSchema.safeParse({ title: "C", startsAt: "2026-11-20T05:30:00.000Z" }).success).toBe(false);
    expect(appointmentSchema.safeParse({ title: "Cardiology review" }).success).toBe(false);
  });

  it("accepts a partial medical ID", () => {
    const parsed = medicalIdSchema.parse({ bloodGroup: "B+", allergies: "", conditions: "Hypertension" });
    expect(parsed).toEqual({ bloodGroup: "B+", allergies: "", conditions: "Hypertension" });
  });
});

describe("reminderSettingsSchema", () => {
  it("coerces form strings into bounded numbers", () => {
    expect(reminderSettingsSchema.parse({ reminderLeadMinutes: "45", missedGraceMinutes: "120" })).toEqual({
      reminderLeadMinutes: 45,
      missedGraceMinutes: 120,
    });
  });

  it("rejects leads and graces outside the supported range", () => {
    expect(reminderSettingsSchema.safeParse({ reminderLeadMinutes: "3", missedGraceMinutes: "120" }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ reminderLeadMinutes: "45", missedGraceMinutes: "10" }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ reminderLeadMinutes: "999", missedGraceMinutes: "120" }).success).toBe(false);
  });
});
