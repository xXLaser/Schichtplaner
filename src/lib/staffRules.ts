import { shiftDurationHours, type ShiftKind } from "./shiftHours";

export type StaffRole = "OPERATOR" | "TEAM_LEAD" | "PART_TIME";

export type ShiftTimes = {
  startTime: string;
  endTime: string;
  kind: ShiftKind;
};

export type StaffConfig = {
  staffRole: StaffRole;
  employmentType: "FULL_TIME" | "PART_TIME";
  dutyModel: "ROTATION_4_4" | "WEEKDAYS" | "CUSTOM";
  partTimeStartTime: string;
  partTimeEndTime: string;
  allowIntermediateShifts: boolean;
};

/** Tag-/Nachtschicht 12h (06–18 / 18–06). */
export function isCore12hShift(shift: ShiftTimes): boolean {
  return (
    (shift.kind === "DAY" || shift.kind === "NIGHT") &&
    Math.abs(shiftDurationHours(shift.startTime, shift.endTime) - 12) < 0.2
  );
}

/** Kurze Tagschicht (Teilzeit, typisch 6 Stunden). */
export function isPartTimeShift(shift: ShiftTimes): boolean {
  if (shift.kind === "INTERMEDIATE") return false;
  const hours = shiftDurationHours(shift.startTime, shift.endTime);
  return shift.kind === "DAY" && hours > 0 && hours <= 7;
}

/** 9-Stunden-Zwischendienst für Teamleiter (zwischen Tag- und Nachtschicht). */
export function isTeamLeadShift(shift: ShiftTimes): boolean {
  if (shift.kind !== "INTERMEDIATE") return false;
  const hours = shiftDurationHours(shift.startTime, shift.endTime);
  return hours >= 8 && hours <= 10;
}

/**
 * Ob die Person laut Rolle auf diese Schicht darf.
 * Operator: 12h Tag/Nacht, Zwischendienst nur wenn ausdrücklich erlaubt.
 * Teamleiter: nur 9h-Zwischendienst.
 * Teilzeit: nur die kurze Tagschicht (z. B. 09–15).
 */
export function staffAllowsShift(employee: StaffConfig, shift: ShiftTimes): boolean {
  const role = employee.staffRole || "OPERATOR";

  if (role === "TEAM_LEAD") {
    return shift.kind === "INTERMEDIATE";
  }

  if (role === "PART_TIME" || employee.dutyModel === "WEEKDAYS") {
    if (shift.kind === "NIGHT" || shift.kind === "INTERMEDIATE") return false;
    if (
      shift.startTime === employee.partTimeStartTime &&
      shift.endTime === employee.partTimeEndTime
    ) {
      return true;
    }
    return isPartTimeShift(shift);
  }

  // OPERATOR
  if (shift.kind === "INTERMEDIATE") {
    return employee.allowIntermediateShifts;
  }
  if (isPartTimeShift(shift)) return false;
  return true;
}

export function applyStaffRoleDefaults(role: StaffRole): {
  staffRole: StaffRole;
  employmentType: "FULL_TIME" | "PART_TIME";
  dutyModel: "ROTATION_4_4" | "WEEKDAYS" | "CUSTOM";
  allowIntermediateShifts: boolean;
  shiftPreference: "ANY" | "DAY_ONLY" | "NIGHT_ONLY";
  partTimeStartTime: string;
  partTimeEndTime: string;
  maxShifts: number;
  targetHours: number;
  allowFifthShiftPerMonth: boolean;
} {
  if (role === "TEAM_LEAD") {
    return {
      staffRole: "TEAM_LEAD",
      employmentType: "FULL_TIME",
      dutyModel: "ROTATION_4_4",
      allowIntermediateShifts: true,
      shiftPreference: "ANY",
      partTimeStartTime: "09:00",
      partTimeEndTime: "15:00",
      maxShifts: 5,
      targetHours: 144,
      allowFifthShiftPerMonth: true,
    };
  }
  if (role === "PART_TIME") {
    return {
      staffRole: "PART_TIME",
      employmentType: "PART_TIME",
      dutyModel: "WEEKDAYS",
      allowIntermediateShifts: false,
      shiftPreference: "DAY_ONLY",
      partTimeStartTime: "09:00",
      partTimeEndTime: "15:00",
      maxShifts: 5,
      targetHours: 120,
      allowFifthShiftPerMonth: false,
    };
  }
  return {
    staffRole: "OPERATOR",
    employmentType: "FULL_TIME",
    dutyModel: "ROTATION_4_4",
    allowIntermediateShifts: false,
    shiftPreference: "ANY",
    partTimeStartTime: "09:00",
    partTimeEndTime: "15:00",
    maxShifts: 5,
    targetHours: 160,
    allowFifthShiftPerMonth: true,
  };
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  OPERATOR: "Schicht (12 Std.)",
  TEAM_LEAD: "Teamleiter (9 Std.)",
  PART_TIME: "Teilzeit untertags",
};

/** Sortierung: erst knappe Rollen-Schichten, dann Tag, dann Nacht. */
export function fillPriority(shift: ShiftTimes): number {
  if (shift.kind === "INTERMEDIATE") return 0;
  if (isPartTimeShift(shift)) return 1;
  if (shift.kind === "DAY") return 2;
  return 3;
}
