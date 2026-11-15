export type Role = "elder" | "caretaker" | "family";

export type DoseStatus = "taken" | "skipped" | "missed" | "due" | "upcoming";

export interface Circle {
  id: string;
  name: string;
  elderName: string;
  timezone: string;
  inviteCode: string;
  reminderLeadMinutes: number;
  missedGraceMinutes: number;
  bloodGroup: string | null;
  allergies: string | null;
  conditions: string | null;
  emergencyContact: string | null;
  createdAt: string;
}

export interface Member {
  id: string;
  circleId: string;
  name: string;
  role: Role;
  phone: string | null;
  email: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface Medicine {
  id: string;
  circleId: string;
  name: string;
  dosage: string;
  form: string;
  instructions: string | null;
  times: string[];
  days: number[];
  startDate: string;
  endDate: string | null;
  active: boolean;
  createdBy: string;
  createdAt: string;
}

export interface DoseLog {
  id: string;
  circleId: string;
  medicineId: string;
  slotDate: string;
  slotTime: string;
  status: "taken" | "skipped";
  note: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface Appointment {
  id: string;
  circleId: string;
  title: string;
  doctor: string | null;
  location: string | null;
  startsAt: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  circleId: string;
  memberId: string;
  memberName: string;
  kind: string;
  message: string;
  createdAt: string;
}

export interface OutboxMessage {
  id: string;
  circleId: string;
  toEmail: string;
  subject: string;
  body: string;
  kind: string;
  status: "queued" | "sent";
  dedupeKey: string;
  createdAt: string;
  sentAt: string | null;
}

export interface SessionPayload {
  memberId: string;
  circleId: string;
  name: string;
  role: Role;
}
