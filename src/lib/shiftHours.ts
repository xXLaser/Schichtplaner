import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "./prisma";

/**
 * Dauer einer Schicht in Stunden anhand von "HH:MM"-Zeiten.
 * Schichten, die über Mitternacht gehen (z. B. 22:00–06:00), werden korrekt
 * als positive Dauer berechnet.
 */
export function shiftDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  return (endMinutes - startMinutes) / 60;
}

export type ShiftKind = "DAY" | "NIGHT" | "INTERMEDIATE";

type RotationConfig = {
  shiftPreference: "ANY" | "DAY_ONLY" | "NIGHT_ONLY" | "ROTATING";
  rotationWeeks: number;
  rotationStartDate: Date | null;
  rotationStartKind: ShiftKind;
  allowIntermediateShifts?: boolean;
};

/**
 * Liefert die an einem bestimmten Tag für den Mitarbeiter erlaubte Schichtart,
 * oder null, wenn keine Einschränkung besteht (Präferenz "ANY").
 * Zwischendienste (INTERMEDIATE) werden separat über allowIntermediateShifts
 * gesteuert und sind hier nicht die „erlaubte Art“.
 * Bei Wechseldienst (ROTATING) wird anhand von rotationStartDate/-Kind und
 * rotationWeeks berechnet, in welcher Phase (Tag/Nacht) sich der Mitarbeiter
 * an diesem Tag befindet.
 */
export function allowedShiftKind(
  employee: RotationConfig,
  day: Date,
): ShiftKind | null {
  if (employee.shiftPreference === "DAY_ONLY") return "DAY";
  if (employee.shiftPreference === "NIGHT_ONLY") return "NIGHT";
  if (employee.shiftPreference === "ANY") return null;

  // ROTATING – Intermediate zählt nicht als Rotationsphase
  const weeks = Math.max(1, employee.rotationWeeks || 1);
  const reference = employee.rotationStartDate
    ? startOfDay(employee.rotationStartDate)
    : startOfDay(day);
  const daysSince = Math.max(
    0,
    differenceInCalendarDays(startOfDay(day), reference),
  );
  const periodIndex = Math.floor(daysSince / (weeks * 7));
  const isStartPhase = periodIndex % 2 === 0;
  const startKind: ShiftKind =
    employee.rotationStartKind === "NIGHT" ? "NIGHT" : "DAY";
  const otherKind: ShiftKind = startKind === "DAY" ? "NIGHT" : "DAY";
  return isStartPhase ? startKind : otherKind;
}

/** Ob Präferenz/Rotation die Schichtart zulässt (inkl. Intermediate-Flag). */
export function preferenceAllowsShift(
  employee: RotationConfig,
  day: Date,
  shiftKind: ShiftKind,
): boolean {
  if (shiftKind === "INTERMEDIATE") {
    return Boolean(employee.allowIntermediateShifts);
  }
  const allowed = allowedShiftKind(employee, day);
  return allowed === null || allowed === shiftKind;
}

export function periodKeyFor(day: Date, period: "MONTH" | "QUARTER"): string {
  const y = day.getFullYear();
  if (period === "MONTH") {
    return `${y}-${String(day.getMonth() + 1).padStart(2, "0")}`;
  }
  const q = Math.floor(day.getMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

export function periodBounds(
  day: Date,
  period: "MONTH" | "QUARTER",
): { start: Date; end: Date } {
  const y = day.getFullYear();
  if (period === "MONTH") {
    const m = day.getMonth();
    return {
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 0),
    };
  }
  const q = Math.floor(day.getMonth() / 3);
  return {
    start: new Date(y, q * 3, 1),
    end: new Date(y, q * 3 + 3, 0),
  };
}

export function periodLabel(day: Date, period: "MONTH" | "QUARTER"): string {
  if (period === "MONTH") {
    return format(day, "MMMM yyyy", { locale: de });
  }
  const q = Math.floor(day.getMonth() / 3) + 1;
  return `Q${q} ${day.getFullYear()}`;
}

export type HoursReportEntry = {
  employeeId: string;
  name: string;
  hoursPeriod: "MONTH" | "QUARTER";
  periodLabel: string;
  targetHours: number | null;
  workedHours: number;
  remainingHours: number | null;
  shiftPreference: "ANY" | "DAY_ONLY" | "NIGHT_ONLY" | "ROTATING";
};

/**
 * Berechnet für jeden aktiven Mitarbeiter die geleisteten Stunden in seiner
 * eigenen aktuellen Abrechnungsperiode (Monat oder Quartal), bezogen auf das
 * übergebene Referenzdatum.
 */
export async function getHoursReport(reference: Date): Promise<HoursReportEntry[]> {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  if (employees.length === 0) return [];

  const boundsByPeriod = new Map<string, { start: Date; end: Date }>();
  for (const emp of employees) {
    const key = emp.hoursPeriod;
    if (!boundsByPeriod.has(key)) {
      boundsByPeriod.set(key, periodBounds(reference, emp.hoursPeriod));
    }
  }

  const earliest = [...boundsByPeriod.values()].reduce(
    (min, b) => (b.start < min ? b.start : min),
    reference,
  );
  const latest = [...boundsByPeriod.values()].reduce(
    (max, b) => (b.end > max ? b.end : max),
    reference,
  );

  const allAssignments = await prisma.assignment.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: earliest, lte: addDays(latest, 1) },
    },
    include: { shiftTemplate: true },
  });

  const byEmployee = new Map<string, typeof allAssignments>();
  for (const a of allAssignments) {
    const list = byEmployee.get(a.employeeId) ?? [];
    list.push(a);
    byEmployee.set(a.employeeId, list);
  }

  return employees.map((emp) => {
    const { start, end } = periodBounds(reference, emp.hoursPeriod);
    const assignments = (byEmployee.get(emp.id) ?? []).filter(
      (a) => a.date >= start && a.date <= addDays(end, 1),
    );
    const workedHours = assignments.reduce(
      (sum, a) =>
        sum + shiftDurationHours(a.shiftTemplate.startTime, a.shiftTemplate.endTime),
      0,
    );

    return {
      employeeId: emp.id,
      name: emp.name,
      hoursPeriod: emp.hoursPeriod,
      periodLabel: periodLabel(reference, emp.hoursPeriod),
      targetHours: emp.targetHours,
      workedHours,
      remainingHours: emp.targetHours != null ? emp.targetHours - workedHours : null,
      shiftPreference: emp.shiftPreference,
    };
  });
}
