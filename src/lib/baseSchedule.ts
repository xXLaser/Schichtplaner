import {
  addDays,
  eachDayOfInterval,
  format,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { prisma } from "./prisma";
import {
  isDutyDay,
  preferredShiftForEmployee,
  respectsMinRest,
  shiftDateTimeWindow,
  shiftMatchesDutyModel,
  type DutyModelConfig,
} from "./dutyModel";
import { MIN_REST_HOURS } from "./dutyModel";
import { getSetup } from "./scheduleSetup";

function dayKey(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

/**
 * Schlägt Ursprungsdienstplan-Einträge aus den Dienstmodellen vor.
 * Überschreibt optional bestehende Einträge im Zeitraum.
 */
export async function suggestBaseSchedule(
  startDate: string,
  endDate: string,
  options?: { replaceExisting?: boolean },
): Promise<{ created: number }> {
  const replaceExisting = options?.replaceExisting ?? true;
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));
  const days = eachDayOfInterval({ start, end });

  const [employees, shifts] = await Promise.all([
    prisma.employee.findMany({ where: { active: true } }),
    prisma.shiftTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (replaceExisting) {
    await prisma.baseScheduleEntry.deleteMany({
      where: {
        date: { gte: start, lte: addDays(end, 1) },
      },
    });
  }

  const lastEnd = new Map<string, Date>();
  // Vorherige Base-Einträge für Ruhezeit
  const prior = await prisma.baseScheduleEntry.findMany({
    where: {
      date: { gte: subDays(start, 2), lt: start },
    },
    include: { shiftTemplate: true },
  });
  for (const p of prior) {
    const { end: endAt } = shiftDateTimeWindow(
      p.date,
      p.shiftTemplate.startTime,
      p.shiftTemplate.endTime,
    );
    const prev = lastEnd.get(p.employeeId);
    if (!prev || endAt > prev) lastEnd.set(p.employeeId, endAt);
  }

  const toCreate: {
    date: Date;
    shiftTemplateId: string;
    employeeId: string;
  }[] = [];

  for (const day of days) {
    for (const emp of employees) {
      const cfg: DutyModelConfig = {
        employmentType: emp.employmentType,
        dutyModel: emp.dutyModel,
        dutyOnDays: emp.dutyOnDays,
        dutyOffDays: emp.dutyOffDays,
        dutyCycleStartDate: emp.dutyCycleStartDate,
        allowFifthShiftPerMonth: emp.allowFifthShiftPerMonth,
        partTimeStartTime: emp.partTimeStartTime,
        partTimeEndTime: emp.partTimeEndTime,
        workWeekdays: emp.workWeekdays,
        allowIntermediateShifts: emp.allowIntermediateShifts,
        defaultShiftTemplateId: emp.defaultShiftTemplateId,
        maxShifts: emp.maxShifts,
      };

      if (!isDutyDay(cfg, day)) continue;

      const shift = preferredShiftForEmployee(
        {
          ...cfg,
          shiftPreference: emp.shiftPreference,
          rotationWeeks: emp.rotationWeeks,
          rotationStartDate: emp.rotationStartDate,
          rotationStartKind: emp.rotationStartKind,
        },
        shifts,
        day,
      );
      if (!shift || !shiftMatchesDutyModel(cfg, shift)) continue;

      const { start: startAt, end: endAt } = shiftDateTimeWindow(
        day,
        shift.startTime,
        shift.endTime,
      );
      if (!respectsMinRest(lastEnd.get(emp.id), startAt, MIN_REST_HOURS)) {
        continue;
      }

      toCreate.push({
        date: day,
        shiftTemplateId: shift.id,
        employeeId: emp.id,
      });
      lastEnd.set(emp.id, endAt);
    }
  }

  if (toCreate.length > 0) {
    await prisma.baseScheduleEntry.createMany({ data: toCreate });
  }

  return { created: toCreate.length };
}

export async function getBaseSchedule(startDate: string, endDate: string) {
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));
  const setup = await getSetup();

  const [entries, shifts, employees] = await Promise.all([
    prisma.baseScheduleEntry.findMany({
      where: { date: { gte: start, lte: addDays(end, 1) } },
      include: {
        employee: true,
        shiftTemplate: true,
      },
      orderBy: [{ date: "asc" }],
    }),
    prisma.shiftTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    entries: entries.map((e) => ({ ...e, date: dayKey(e.date) })),
    shifts,
    employees,
    days: eachDayOfInterval({ start, end }).map(dayKey),
    minRestHours: MIN_REST_HOURS,
    setup,
  };
}
