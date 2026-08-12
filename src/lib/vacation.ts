import {
  addDays,
  eachDayOfInterval,
  format,
  getDay,
  isWeekend,
  parseISO,
  startOfDay,
  startOfYear,
  endOfYear,
  differenceInCalendarDays,
} from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "./prisma";

export type VacationBudget = {
  employeeId: string;
  name: string;
  vacationDaysPerYear: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
};

export type VacationOverlapDay = {
  date: string;
  count: number;
  names: string[];
  warning: boolean;
};

export type VacationEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  status: string;
  note: string | null;
  days: number;
};

function dayKey(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

/** Werktage (Mo–Fr) im Zeitraum, inkl. Start und Ende */
export function countVacationDays(startIso: string, endIso: string): number {
  const start = startOfDay(parseISO(startIso));
  const end = startOfDay(parseISO(endIso));
  if (end < start) return 0;
  let count = 0;
  for (const d of eachDayOfInterval({ start, end })) {
    if (!isWeekend(d)) count += 1;
  }
  return count;
}

export async function getVacationPlanner(year: number) {
  const from = startOfYear(new Date(year, 0, 1));
  const to = endOfYear(new Date(year, 0, 1));

  const [employees, vacations] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      include: { competencies: { include: { competency: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.absence.findMany({
      where: {
        type: "VACATION",
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: to },
        endDate: { gte: from },
      },
      include: { employee: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const budgets: VacationBudget[] = employees.map((e) => {
    const mine = vacations.filter((v) => v.employeeId === e.id);
    const usedDays = mine
      .filter((v) => v.status === "APPROVED")
      .reduce(
        (sum, v) =>
          sum + countVacationDays(dayKey(v.startDate), dayKey(v.endDate)),
        0,
      );
    const pendingDays = mine
      .filter((v) => v.status === "PENDING")
      .reduce(
        (sum, v) =>
          sum + countVacationDays(dayKey(v.startDate), dayKey(v.endDate)),
        0,
      );
    return {
      employeeId: e.id,
      name: e.name,
      vacationDaysPerYear: e.vacationDaysPerYear,
      usedDays,
      pendingDays,
      remainingDays: e.vacationDaysPerYear - usedDays - pendingDays,
    };
  });

  const entries: VacationEntry[] = vacations.map((v) => ({
    id: v.id,
    employeeId: v.employeeId,
    employeeName: v.employee.name,
    startDate: dayKey(v.startDate),
    endDate: dayKey(v.endDate),
    status: v.status,
    note: v.note,
    days: countVacationDays(dayKey(v.startDate), dayKey(v.endDate)),
  }));

  // Overlap calendar for the year (or at least days with vacations)
  const overlapMap = new Map<string, string[]>();
  for (const v of vacations) {
    const start = startOfDay(v.startDate) < from ? from : startOfDay(v.startDate);
    const end = startOfDay(v.endDate) > to ? to : startOfDay(v.endDate);
    for (const d of eachDayOfInterval({ start, end })) {
      if (isWeekend(d)) continue;
      const key = dayKey(d);
      const list = overlapMap.get(key) ?? [];
      list.push(v.employee.name);
      overlapMap.set(key, list);
    }
  }

  const maxSimultaneous = Math.max(2, Math.ceil(employees.length * 0.3));
  const overlaps: VacationOverlapDay[] = [...overlapMap.entries()]
    .map(([date, names]) => ({
      date,
      count: names.length,
      names,
      warning: names.length >= maxSimultaneous,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Month grid helper data: list of months with vacation bars
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(year, i, 1);
    const label = format(monthStart, "MMMM", { locale: de });
    const monthEntries = entries.filter((e) => {
      const s = parseISO(e.startDate);
      const en = parseISO(e.endDate);
      const mStart = new Date(year, i, 1);
      const mEnd = new Date(year, i + 1, 0);
      return s <= mEnd && en >= mStart;
    });
    return { month: i + 1, label, entries: monthEntries };
  });

  return {
    year,
    budgets,
    entries,
    overlaps,
    months,
    maxSimultaneous,
    employeeCount: employees.length,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      vacationDaysPerYear: e.vacationDaysPerYear,
      competencies: e.competencies.map((c) => c.competency),
    })),
  };
}

export function calendarDaysOfMonth(year: number, month: number) {
  // month 1-12
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const days = eachDayOfInterval({ start, end });
  // Pad week start Monday
  const pad = (getDay(start) + 6) % 7;
  return { days: days.map(dayKey), pad, endDay: differenceInCalendarDays(end, start) + 1 };
}

export { dayKey, addDays };
