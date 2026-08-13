import { prisma } from "./prisma";

export type CompanyShiftDef = {
  name: string;
  startTime: string;
  endTime: string;
  kind: "DAY" | "NIGHT" | "INTERMEDIATE";
  color: string;
  sortOrder: number;
};

export const COMPANY_COMPETENCIES: {
  name: string;
  description: string;
  color: string;
}[] = [
  {
    name: "Schichtleitung",
    description: "Verantwortlich für die Schicht / Teamleitung",
    color: "#0f766e",
  },
  {
    name: "Fachkraft",
    description: "Reguläre Schichtbesetzung",
    color: "#0369a1",
  },
  {
    name: "Springer",
    description: "Flexible Unterstützung",
    color: "#7c3aed",
  },
];

/** Schichtmodell: Tag 6–18, Nacht 18–6, Teamleiter 9h dazwischen, Teilzeit untertags. */
export const COMPANY_SHIFTS: CompanyShiftDef[] = [
  {
    name: "Tagschicht",
    startTime: "06:00",
    endTime: "18:00",
    kind: "DAY",
    color: "#0f766e",
    sortOrder: 1,
  },
  {
    name: "Nachtschicht",
    startTime: "18:00",
    endTime: "06:00",
    kind: "NIGHT",
    color: "#1e3a5f",
    sortOrder: 2,
  },
  {
    name: "Teamleiter",
    startTime: "12:00",
    endTime: "21:00",
    kind: "INTERMEDIATE",
    color: "#b45309",
    sortOrder: 3,
  },
  {
    name: "Teilzeit",
    startTime: "09:00",
    endTime: "15:00",
    kind: "DAY",
    color: "#0369a1",
    sortOrder: 4,
  },
];

export type CompanyTemplateResult = {
  competenciesCreated: number;
  shiftsCreated: number;
  competencies: { id: string; name: string }[];
  shifts: { id: string; name: string; startTime: string; endTime: string }[];
};

/**
 * Spielt das Firmen-Schichtmodell ein, ohne bestehende Einträge zu löschen.
 * Bereits vorhandene Schichten/Kompetenzen mit gleichem Namen werden übersprungen.
 */
export async function applyCompanyTemplate(): Promise<CompanyTemplateResult> {
  const existingComps = await prisma.competency.findMany();
  const existingShifts = await prisma.shiftTemplate.findMany();
  const compByName = new Map(existingComps.map((c) => [c.name.toLowerCase(), c]));
  const shiftByName = new Map(
    existingShifts.map((s) => [s.name.toLowerCase(), s]),
  );

  let competenciesCreated = 0;
  for (const def of COMPANY_COMPETENCIES) {
    if (compByName.has(def.name.toLowerCase())) continue;
    const created = await prisma.competency.create({ data: def });
    compByName.set(def.name.toLowerCase(), created);
    competenciesCreated += 1;
  }

  const leitung = compByName.get("schichtleitung");
  const fachkraft = compByName.get("fachkraft");

  let shiftsCreated = 0;
  for (const def of COMPANY_SHIFTS) {
    if (shiftByName.has(def.name.toLowerCase())) continue;
    const minLeitung = def.kind === "INTERMEDIATE" || def.name === "Tagschicht" || def.name === "Nachtschicht" ? 1 : 0;
    const minFach = def.name === "Teilzeit" ? 1 : def.kind === "INTERMEDIATE" ? 0 : 1;
    const created = await prisma.shiftTemplate.create({
      data: {
        name: def.name,
        startTime: def.startTime,
        endTime: def.endTime,
        kind: def.kind,
        color: def.color,
        sortOrder: def.sortOrder,
        active: true,
        requirements: {
          create: [
            ...(leitung && minLeitung > 0
              ? [{ competencyId: leitung.id, minCount: minLeitung }]
              : []),
            ...(fachkraft && minFach > 0
              ? [{ competencyId: fachkraft.id, minCount: minFach }]
              : []),
          ],
        },
      },
    });
    shiftByName.set(def.name.toLowerCase(), created);
    shiftsCreated += 1;
  }

  const competencies = [...compByName.values()].map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const shifts = [...shiftByName.values()].map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  return { competenciesCreated, shiftsCreated, competencies, shifts };
}
