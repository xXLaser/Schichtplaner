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
import { fillPriority, type StaffRole } from "./staffRules";
import { getAppConfig } from "./appConfig";
import { holidaysInRange } from "./holidays";

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
  staffRole: StaffRole;
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
  staffRole?: StaffRole | null;
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
    staffRole: e.staffRole ?? "OPERATOR",
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

  /** Einmalig alle Zuweisungen der relevanten Perioden einlesen. */
  seed(
    rows: {
      employeeId: string;
      date: Date;
      startTime: string;
      endTime: string;
    }[],
    employees: EmployeeWithSkills[],
  ) {
    const byId = new Map(employees.map((e) => [e.id, e]));
    for (const row of rows) {
      const emp = byId.get(row.employeeId);
      if (!emp) continue;
      const hours = shiftDurationHours(row.startTime, row.endTime);
      const periodKey = periodKeyFor(row.date, emp.hoursPeriod);
      const key = this.cacheKey(emp.id, periodKey);
      this.cache.set(key, (this.cache.get(key) ?? 0) + hours);
    }
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

  const hoursLookback = new Date(start.getFullYear(), start.getMonth() - 3, 1);

  const [employees, absences, shifts, baseEntries, priorAssignments, hoursRows] =
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
      prisma.assignment.findMany({
        where: {
          date: {
            gte: subDays(start, 2),
            lt: start,
          },
        },
        include: { shiftTemplate: true },
      }),
      prisma.assignment.findMany({
        where: {
          date: { gte: hoursLookback, lt: start },
        },
        include: {
          shiftTemplate: { select: { startTime: true, endTime: true } },
        },
      }),
    ]);

  const pool: EmployeeWithSkills[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    ...toDutyConfig(e),
    staffRole: (e.staffRole as StaffRole) ?? "OPERATOR",
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
  /** Letzte Schichtart je Mitarbeiter (durchgehende Blöcke). */
  const lastKind = new Map<string, ShiftKind>();

  for (const e of pool) assignmentCount.set(e.id, 0);

  // Vorperioden-Zuweisungen für Ruhezeit initialisieren
  for (const a of priorAssignments) {
    const { end: endAt } = shiftDateTimeWindow(
      a.date,
      a.shiftTemplate.startTime,
      a.shiftTemplate.endTime,
    );
    const prev = lastEnd.get(a.employeeId);
    if (!prev || endAt > prev) {
      lastEnd.set(a.employeeId, endAt);
      lastKind.set(a.employeeId, a.shiftTemplate.kind);
    }
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
  hoursTracker.seed(
    hoursRows.map((a) => ({
      employeeId: a.employeeId,
      date: a.date,
      startTime: a.shiftTemplate.startTime,
      endTime: a.shiftTemplate.endTime,
    })),
    pool,
  );

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
    shift: { id: string; startTime: string; endTime: string; kind: ShiftKind },
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
    lastKind.set(emp.id, shift.kind);
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
  /** Bevorzugt durchgehende Einteilung im Dienstblock (Vortag schon Dienst, gleiche Art). */
  function continuityRank(empId: string, day: Date, kind?: ShiftKind): number {
    const prev = dayAssignees(subDays(day, 1));
    const prevKind = lastKind.get(empId);
    if (prev.has(empId) && kind && prevKind === kind) return 0;
    if (prev.has(empId) && kind && prevKind && prevKind !== kind) return 3;
    if (prev.has(empId)) return 1;
    if (kind && prevKind === kind) return 1;
    return 2;
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
      const priA = fillPriority(a.shift);
      const priB = fillPriority(b.shift);
      if (priA !== priB) return priA - priB;
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
        function roleFit(e: EmployeeWithSkills): number {
          if (shift.kind === "INTERMEDIATE") {
            return e.staffRole === "TEAM_LEAD" ? 0 : 2;
          }
          if (e.staffRole === "PART_TIME" || e.dutyModel === "WEEKDAYS") {
            return 0;
          }
          if (e.staffRole === "TEAM_LEAD") return 3;
          return 1;
        }
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
          const ra = roleFit(a);
          const rb = roleFit(b);
          if (ra !== rb) return ra - rb;
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
          const ca = continuityRank(a.id, day, shift.kind);
          const cb = continuityRank(b.id, day, shift.kind);
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

    // Untertags immer eine Teilzeitkraft, sofern eine verfügbar ist.
    const partTimeShift =
      shifts.find(
        (s) =>
          s.startTime === "09:00" &&
          s.endTime === "15:00" &&
          s.kind === "DAY",
      ) ?? shifts.find((s) => s.kind === "DAY" && s.name.toLowerCase().includes("teilzeit"));
    if (partTimeShift) {
      const assignedPt = assignedMap(day, partTimeShift.id);
      const alreadyHasPt = [...assignedPt.keys()].some((id) => {
        const emp = poolById.get(id);
        return emp && (emp.staffRole === "PART_TIME" || emp.dutyModel === "WEEKDAYS");
      });
      const anyDayHasPt = shifts.some((s) => {
        if (s.kind === "NIGHT" || s.kind === "INTERMEDIATE") return false;
        return [...assignedMap(day, s.id).keys()].some((id) => {
          const emp = poolById.get(id);
          return emp && (emp.staffRole === "PART_TIME" || emp.dutyModel === "WEEKDAYS");
        });
      });
      if (!alreadyHasPt && !anyDayHasPt) {
        const pt = pool
          .filter(
            (e) =>
              (e.staffRole === "PART_TIME" || e.dutyModel === "WEEKDAYS") &&
              !busyToday.has(e.id) &&
              canAssign(e, day, partTimeShift),
          )
          .sort((a, b) => fractionFilled(a, day) - fractionFilled(b, day))[0];
        if (pt) {
          const req =
            partTimeShift.requirements.find((r) =>
              pt.competencyIds.has(r.competencyId),
            ) ?? partTimeShift.requirements[0];
          assignedMap(day, partTimeShift.id).set(pt.id, req?.competencyId ?? null);
          busyToday.add(pt.id);
          dayAssignees(day).add(pt.id);
          recordAssignment(pt, day, partTimeShift, req?.competencyId ?? null);
        } else {
          warnings.push({
            date: dayKey(day),
            shiftTemplateId: partTimeShift.id,
            shiftName: partTimeShift.name,
            competencyId: "",
            competencyName: "Teilzeit untertags",
            required: 1,
            assigned: 0,
          });
        }
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
  const config = getAppConfig();

  const [assignments, absences, shifts, employees, competencies, baseEntries, holidaySetting] =
    await Promise.all([
      prisma.assignment.findMany({
        where: {
          date: { gte: start, lte: addDays(end, 1) },
        },
        include: {
          employee: { select: { id: true, name: true } },
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
        include: { employee: { select: { id: true, name: true } } },
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
          employee: { select: { id: true, name: true } },
          shiftTemplate: true,
        },
      }),
      prisma.appSetting.findUnique({ where: { key: "holiday.region" } }),
    ]);

  const empSkills = new Map(
    employees.map((e) => [
      e.id,
      e.competencies.map((c) => ({ competency: c.competency })),
    ]),
  );

  return {
    assignments: assignments.map((a) => ({
      id: a.id,
      date: dayKey(a.date),
      shiftTemplateId: a.shiftTemplateId,
      employeeId: a.employeeId,
      competencyId: a.competencyId,
      employee: {
        id: a.employee.id,
        name: a.employee.name,
        competencies: empSkills.get(a.employeeId) ?? [],
      },
      shiftTemplate: a.shiftTemplate,
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
    holidays: holidaysInRange(
      start,
      end,
      holidaySetting?.value === "DE" ? "DE" : config.holidayRegion,
    ),
    minRestHours: MIN_REST_HOURS,
    planningDays: config.planningDays,
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
