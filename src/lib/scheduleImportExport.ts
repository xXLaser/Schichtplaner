import { parseISO, startOfDay } from "date-fns";
import { prisma } from "./prisma";

export type ScheduleExportRow = {
  date: string;
  shiftName: string;
  employeeName: string;
  competencyName?: string | null;
};

export type ScheduleExport = {
  version: 1;
  exportedAt: string;
  type: "assignments" | "base";
  from: string;
  to: string;
  rows: ScheduleExportRow[];
};

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function scheduleToCsv(data: ScheduleExport): string {
  const header = "Datum,Schicht,Mitarbeiter,Kompetenz";
  const lines = data.rows.map(
    (r) =>
      `${escapeCsv(r.date)},${escapeCsv(r.shiftName)},${escapeCsv(r.employeeName)},${escapeCsv(r.competencyName ?? "")}`,
  );
  return [header, ...lines].join("\n");
}

export function parseCsvSchedule(text: string): ScheduleExportRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = header.findIndex((h) => h.includes("datum") || h === "date");
  const shiftIdx = header.findIndex((h) => h.includes("schicht") || h === "shift");
  const empIdx = header.findIndex(
    (h) => h.includes("mitarbeiter") || h.includes("employee") || h === "name",
  );
  const compIdx = header.findIndex(
    (h) => h.includes("kompetenz") || h.includes("competency"),
  );

  if (dateIdx < 0 || shiftIdx < 0 || empIdx < 0) {
    throw new Error(
      "CSV muss Spalten Datum, Schicht und Mitarbeiter enthalten.",
    );
  }

  const rows: ScheduleExportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const date = cols[dateIdx];
    const shiftName = cols[shiftIdx];
    const employeeName = cols[empIdx];
    if (!date || !shiftName || !employeeName) continue;
    rows.push({
      date,
      shiftName,
      employeeName,
      competencyName: compIdx >= 0 ? cols[compIdx] || null : null,
    });
  }
  return rows;
}

async function resolveIds(rows: ScheduleExportRow[]) {
  const [employees, shifts, competencies] = await Promise.all([
    prisma.employee.findMany({ where: { active: true } }),
    prisma.shiftTemplate.findMany({ where: { active: true } }),
    prisma.competency.findMany(),
  ]);

  const empByName = new Map(
    employees.map((e) => [e.name.toLowerCase(), e.id]),
  );
  const shiftByName = new Map(
    shifts.map((s) => [s.name.toLowerCase(), s.id]),
  );
  const compByName = new Map(
    competencies.map((c) => [c.name.toLowerCase(), c.id]),
  );

  const warnings: string[] = [];
  const resolved: {
    date: Date;
    shiftTemplateId: string;
    employeeId: string;
    competencyId: string | null;
  }[] = [];

  for (const row of rows) {
    const employeeId = empByName.get(row.employeeName.toLowerCase());
    const shiftTemplateId = shiftByName.get(row.shiftName.toLowerCase());
    if (!employeeId) {
      warnings.push(`Mitarbeiter nicht gefunden: ${row.employeeName}`);
      continue;
    }
    if (!shiftTemplateId) {
      warnings.push(`Schicht nicht gefunden: ${row.shiftName}`);
      continue;
    }
    let competencyId: string | null = null;
    if (row.competencyName) {
      competencyId = compByName.get(row.competencyName.toLowerCase()) ?? null;
      if (!competencyId) {
        warnings.push(`Kompetenz nicht gefunden: ${row.competencyName}`);
      }
    }
    resolved.push({
      date: startOfDay(parseISO(row.date)),
      shiftTemplateId,
      employeeId,
      competencyId,
    });
  }

  return { resolved, warnings };
}

export async function exportAssignments(
  from: string,
  to: string,
): Promise<ScheduleExport> {
  const start = startOfDay(parseISO(from));
  const end = startOfDay(parseISO(to));

  const assignments = await prisma.assignment.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      employee: true,
      shiftTemplate: true,
    },
    orderBy: [{ date: "asc" }],
  });

  const compIds = [
    ...new Set(
      assignments
        .map((a) => a.competencyId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const comps = compIds.length
    ? await prisma.competency.findMany({ where: { id: { in: compIds } } })
    : [];
  const compMap = new Map(comps.map((c) => [c.id, c.name]));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    type: "assignments",
    from,
    to,
    rows: assignments.map((a) => ({
      date: a.date.toISOString().slice(0, 10),
      shiftName: a.shiftTemplate.name,
      employeeName: a.employee.name,
      competencyName: a.competencyId
        ? (compMap.get(a.competencyId) ?? null)
        : null,
    })),
  };
}

export async function exportBaseSchedule(
  from: string,
  to: string,
): Promise<ScheduleExport> {
  const start = startOfDay(parseISO(from));
  const end = startOfDay(parseISO(to));

  const entries = await prisma.baseScheduleEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: { employee: true, shiftTemplate: true },
    orderBy: [{ date: "asc" }],
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    type: "base",
    from,
    to,
    rows: entries.map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      shiftName: e.shiftTemplate.name,
      employeeName: e.employee.name,
    })),
  };
}

export async function importAssignments(
  rows: ScheduleExportRow[],
  options?: { replaceRange?: boolean; from?: string; to?: string },
) {
  const { resolved, warnings } = await resolveIds(rows);
  if (resolved.length === 0) {
    return { imported: 0, warnings };
  }

  if (options?.replaceRange && options.from && options.to) {
    const start = startOfDay(parseISO(options.from));
    const end = startOfDay(parseISO(options.to));
    await prisma.assignment.deleteMany({
      where: { date: { gte: start, lte: end } },
    });
  }

  let imported = 0;
  for (const row of resolved) {
    try {
      await prisma.assignment.create({ data: row });
      imported += 1;
    } catch {
      // Duplikat oder Constraint – überspringen
    }
  }

  return { imported, warnings };
}

export async function importBaseSchedule(
  rows: ScheduleExportRow[],
  options?: { replaceRange?: boolean; from?: string; to?: string },
) {
  const { resolved, warnings } = await resolveIds(rows);
  if (resolved.length === 0) {
    return { imported: 0, warnings };
  }

  if (options?.replaceRange && options.from && options.to) {
    const start = startOfDay(parseISO(options.from));
    const end = startOfDay(parseISO(options.to));
    await prisma.baseScheduleEntry.deleteMany({
      where: { date: { gte: start, lte: end } },
    });
  }

  let imported = 0;
  for (const row of resolved) {
    try {
      await prisma.baseScheduleEntry.create({
        data: {
          date: row.date,
          shiftTemplateId: row.shiftTemplateId,
          employeeId: row.employeeId,
        },
      });
      imported += 1;
    } catch {
      // Duplikat – überspringen
    }
  }

  return { imported, warnings };
}
