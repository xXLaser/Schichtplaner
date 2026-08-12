import {
  addDays,
  eachDayOfInterval,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { prisma } from "./prisma";

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
 * Erstellt einen Dienstplan für den Zeitraum.
 * Berücksichtigt Abwesenheiten (Urlaub/Krankenstand) und stellt sicher,
 * dass die konfigurierten Mindestanzahlen je Kompetenz pro Schicht erfüllt sind.
 * Bei Neugenerierung werden bestehende Zuweisungen im Zeitraum ersetzt (Kompensation).
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

  const toCreate: {
    date: Date;
    shiftTemplateId: string;
    employeeId: string;
    competencyId: string | null;
  }[] = [];

  const warnings: ScheduleWarning[] = [];

  for (const day of days) {
    // Track who already works any shift this day (max 1 shift/day)
    const busyToday = new Set<string>();

    for (const shift of shifts) {
      const assignedThisShift = new Set<string>();

      // Sort requirements by scarcity (fewest qualified available first)
      const reqs = [...shift.requirements].sort((a, b) => {
        const availA = pool.filter(
          (e) =>
            e.competencyIds.has(a.competencyId) &&
            !busyToday.has(e.id) &&
            !isAbsentOnDay(absences, e.id, day),
        ).length;
        const availB = pool.filter(
          (e) =>
            e.competencyIds.has(b.competencyId) &&
            !busyToday.has(e.id) &&
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
          // Soft limit first (maxShifts), then allow overflow to avoid empty shifts
          const baseFilter = (e: EmployeeWithSkills) =>
            e.competencyIds.has(req.competencyId) &&
            !busyToday.has(e.id) &&
            !assignedThisShift.has(e.id) &&
            !isAbsentOnDay(absences, e.id, day);

          let candidates = pool
            .filter(
              (e) =>
                baseFilter(e) && (assignmentCount.get(e.id) ?? 0) < e.maxShifts,
            )
            .sort((a, b) => {
              const ca = assignmentCount.get(a.id) ?? 0;
              const cb = assignmentCount.get(b.id) ?? 0;
              if (ca !== cb) return ca - cb;
              return a.competencyIds.size - b.competencyIds.size;
            });

          if (candidates.length === 0) {
            candidates = pool
              .filter(baseFilter)
              .sort(
                (a, b) =>
                  (assignmentCount.get(a.id) ?? 0) -
                  (assignmentCount.get(b.id) ?? 0),
              );
          }

          if (candidates.length === 0) break;

          const pick = candidates[0];
          assignedThisShift.add(pick.id);
          busyToday.add(pick.id);
          assignmentCount.set(pick.id, (assignmentCount.get(pick.id) ?? 0) + 1);
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
