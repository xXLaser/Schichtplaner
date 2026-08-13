import { addDays, format, parseISO, startOfDay } from "date-fns";
import { prisma } from "./prisma";

export const SCHEDULE_EXPORT_VERSION = 1;

export type ScheduleExport = {
  version: number;
  exportedAt?: string;
  from: string;
  to: string;
  assignments: {
    date: string;
    employeeName: string;
    employeeId: string;
    shiftName: string;
    shiftTemplateId: string;
    competencyId?: string | null;
  }[];
  absences?: {
    employeeName: string;
    type: string;
    startDate: string;
    endDate: string;
    note?: string | null;
  }[];
};

function dayKey(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

export async function exportSchedule(
  from: string,
  to: string,
  options?: { includeAbsences?: boolean },
): Promise<ScheduleExport> {
  const start = startOfDay(parseISO(from));
  const end = startOfDay(parseISO(to));

  const assignments = await prisma.assignment.findMany({
    where: { date: { gte: start, lte: addDays(end, 1) } },
    include: { employee: true, shiftTemplate: true },
    orderBy: [{ date: "asc" }],
  });

  const payload: ScheduleExport = {
    version: SCHEDULE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    from: dayKey(start),
    to: dayKey(end),
    assignments: assignments
      .filter((a) => {
        const d = startOfDay(a.date);
        return d >= start && d <= end;
      })
      .map((a) => ({
        date: dayKey(a.date),
        employeeName: a.employee.name,
        employeeId: a.employeeId,
        shiftName: a.shiftTemplate.name,
        shiftTemplateId: a.shiftTemplateId,
        competencyId: a.competencyId,
      })),
  };

  if (options?.includeAbsences) {
    const absences = await prisma.absence.findMany({
      where: { startDate: { lte: end }, endDate: { gte: start } },
      include: { employee: true },
    });
    payload.absences = absences.map((a) => ({
      employeeName: a.employee.name,
      type: a.type,
      startDate: dayKey(a.startDate),
      endDate: dayKey(a.endDate),
      note: a.note,
    }));
  }

  return payload;
}

export function scheduleToCsv(data: ScheduleExport): string {
  const header = "Datum;Schicht;Mitarbeiter";
  const lines = data.assignments.map(
    (a) => `${a.date};${csvCell(a.shiftName)};${csvCell(a.employeeName)}`,
  );
  return [header, ...lines].join("\r\n");
}

function csvCell(value: string): string {
  if (/[;"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Importiert Zuweisungen. Personen und Schichten werden zuerst per ID,
 * sonst per Name zugeordnet. Fehlende Namen werden übersprungen.
 */
export async function importSchedule(
  data: ScheduleExport,
  options?: { replaceExisting?: boolean },
): Promise<ImportResult> {
  if (!data || data.version !== SCHEDULE_EXPORT_VERSION) {
    throw new Error("Ungültiges oder unbekanntes Export-Format.");
  }
  if (!data.from || !data.to || !Array.isArray(data.assignments)) {
    throw new Error("Export enthält keinen Zeitraum bzw. keine Zuweisungen.");
  }

  const start = startOfDay(parseISO(data.from));
  const end = startOfDay(parseISO(data.to));
  const [employees, shifts] = await Promise.all([
    prisma.employee.findMany(),
    prisma.shiftTemplate.findMany(),
  ]);

  const empById = new Map(employees.map((e) => [e.id, e]));
  const empByName = new Map(employees.map((e) => [normalizeName(e.name), e]));
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const shiftByName = new Map(shifts.map((s) => [normalizeName(s.name), s]));

  if (options?.replaceExisting ?? true) {
    await prisma.assignment.deleteMany({
      where: { date: { gte: start, lte: addDays(end, 1) } },
    });
  }

  const seen = new Set<string>();
  const toCreate: {
    date: Date;
    shiftTemplateId: string;
    employeeId: string;
    competencyId: string | null;
  }[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const row of data.assignments) {
    const day = startOfDay(parseISO(row.date));
    if (Number.isNaN(day.getTime())) {
      skipped += 1;
      errors.push(`Ungültiges Datum: ${row.date}`);
      continue;
    }
    const emp =
      empById.get(row.employeeId) ||
      empByName.get(normalizeName(row.employeeName));
    const shift =
      shiftById.get(row.shiftTemplateId) ||
      shiftByName.get(normalizeName(row.shiftName));
    if (!emp) {
      skipped += 1;
      errors.push(`Mitarbeiter nicht gefunden: ${row.employeeName}`);
      continue;
    }
    if (!shift) {
      skipped += 1;
      errors.push(`Schicht nicht gefunden: ${row.shiftName}`);
      continue;
    }
    const key = `${dayKey(day)}|${shift.id}|${emp.id}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    toCreate.push({
      date: day,
      shiftTemplateId: shift.id,
      employeeId: emp.id,
      competencyId: row.competencyId ?? null,
    });
  }

  if (toCreate.length > 0) {
    await prisma.assignment.createMany({ data: toCreate });
  }

  return { imported: toCreate.length, skipped, errors: errors.slice(0, 20) };
}
