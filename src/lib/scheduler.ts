import {
  addDays,
  eachDayOfInterval,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { prisma } from "./prisma";
import {
  periodBounds,
  periodKeyFor,
  preferenceAllowsShift,
  shiftDurationHours,
  type ShiftKind,
} from "./shiftHours";
import {
  canTakeAnotherShiftThisWeek,
  isDutyDay,
  markFifthShiftWeek,
  MIN_REST_HOURS,
  respectsMinRest,
  shiftDateTimeWindow,
  shiftMatchesDutyModel,
  weekKey,
  type DutyModel,
  type DutyModelConfig,
  type EmploymentType,
} from "./dutyModel";

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
  fromBase: number;
  warnings: ScheduleWarning[];
};

type EmployeeWithSkills = DutyModelConfig & {
  id: string;
  name: string;
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

function toDutyConfig(e: {
  employmentType: EmploymentType;
  dutyModel: DutyModel;
  dutyOnDays: number;
  dutyOffDays: number;
  dutyCycleStartDate: Date | null;
  allowFifthShiftPerMonth: boolean;
  partTimeStartTime: string;
  partTimeEndTime: string;
  workWeekdays: string;
  allowIntermediateShifts: boolean;
  defaultShiftTemplateId: string | null;
  maxShifts: number;
}): DutyModelConfig {
  return {
    employmentType: e.employmentType,
    dutyModel: e.dutyModel,
    dutyOnDays: e.dutyOnDays,
    dutyOffDays: e.dutyOffDays,
    dutyCycleStartDate: e.dutyCycleStartDate,
    allowFifthShiftPerMonth: e.allowFifthShiftPerMonth,
    partTimeStartTime: e.partTimeStartTime,
    partTimeEndTime: e.partTimeEndTime,
    workWeekdays: e.workWeekdays,
    allowIntermediateShifts: e.allowIntermediateShifts,
    defaultShiftTemplateId: e.defaultShiftTemplateId,
    maxShifts: e.maxShifts,
  };
}

class HoursTracker {
  private cache = new Map<string, number>();

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
        sum +
        shiftDurationHours(a.shiftTemplate.startTime, a.shiftTemplate.endTime),
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

  getCached(employee: EmployeeWithSkills, day: Date): number {
    const periodKey = periodKeyFor(day, employee.hoursPeriod);
    return this.cache.get(this.cacheKey(employee.id, periodKey)) ?? 0;
  }
}

/**
 * Erstellt einen Dienstplan für den Zeitraum.
 *
 * Ablauf:
 * 1. Bestehende Zuweisungen im Zeitraum optional löschen
 * 2. Ursprungsdienstplan als Basis übernehmen (sofern Dienstmodell, Abwesenheit
 *    und gesetzliche Ruhezeit von 12 Stunden passen)
 * 3. Fehlende Kompetenz-Slots automatisch auffüllen unter Beachtung von
 *    Dienstmodell (4/4 bzw. Mo–Fr), Überstundenpauschale (5. Dienst/Woche
 *    einmal im Monat) und Mindestruhezeit.
 *    Jede Kompetenz-Anforderung braucht eine eigene, dedizierte Person
 *    (kein Mehrfachzählen über mehrere Kompetenzen hinweg).
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

  const [employees, absences, shifts, baseEntries, priorAssignments] =
    await Promise.all([
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
      prisma.baseScheduleEntry.findMany({
        where: {
          date: { gte: start, lte: addDays(end, 1) },
        },
        include: { shiftTemplate: true },
      }),
      // Vorherige Dienste (für Ruhezeit über die Periodengrenze hinweg)
      prisma.assignment.findMany({
        where: {
          date: {
            gte: subDays(start, 2),
            lt: start,
          },
        },
        include: { shiftTemplate: true },
      }),
    ]);

  const pool: EmployeeWithSkills[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    ...toDutyConfig(e),
    competencyIds: new Set(e.competencies.map((c) => c.competencyId)),
    shiftPreference: e.shiftPreference,
    rotationWeeks: e.rotationWeeks,
    rotationStartDate: e.rotationStartDate,
    rotationStartKind: e.rotationStartKind,
    targetHours: e.targetHours,
    hoursPeriod: e.hoursPeriod,
  }));

  const poolById = new Map(pool.map((e) => [e.id, e]));
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

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
  const weekCounts = new Map<string, number>(); // empId|weekKey → count
  const fifthWeeks = new Set<string>();
  /** Letztes Schichtende je Mitarbeiter (für 12h-Ruhezeit). */
  const lastEnd = new Map<string, Date>();

  for (const e of pool) assignmentCount.set(e.id, 0);

  // Vorperioden-Zuweisungen für Ruhezeit initialisieren
  for (const a of priorAssignments) {
    const { end: endAt } = shiftDateTimeWindow(
      a.date,
      a.shiftTemplate.startTime,
      a.shiftTemplate.endTime,
    );
    const prev = lastEnd.get(a.employeeId);
    if (!prev || endAt > prev) lastEnd.set(a.employeeId, endAt);
  }

  // Bestehende Wochenzähler im Monat (außerhalb des Fensters) für 5er-Limit
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const existingMonth = await prisma.assignment.findMany({
    where: {
      date: { gte: monthStart, lt: start },
    },
  });
  const monthWeekCounts = new Map<string, number>();
  for (const a of existingMonth) {
    const k = `${a.employeeId}|${weekKey(a.date)}`;
    monthWeekCounts.set(k, (monthWeekCounts.get(k) ?? 0) + 1);
  }
  for (const [k, count] of monthWeekCounts) {
    if (count >= 5) {
      const empId = k.split("|")[0];
      const wk = k.slice(empId.length + 1);
      const d = existingMonth.find(
        (a) => a.employeeId === empId && weekKey(a.date) === wk,
      )?.date;
      if (d) markFifthShiftWeek(d, 5, fifthWeeks);
    }
  }

  const hoursTracker = new HoursTracker();
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
  let fromBase = 0;

  function weekCountKey(empId: string, day: Date) {
    return `${empId}|${weekKey(day)}`;
  }

  function getWeekCount(empId: string, day: Date) {
    return weekCounts.get(weekCountKey(empId, day)) ?? 0;
  }

  function recordAssignment(
    emp: EmployeeWithSkills,
    day: Date,
    shift: { id: string; startTime: string; endTime: string },
    competencyId: string | null,
  ) {
    const { start: startAt, end: endAt } = shiftDateTimeWindow(
      day,
      shift.startTime,
      shift.endTime,
    );
    toCreate.push({
      date: day,
      shiftTemplateId: shift.id,
      employeeId: emp.id,
      competencyId,
    });
    assignmentCount.set(emp.id, (assignmentCount.get(emp.id) ?? 0) + 1);
    const wk = weekCountKey(emp.id, day);
    const next = (weekCounts.get(wk) ?? 0) + 1;
    weekCounts.set(wk, next);
    markFifthShiftWeek(day, next, fifthWeeks);
    lastEnd.set(emp.id, endAt);
    hoursTracker.addHours(
      emp,
      day,
      shiftDurationHours(shift.startTime, shift.endTime),
    );
    void startAt;
  }

  function canAssign(
    emp: EmployeeWithSkills,
    day: Date,
    shift: {
      id: string;
      startTime: string;
      endTime: string;
      kind: ShiftKind;
    },
  ): boolean {
    if (!isDutyDay(emp, day)) return false;
    if (isAbsentOnDay(absences, emp.id, day)) return false;
    if (!shiftMatchesDutyModel(emp, shift)) return false;
    if (!preferenceAllowsShift(emp, day, shift.kind)) return false;

    const { start: startAt } = shiftDateTimeWindow(
      day,
      shift.startTime,
      shift.endTime,
    );
    if (!respectsMinRest(lastEnd.get(emp.id), startAt, MIN_REST_HOURS)) {
      return false;
    }

    if (
      !canTakeAnotherShiftThisWeek(
        emp,
        day,
        getWeekCount(emp.id, day),
        fifthWeeks,
      )
    ) {
      return false;
    }

    return true;
  }

  function fractionFilled(e: EmployeeWithSkills, day: Date): number {
    if (e.targetHours && e.targetHours > 0) {
      return hoursTracker.getCached(e, day) / e.targetHours;
    }
    return (assignmentCount.get(e.id) ?? 0) / Math.max(1, e.maxShifts);
  }

  // —— 1) Ursprungsdienstplan als Basis ——
  const busyByDay = new Map<string, Set<string>>();
  /** Pro Tag+Schicht: employeeId → Kompetenz, für die die Person zählt. */
  const assignedShiftByDay = new Map<string, Map<string, string | null>>();
  /** Mitarbeiter, die am Vortag bereits einen Dienst hatten (für durchgehende Blöcke). */
  const assignedOnDay = new Map<string, Set<string>>();

  function busySet(day: Date) {
    const k = dayKey(day);
    if (!busyByDay.has(k)) busyByDay.set(k, new Set());
    return busyByDay.get(k)!;
  }
  function assignedMap(day: Date, shiftId: string) {
    const k = `${dayKey(day)}|${shiftId}`;
    if (!assignedShiftByDay.has(k)) assignedShiftByDay.set(k, new Map());
    return assignedShiftByDay.get(k)!;
  }
  function dayAssignees(day: Date) {
    const k = dayKey(day);
    if (!assignedOnDay.has(k)) assignedOnDay.set(k, new Set());
    return assignedOnDay.get(k)!;
  }
  function countFilledForCompetency(
    assigned: Map<string, string | null>,
    competencyId: string,
  ): number {
    let n = 0;
    for (const assignedComp of assigned.values()) {
      if (assignedComp === competencyId) n += 1;
    }
    return n;
  }
  /** Bevorzugt durchgehende Einteilung im Dienstblock (Vortag schon Dienst). */
  function continuityRank(empId: string, day: Date): number {
    const prev = dayAssignees(subDays(day, 1));
    return prev.has(empId) ? 0 : 1;
  }

  const sortedBase = [...baseEntries].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  for (const entry of sortedBase) {
    const day = startOfDay(entry.date);
    if (day < start || day > end) continue;
    const emp = poolById.get(entry.employeeId);
    const shift = shiftById.get(entry.shiftTemplateId);
    if (!emp || !shift) continue;
    if (busySet(day).has(emp.id)) continue;
    if (!canAssign(emp, day, shift)) continue;

    const assignedThisShift = assignedMap(day, shift.id);
    // Knappste noch offene Anforderung wählen, die der MA erfüllen kann
    const openReqs = [...shift.requirements]
      .filter(
        (r) =>
          emp.competencyIds.has(r.competencyId) &&
          countFilledForCompetency(assignedThisShift, r.competencyId) <
            r.minCount,
      )
      .sort((a, b) => {
        const remainA =
          a.minCount - countFilledForCompetency(assignedThisShift, a.competencyId);
        const remainB =
          b.minCount - countFilledForCompetency(assignedThisShift, b.competencyId);
        if (remainA !== remainB) return remainB - remainA;
        return a.minCount - b.minCount;
      });
    const competencyId =
      openReqs[0]?.competencyId ??
      [...emp.competencyIds].find((cid) =>
        shift.requirements.some((r) => r.competencyId === cid),
      ) ??
      null;

    recordAssignment(emp, day, shift, competencyId);
    busySet(day).add(emp.id);
    assignedThisShift.set(emp.id, competencyId);
    dayAssignees(day).add(emp.id);
    fromBase += 1;
  }

  // —— 2) Fehlende Slots auffüllen ——
  for (const day of days) {
    const busyToday = busySet(day);
    const onDutyToday = pool.filter((e) => isDutyDay(e, day)).length;
    if (onDutyToday === 0 && shifts.some((s) => s.requirements.length > 0)) {
      warnings.push({
        date: dayKey(day),
        shiftTemplateId: shifts[0]?.id ?? "",
        shiftName: "Alle Schichten",
        competencyId: "",
        competencyName:
          "Kein Mitarbeiter im Dienst (vermutlich gleicher 4/4-Zyklusstart)",
        required: 1,
        assigned: 0,
      });
    }

    // Alle Schicht×Kompetenz-Bedarfe des Tages gemeinsam priorisieren,
    // damit z. B. Nacht-A1 nicht leer bleibt, während Tag alle Flexiblen nimmt.
    type FillJob = {
      shift: (typeof shifts)[number];
      req: (typeof shifts)[number]["requirements"][number];
    };
    const jobs: FillJob[] = [];
    for (const shift of shifts) {
      for (const req of shift.requirements) {
        jobs.push({ shift, req });
      }
    }
    jobs.sort((a, b) => {
      const matches = (job: FillJob, e: EmployeeWithSkills) =>
        canAssign(e, day, job.shift) && !busyToday.has(e.id);
      const availA = pool.filter(
        (e) => e.competencyIds.has(a.req.competencyId) && matches(a, e),
      ).length;
      const availB = pool.filter(
        (e) => e.competencyIds.has(b.req.competencyId) && matches(b, e),
      ).length;
      if (availA !== availB) return availA - availB;
      if (a.req.minCount !== b.req.minCount)
        return a.req.minCount - b.req.minCount;
      // Tag vor Nacht bei sonst gleichem Bedarf (sortOrder)
      if (a.shift.sortOrder !== b.shift.sortOrder)
        return a.shift.sortOrder - b.shift.sortOrder;
      return a.req.competency.name.localeCompare(b.req.competency.name, "de");
    });

    for (const { shift, req } of jobs) {
      const assignedThisShift = assignedMap(day, shift.id);
      let filled = countFilledForCompetency(
        assignedThisShift,
        req.competencyId,
      );

      const openOtherOnShift = () =>
        shift.requirements.filter(
          (r) =>
            r.competencyId !== req.competencyId &&
            countFilledForCompetency(assignedThisShift, r.competencyId) <
              r.minCount,
        );

      while (filled < req.minCount) {
        const baseFilter = (e: EmployeeWithSkills) =>
          e.competencyIds.has(req.competencyId) &&
          !busyToday.has(e.id) &&
          !assignedThisShift.has(e.id) &&
          canAssign(e, day, shift);

        const stillOpen = openOtherOnShift();
        function preferenceFit(e: EmployeeWithSkills): number {
          if (shift.kind === "DAY") {
            if (e.shiftPreference === "DAY_ONLY") return 0;
            if (e.shiftPreference === "ANY" || e.shiftPreference === "ROTATING")
              return 1;
            return 2;
          }
          if (shift.kind === "NIGHT") {
            if (e.shiftPreference === "NIGHT_ONLY") return 0;
            if (e.shiftPreference === "ANY" || e.shiftPreference === "ROTATING")
              return 1;
            return 2;
          }
          return 1;
        }
        const candidates = pool.filter(baseFilter).sort((a, b) => {
          const pa = preferenceFit(a);
          const pb = preferenceFit(b);
          if (pa !== pb) return pa - pb;
          const rareA = stillOpen.filter((r) =>
            a.competencyIds.has(r.competencyId),
          ).length;
          const rareB = stillOpen.filter((r) =>
            b.competencyIds.has(r.competencyId),
          ).length;
          if (rareA !== rareB) return rareA - rareB;
          const ca = continuityRank(a.id, day);
          const cb = continuityRank(b.id, day);
          if (ca !== cb) return ca - cb;
          const fa = fractionFilled(a, day);
          const fb = fractionFilled(b, day);
          if (fa !== fb) return fa - fb;
          return a.competencyIds.size - b.competencyIds.size;
        });

        if (candidates.length === 0) break;

        const pick = candidates[0];
        assignedThisShift.set(pick.id, req.competencyId);
        busyToday.add(pick.id);
        dayAssignees(day).add(pick.id);
        recordAssignment(pick, day, shift, req.competencyId);
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
  if (toCreate.length > 0) {
    await prisma.assignment.createMany({ data: toCreate });
  }

  return { created: toCreate.length, fromBase, warnings };
}

export async function getSchedule(startDate: string, endDate: string) {
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));

  const [assignments, absences, shifts, employees, competencies, baseEntries] =
    await Promise.all([
      prisma.assignment.findMany({
        where: {
          date: { gte: start, lte: addDays(end, 1) },
        },
        include: {
          employee: {
            include: { competencies: { include: { competency: true } } },
          },
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
      prisma.baseScheduleEntry.findMany({
        where: {
          date: { gte: start, lte: addDays(end, 1) },
        },
        include: {
          employee: true,
          shiftTemplate: true,
        },
      }),
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
    baseEntries: baseEntries.map((b) => ({
      ...b,
      date: dayKey(b.date),
    })),
    shifts,
    employees,
    competencies,
    days: eachDayOfInterval({ start, end }).map(dayKey),
    minRestHours: MIN_REST_HOURS,
  };
}

/**
 * Prüft, ob eine manuelle Zuweisung die Mindestruhezeit verletzt.
 * Gibt eine menschenlesbare Meldung zurück oder null wenn ok.
 */
export async function checkRestConflict(params: {
  employeeId: string;
  date: string;
  shiftTemplateId: string;
  excludeAssignmentId?: string;
}): Promise<string | null> {
  const day = startOfDay(parseISO(params.date));
  const shift = await prisma.shiftTemplate.findUnique({
    where: { id: params.shiftTemplateId },
  });
  if (!shift) return "Schichtvorlage nicht gefunden.";

  const { start: nextStart, end: nextEnd } = shiftDateTimeWindow(
    day,
    shift.startTime,
    shift.endTime,
  );

  const nearby = await prisma.assignment.findMany({
    where: {
      employeeId: params.employeeId,
      date: {
        gte: subDays(day, 2),
        lte: addDays(day, 2),
      },
      ...(params.excludeAssignmentId
        ? { id: { not: params.excludeAssignmentId } }
        : {}),
    },
    include: { shiftTemplate: true },
  });

  for (const a of nearby) {
    const win = shiftDateTimeWindow(
      a.date,
      a.shiftTemplate.startTime,
      a.shiftTemplate.endTime,
    );
    // Bestehende Schicht vor der neuen
    if (win.end <= nextStart) {
      if (!respectsMinRest(win.end, nextStart, MIN_REST_HOURS)) {
        return `Gesetzliche Ruhezeit unterschritten: nach Ende ${format(win.end, "dd.MM. HH:mm")} mindestens ${MIN_REST_HOURS} Stunden Pause nötig (Schichtbeginn ${format(nextStart, "dd.MM. HH:mm")}).`;
      }
    }
    // Neue Schicht vor der bestehenden
    if (nextEnd <= win.start) {
      if (!respectsMinRest(nextEnd, win.start, MIN_REST_HOURS)) {
        return `Gesetzliche Ruhezeit unterschritten: vor Beginn ${format(win.start, "dd.MM. HH:mm")} mindestens ${MIN_REST_HOURS} Stunden Pause nötig (Schichtende wäre ${format(nextEnd, "dd.MM. HH:mm")}).`;
      }
    }
  }

  return null;
}
