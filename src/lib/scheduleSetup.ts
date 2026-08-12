import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { prisma } from "./prisma";
import { weekStart, toISODate } from "./dates";

export const SETUP_DAY_COUNT = 14;
export const SETUP_START_KEY = "setup.startDate";
export const SETUP_DAY_COUNT_KEY = "setup.dayCount";

export type ScheduleSetup = {
  startDate: string;
  endDate: string;
  dayCount: number;
};

function dayKey(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Liest das Setup-Fenster (Standard: aktuelle ISO-Woche als Start, 14 Tage). */
export async function getSetup(): Promise<ScheduleSetup> {
  const stored = await getSetting(SETUP_START_KEY);
  const startDate = stored || toISODate(weekStart());
  const dayCount = SETUP_DAY_COUNT;
  await setSetting(SETUP_DAY_COUNT_KEY, String(dayCount));
  const start = startOfDay(parseISO(startDate));
  const endDate = dayKey(addDays(start, dayCount - 1));
  return { startDate, endDate, dayCount };
}

/** Setzt den Setup-Start (immer Montag-normalisiert optional vom Caller). */
export async function setSetup(startDate: string): Promise<ScheduleSetup> {
  const start = startOfDay(parseISO(startDate));
  const iso = dayKey(start);
  await setSetting(SETUP_START_KEY, iso);
  await setSetting(SETUP_DAY_COUNT_KEY, String(SETUP_DAY_COUNT));
  return getSetup();
}

export function setupBounds(setup: ScheduleSetup): { start: Date; end: Date } {
  const start = startOfDay(parseISO(setup.startDate));
  const end = startOfDay(parseISO(setup.endDate));
  return { start, end };
}

/**
 * Kopiert Zuweisungen des Setup-Fensters in den Ursprungsplan
 * (ersetzt bestehende Base-Einträge in diesem Fenster).
 */
export async function importAssignmentsToSetup(
  startDate?: string,
): Promise<{ imported: number; setup: ScheduleSetup }> {
  const setup = startDate ? await setSetup(startDate) : await getSetup();
  const { start, end } = setupBounds(setup);

  const assignments = await prisma.assignment.findMany({
    where: {
      date: { gte: start, lte: addDays(end, 1) },
    },
  });

  await prisma.baseScheduleEntry.deleteMany({
    where: {
      date: { gte: start, lte: addDays(end, 1) },
    },
  });

  const seen = new Set<string>();
  const data: {
    date: Date;
    shiftTemplateId: string;
    employeeId: string;
  }[] = [];

  for (const a of assignments) {
    const d = startOfDay(a.date);
    if (d < start || d > end) continue;
    const key = `${dayKey(d)}|${a.shiftTemplateId}|${a.employeeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    data.push({
      date: d,
      shiftTemplateId: a.shiftTemplateId,
      employeeId: a.employeeId,
    });
  }

  if (data.length > 0) {
    await prisma.baseScheduleEntry.createMany({ data });
  }

  return { imported: data.length, setup };
}

export type ApplySetupResult = {
  updated: number;
  skippedWeekdays: number;
  skippedNoShifts: number;
  warnings: string[];
  setup: ScheduleSetup;
  employees: {
    id: string;
    name: string;
    dutyCycleStartDate: string | null;
    shiftPreference: string;
    defaultShiftTemplateId: string | null;
  }[];
};

/**
 * Findet den besten 4-Tage-Block-Start im Setup:
 * bevorzugt Blöcke mit Länge 4; sonst den längsten; bei Gleichstand den frühesten.
 */
function deriveCycleStart(dutyDates: Date[]): Date | null {
  if (dutyDates.length === 0) return null;
  const sorted = [...dutyDates]
    .map((d) => startOfDay(d).getTime())
    .sort((a, b) => a - b);
  const unique = [...new Set(sorted)].map((t) => new Date(t));

  type Run = { start: Date; len: number };
  const runs: Run[] = [];
  let runStart = unique[0];
  let runLen = 1;

  for (let i = 1; i < unique.length; i++) {
    const gap = differenceInCalendarDays(unique[i], unique[i - 1]);
    if (gap === 1) {
      runLen += 1;
    } else {
      runs.push({ start: runStart, len: runLen });
      runStart = unique[i];
      runLen = 1;
    }
  }
  runs.push({ start: runStart, len: runLen });

  const exact4 = runs.filter((r) => r.len === 4);
  if (exact4.length > 0) return exact4[0].start;

  const atLeast4 = runs.filter((r) => r.len >= 4);
  if (atLeast4.length > 0) return atLeast4[0].start;

  runs.sort((a, b) => b.len - a.len || a.start.getTime() - b.start.getTime());
  return runs[0]?.start ?? null;
}

/**
 * Leitet aus dem Setup dutyCycleStartDate, shiftPreference und
 * defaultShiftTemplateId ab und schreibt sie auf die Mitarbeiter.
 */
export async function applySetupToDutyModels(
  startDate?: string,
): Promise<ApplySetupResult> {
  const setup = startDate ? await setSetup(startDate) : await getSetup();
  const { start, end } = setupBounds(setup);

  const [entries, employees, shifts] = await Promise.all([
    prisma.baseScheduleEntry.findMany({
      where: {
        date: { gte: start, lte: addDays(end, 1) },
      },
      include: { shiftTemplate: true },
    }),
    prisma.employee.findMany({ where: { active: true } }),
    prisma.shiftTemplate.findMany({ where: { active: true } }),
  ]);

  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const byEmployee = new Map<
    string,
    { dates: Date[]; shiftIds: string[]; kinds: ("DAY" | "NIGHT" | "INTERMEDIATE")[] }
  >();

  for (const e of entries) {
    const d = startOfDay(e.date);
    if (d < start || d > end) continue;
    const shift = shiftById.get(e.shiftTemplateId) ?? e.shiftTemplate;
    if (shift.kind === "INTERMEDIATE") continue;
    let bucket = byEmployee.get(e.employeeId);
    if (!bucket) {
      bucket = { dates: [], shiftIds: [], kinds: [] };
      byEmployee.set(e.employeeId, bucket);
    }
    bucket.dates.push(d);
    bucket.shiftIds.push(e.shiftTemplateId);
    bucket.kinds.push(shift.kind);
  }

  const warnings: string[] = [];
  const updatedEmployees: ApplySetupResult["employees"] = [];
  let updated = 0;
  let skippedWeekdays = 0;
  let skippedNoShifts = 0;

  for (const emp of employees) {
    if (emp.dutyModel === "WEEKDAYS") {
      skippedWeekdays += 1;
      continue;
    }

    const bucket = byEmployee.get(emp.id);
    if (!bucket || bucket.dates.length === 0) {
      skippedNoShifts += 1;
      continue;
    }

    const cycleStart = deriveCycleStart(bucket.dates);
    if (!cycleStart) {
      skippedNoShifts += 1;
      continue;
    }

    const dayCount = bucket.kinds.filter((k) => k === "DAY").length;
    const nightCount = bucket.kinds.filter((k) => k === "NIGHT").length;
    let shiftPreference: "DAY_ONLY" | "NIGHT_ONLY" | "ANY" = "ANY";
    if (dayCount > 0 && nightCount === 0) shiftPreference = "DAY_ONLY";
    else if (nightCount > 0 && dayCount === 0) shiftPreference = "NIGHT_ONLY";
    else shiftPreference = "ANY";

    const freq = new Map<string, number>();
    for (const id of bucket.shiftIds) {
      freq.set(id, (freq.get(id) ?? 0) + 1);
    }
    let defaultShiftTemplateId: string | null = null;
    let best = 0;
    for (const [id, n] of freq) {
      if (n > best) {
        best = n;
        defaultShiftTemplateId = id;
      }
    }

    const uniqueDays = new Set(bucket.dates.map((d) => dayKey(d))).size;
    if (uniqueDays < 4) {
      warnings.push(
        `${emp.name}: nur ${uniqueDays} Diensttage im Setup – 4/4-Zyklus ggf. ungenau.`,
      );
    }

    await prisma.employee.update({
      where: { id: emp.id },
      data: {
        dutyModel: emp.dutyModel === "CUSTOM" ? "CUSTOM" : "ROTATION_4_4",
        dutyOnDays: emp.dutyOnDays || 4,
        dutyOffDays: emp.dutyOffDays || 4,
        dutyCycleStartDate: cycleStart,
        shiftPreference,
        defaultShiftTemplateId,
      },
    });

    updated += 1;
    updatedEmployees.push({
      id: emp.id,
      name: emp.name,
      dutyCycleStartDate: dayKey(cycleStart),
      shiftPreference,
      defaultShiftTemplateId,
    });
  }

  return {
    updated,
    skippedWeekdays,
    skippedNoShifts,
    warnings,
    setup,
    employees: updatedEmployees,
  };
}

/** Setup-Tage als ISO-Liste. */
export function setupDayKeys(setup: ScheduleSetup): string[] {
  const { start, end } = setupBounds(setup);
  return eachDayOfInterval({ start, end }).map(dayKey);
}
