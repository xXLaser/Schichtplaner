import {
  addDays,
  eachDayOfInterval,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { prisma } from "./prisma";
import {
  allowedShiftKind,
  periodBounds,
  periodKeyFor,
  shiftDurationHours,
  type ShiftKind,
} from "./shiftHours";

export type ScheduleWarning = {
  date: string;
  shiftTemplateId: string;
  shiftName: string;
  competencyId: string;
  competencyName: string;
  required: number;
  assigned: number;
};

export type GenerateResult = {
  created: number;
  warnings: ScheduleWarning[];
};

type EmployeeWithSkills = {
  id: string;
  name: string;
  maxShifts: number;
  competencyIds: Set<string>;
  shiftPreference: "ANY" | "DAY_ONLY" | "NIGHT_ONLY" | "ROTATING";
  rotationWeeks: number;
  rotationStartDate: Date | null;
  rotationStartKind: ShiftKind;
  targetHours: number | null;
  hoursPeriod: "MONTH" | "QUARTER";
};

function dayKey(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

function isAbsentOnDay(
  absences: { employeeId: string; startDate: Date; endDate: Date }[],
  employeeId: string,
  day: Date,
): boolean {
  const d = startOfDay(day);
  return absences.some(
    (a) =>
      a.employeeId === employeeId &&
      isWithinInterval(d, {
        start: startOfDay(a.startDate),
        end: startOfDay(a.endDate),
      }),
  );
}

/**
 * Lädt und cached für jeden Mitarbeiter die bereits geleisteten Stunden in
 * seiner aktuellen Abrechnungsperiode (Monat oder Quartal), damit die
 * Zuteilung neuer Schichten die Sollstunden ausgleichen kann.
 */
class HoursTracker {
  private cache = new Map<string, number>();

  constructor(private pool: EmployeeWithSkills[]) {}

  private cacheKey(employeeId: string, periodKey: string): string {
    return `${employeeId}|${periodKey}`;
  }

  async hoursSoFar(employee: EmployeeWithSkills, day: Date): Promise<number> {
    const periodKey = periodKeyFor(day, employee.hoursPeriod);
    const key = this.cacheKey(employee.id, periodKey);
    if (this.cache.has(key)) return this.cache.get(key)!;

    const { start, end } = periodBounds(day, employee.hoursPeriod);
    const assignments = await prisma.assignment.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: start, lte: addDays(end, 1) },
      },
      include: { shiftTemplate: true },
    });
    const hours = assignments.reduce(
      (sum, a) =>
        sum + shiftDurationHours(a.shiftTemplate.startTime, a.shiftTemplate.endTime),
      0,
    );
    this.cache.set(key, hours);
    return hours;
  }

  addHours(employee: EmployeeWithSkills, day: Date, hours: number) {
    const periodKey = periodKeyFor(day, employee.hoursPeriod);
    const key = this.cacheKey(employee.id, periodKey);
    this.cache.set(key, (this.cache.get(key) ?? 0) + hours);
  }

  /** Nur für bereits vorab geladene (siehe hoursSoFar) Werte gedacht. */
  getCached(employee: EmployeeWithSkills, day: Date): number {
    const periodKey = periodKeyFor(day, employee.hoursPeriod);
    return this.cache.get(this.cacheKey(employee.id, periodKey)) ?? 0;
  }
}

/**
 * Erstellt einen Dienstplan für den Zeitraum.
 * Berücksichtigt Abwesenheiten (Urlaub/Krankenstand), Schichtpräferenzen
 * (nur Tag / nur Nacht / Wechseldienst) und gleicht die Zuteilung so aus,
 * dass jeder möglichst nah an seine Soll-Stunden (Monat/Quartal) kommt.
 * Bei Neugenerierung werden bestehende Zuweisungen im Zeitraum ersetzt
 * (automatische Kompensation von Abwesenheiten).
 */
export async function generateSchedule(
  startDate: string,
  endDate: string,
  options?: { replaceExisting?: boolean },
): Promise<GenerateResult> {
  const replaceExisting = options?.replaceExisting ?? true;
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));
  const days = eachDayOfInterval({ start, end });

  const [employees, absences, shifts] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      include: { competencies: true },
    }),
    prisma.absence.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
    }),
    prisma.shiftTemplate.findMany({
      where: { active: true },
      include: { requirements: { include: { competency: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const pool: EmployeeWithSkills[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    maxShifts: e.maxShifts,
    competencyIds: new Set(e.competencies.map((c) => c.competencyId)),
    shiftPreference: e.shiftPreference,
    rotationWeeks: e.rotationWeeks,
    rotationStartDate: e.rotationStartDate,
    rotationStartKind: e.rotationStartKind,
    targetHours: e.targetHours,
    hoursPeriod: e.hoursPeriod,
  }));

  if (replaceExisting) {
    await prisma.assignment.deleteMany({
      where: {
        date: {
          gte: start,
          lte: addDays(end, 1),
        },
      },
    });
  }

  const assignmentCount = new Map<string, number>();
  for (const e of pool) assignmentCount.set(e.id, 0);

  const hoursTracker = new HoursTracker(pool);
  // Vorab laden, damit die erste Sortierung schon die Stundenbilanz kennt.
  for (const day of days) {
    for (const e of pool) {
      await hoursTracker.hoursSoFar(e, day);
    }
  }

  const toCreate: {
    date: Date;
    shiftTemplateId: string;
    employeeId: string;
    competencyId: string | null;
  }[] = [];

  const warnings: ScheduleWarning[] = [];

  /** 0..1: wie stark die Quote (Stunden- oder Schichtziel) bereits ausgefüllt ist. */
  function fractionFilled(e: EmployeeWithSkills, day: Date): number {
    if (e.targetHours && e.targetHours > 0) {
      // hoursSoFar wurde bereits vorab in den Cache geladen (siehe oben).
      return hoursTracker.getCached(e, day) / e.targetHours;
    }
    return (assignmentCount.get(e.id) ?? 0) / Math.max(1, e.maxShifts);
  }

  for (const day of days) {
    // Track who already works any shift this day (max 1 shift/day)
    const busyToday = new Set<string>();

    for (const shift of shifts) {
      const assignedThisShift = new Set<string>();

      const matchesPreference = (e: EmployeeWithSkills) => {
        const allowed = allowedShiftKind(e, day);
        return allowed === null || allowed === shift.kind;
      };

      // Sort requirements by scarcity (fewest qualified available first)
      const reqs = [...shift.requirements].sort((a, b) => {
        const availA = pool.filter(
          (e) =>
            e.competencyIds.has(a.competencyId) &&
            !busyToday.has(e.id) &&
            matchesPreference(e) &&
            !isAbsentOnDay(absences, e.id, day),
        ).length;
        const availB = pool.filter(
          (e) =>
            e.competencyIds.has(b.competencyId) &&
            !busyToday.has(e.id) &&
            matchesPreference(e) &&
            !isAbsentOnDay(absences, e.id, day),
        ).length;
        return availA - availB;
      });

      for (const req of reqs) {
        let filled = 0;

        // Prefer people already on this shift who also have the competency
        // (one person can cover multiple competency slots if they have them)
        for (const empId of assignedThisShift) {
          if (filled >= req.minCount) break;
          const emp = pool.find((e) => e.id === empId);
          if (emp?.competencyIds.has(req.competencyId)) {
            filled += 1;
          }
        }

        while (filled < req.minCount) {
          // Praeferenz/Rotation ist eine harte Bedingung (nicht verhandelbar).
          const baseFilter = (e: EmployeeWithSkills) =>
            e.competencyIds.has(req.competencyId) &&
            !busyToday.has(e.id) &&
            !assignedThisShift.has(e.id) &&
            matchesPreference(e) &&
            !isAbsentOnDay(absences, e.id, day);

          let candidates = pool
            .filter(
              (e) =>
                baseFilter(e) && (assignmentCount.get(e.id) ?? 0) < e.maxShifts,
            )
            .sort((a, b) => {
              const fa = fractionFilled(a, day);
              const fb = fractionFilled(b, day);
              if (fa !== fb) return fa - fb;
              return a.competencyIds.size - b.competencyIds.size;
            });

          if (candidates.length === 0) {
            // Niemand mehr unter dem weichen Schicht-Limit -> Limit lockern,
            // damit die Schicht nicht unbesetzt bleibt.
            candidates = pool
              .filter(baseFilter)
              .sort((a, b) => fractionFilled(a, day) - fractionFilled(b, day));
          }

          if (candidates.length === 0) break;

          const pick = candidates[0];
          assignedThisShift.add(pick.id);
          busyToday.add(pick.id);
          assignmentCount.set(pick.id, (assignmentCount.get(pick.id) ?? 0) + 1);
          hoursTracker.addHours(
            pick,
            day,
            shiftDurationHours(shift.startTime, shift.endTime),
          );
          toCreate.push({
            date: day,
            shiftTemplateId: shift.id,
            employeeId: pick.id,
            competencyId: req.competencyId,
          });
          filled += 1;
        }

        if (filled < req.minCount) {
          warnings.push({
            date: dayKey(day),
            shiftTemplateId: shift.id,
            shiftName: shift.name,
            competencyId: req.competencyId,
            competencyName: req.competency.name,
            required: req.minCount,
            assigned: filled,
          });
        }
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.assignment.createMany({ data: toCreate });
  }

  return { created: toCreate.length, warnings };
}

export async function getSchedule(startDate: string, endDate: string) {
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));

  const [assignments, absences, shifts, employees, competencies] =
    await Promise.all([
      prisma.assignment.findMany({
        where: {
          date: { gte: start, lte: addDays(end, 1) },
        },
        include: {
          employee: { include: { competencies: { include: { competency: true } } } },
          shiftTemplate: true,
        },
        orderBy: [{ date: "asc" }],
      }),
      prisma.absence.findMany({
        where: {
          status: { in: ["APPROVED", "PENDING"] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
        include: { employee: true },
      }),
      prisma.shiftTemplate.findMany({
        where: { active: true },
        include: { requirements: { include: { competency: true } } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.employee.findMany({
        where: { active: true },
        include: { competencies: { include: { competency: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.competency.findMany({ orderBy: { name: "asc" } }),
    ]);

  return {
    assignments: assignments.map((a) => ({
      ...a,
      date: dayKey(a.date),
    })),
    absences: absences.map((a) => ({
      ...a,
      startDate: dayKey(a.startDate),
      endDate: dayKey(a.endDate),
    })),
    shifts,
    employees,
    competencies,
    days: eachDayOfInterval({ start, end }).map(dayKey),
  };
}
