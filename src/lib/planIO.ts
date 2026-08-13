import { addDays, parseISO, startOfDay } from "date-fns";
import { prisma } from "./prisma";

export type PlanExportPayload = {
  version: 1;
  exportedAt: string;
  from: string;
  to: string;
  source: "assignments" | "base";
  shifts: {
    name: string;
    startTime: string;
    endTime: string;
    kind: string;
    color: string;
    sortOrder: number;
  }[];
  employees: { name: string }[];
  entries: {
    date: string;
    employeeName: string;
    shiftName: string;
    competencyName?: string | null;
    note?: string | null;
  }[];
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function exportPlan(params: {
  from: string;
  to: string;
  source?: "assignments" | "base";
}): Promise<PlanExportPayload> {
  const source = params.source ?? "assignments";
  const start = startOfDay(parseISO(params.from));
  const end = startOfDay(parseISO(params.to));

  const [shifts, employees] = await Promise.all([
    prisma.shiftTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const competencyById = new Map(
    (await prisma.competency.findMany()).map((c) => [c.id, c.name]),
  );

  let entries: PlanExportPayload["entries"] = [];

  if (source === "base") {
    const rows = await prisma.baseScheduleEntry.findMany({
      where: { date: { gte: start, lte: addDays(end, 1) } },
      include: { employee: true, shiftTemplate: true },
      orderBy: [{ date: "asc" }],
    });
    entries = rows.map((r) => ({
      date: dayKey(r.date),
      employeeName: r.employee.name,
      shiftName: r.shiftTemplate.name,
      note: r.note,
    }));
  } else {
    const rows = await prisma.assignment.findMany({
      where: { date: { gte: start, lte: addDays(end, 1) } },
      include: { employee: true, shiftTemplate: true },
      orderBy: [{ date: "asc" }],
    });
    entries = rows.map((r) => ({
      date: dayKey(r.date),
      employeeName: r.employee.name,
      shiftName: r.shiftTemplate.name,
      competencyName: r.competencyId
        ? (competencyById.get(r.competencyId) ?? null)
        : null,
    }));
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    from: params.from,
    to: params.to,
    source,
    shifts: shifts.map((s) => ({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      kind: s.kind,
      color: s.color,
      sortOrder: s.sortOrder,
    })),
    employees: employees.map((e) => ({ name: e.name })),
    entries,
  };
}

export type PlanImportResult = {
  created: number;
  skipped: number;
  createdEmployees: number;
  createdShifts: number;
  warnings: string[];
};

/**
 * Importiert einen exportierten Dienstplan.
 * Fehlende Mitarbeiter/Schichten werden optional angelegt (nur Name/Basiszeiten).
 */
export async function importPlan(
  payload: PlanExportPayload,
  options?: {
    target?: "assignments" | "base";
    replaceRange?: boolean;
    createMissing?: boolean;
  },
): Promise<PlanImportResult> {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.entries)) {
    throw new Error("Ungültiges Importformat (version 1 erwartet).");
  }

  const target = options?.target ?? payload.source ?? "assignments";
  const createMissing = options?.createMissing ?? true;
  const replaceRange = options?.replaceRange ?? true;
  const warnings: string[] = [];

  let createdEmployees = 0;
  let createdShifts = 0;

  // Schichten sicherstellen
  const shiftByName = new Map(
    (await prisma.shiftTemplate.findMany()).map((s) => [s.name.toLowerCase(), s]),
  );
  for (const s of payload.shifts ?? []) {
    const key = s.name.toLowerCase();
    if (!shiftByName.has(key) && createMissing) {
      const created = await prisma.shiftTemplate.create({
        data: {
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
          kind: (s.kind as "DAY" | "NIGHT" | "INTERMEDIATE") || "DAY",
          color: s.color || "#334155",
          sortOrder: s.sortOrder ?? 0,
        },
      });
      shiftByName.set(key, created);
      createdShifts += 1;
    }
  }

  // Mitarbeiter sicherstellen
  const empByName = new Map(
    (await prisma.employee.findMany()).map((e) => [e.name.toLowerCase(), e]),
  );
  for (const e of payload.employees ?? []) {
    const key = e.name.toLowerCase();
    if (!empByName.has(key) && createMissing) {
      const created = await prisma.employee.create({
        data: { name: e.name },
      });
      empByName.set(key, created);
      createdEmployees += 1;
    }
  }

  // Auch Eintragsnamen ohne employees[] abdecken
  for (const entry of payload.entries) {
    const ek = entry.employeeName.toLowerCase();
    if (!empByName.has(ek) && createMissing) {
      const created = await prisma.employee.create({ data: { name: entry.employeeName } });
      empByName.set(ek, created);
      createdEmployees += 1;
    }
    const sk = entry.shiftName.toLowerCase();
    if (!shiftByName.has(sk) && createMissing) {
      const created = await prisma.shiftTemplate.create({
        data: {
          name: entry.shiftName,
          startTime: "06:00",
          endTime: "18:00",
          kind: "DAY",
        },
      });
      shiftByName.set(sk, created);
      createdShifts += 1;
      warnings.push(`Schicht "${entry.shiftName}" ohne Zeiten angelegt (06–18).`);
    }
  }

  const dates = payload.entries.map((e) => e.date).filter(Boolean).sort();
  if (replaceRange && dates.length > 0) {
    const from = startOfDay(parseISO(dates[0]));
    const to = startOfDay(parseISO(dates[dates.length - 1]));
    if (target === "base") {
      await prisma.baseScheduleEntry.deleteMany({
        where: { date: { gte: from, lte: addDays(to, 1) } },
      });
    } else {
      await prisma.assignment.deleteMany({
        where: { date: { gte: from, lte: addDays(to, 1) } },
      });
    }
  }

  const competencies = await prisma.competency.findMany();
  const compByName = new Map(competencies.map((c) => [c.name.toLowerCase(), c.id]));

  let created = 0;
  let skipped = 0;

  for (const entry of payload.entries) {
    const emp = empByName.get(entry.employeeName.toLowerCase());
    const shift = shiftByName.get(entry.shiftName.toLowerCase());
    if (!emp || !shift) {
      skipped += 1;
      warnings.push(
        `Übersprungen: ${entry.date} ${entry.employeeName} / ${entry.shiftName}`,
      );
      continue;
    }
    const date = startOfDay(parseISO(entry.date));
    try {
      if (target === "base") {
        await prisma.baseScheduleEntry.create({
          data: {
            date,
            employeeId: emp.id,
            shiftTemplateId: shift.id,
            note: entry.note ?? null,
          },
        });
      } else {
        const competencyId = entry.competencyName
          ? (compByName.get(entry.competencyName.toLowerCase()) ?? null)
          : null;
        await prisma.assignment.create({
          data: {
            date,
            employeeId: emp.id,
            shiftTemplateId: shift.id,
            competencyId,
          },
        });
      }
      created += 1;
    } catch {
      skipped += 1;
    }
  }

  return { created, skipped, createdEmployees, createdShifts, warnings };
}
