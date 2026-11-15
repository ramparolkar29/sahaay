import type { DoseLog, Medicine } from "@/lib/types";

export function makeMedicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: "med-1",
    circleId: "circle-1",
    name: "Metformin",
    dosage: "500 mg",
    form: "tablet",
    instructions: "With meals",
    times: ["08:00"],
    days: [],
    startDate: "2026-01-01",
    endDate: null,
    active: true,
    createdBy: "member-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeLog(overrides: Partial<DoseLog> = {}): DoseLog {
  return {
    id: "log-1",
    circleId: "circle-1",
    medicineId: "med-1",
    slotDate: "2026-11-15",
    slotTime: "08:00",
    status: "taken",
    note: null,
    recordedBy: "member-1",
    recordedAt: "2026-11-15T02:35:00.000Z",
    ...overrides,
  };
}
