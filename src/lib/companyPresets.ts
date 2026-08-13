import { prisma } from "./prisma";

/**
 * Firmen-Schichtsystem:
 * - Tagschicht 06:00–18:00
 * - Nachtschicht 18:00–06:00
 * - Teamleiter-Zwischendienst 09:00–18:00 (9 Stunden, zwischen den Schichten)
 * - Teilzeit untertags 09:00–15:00 (eigene Schichtvorlage)
 */
export const COMPANY_SHIFT_PRESETS = [
  {
    name: "Tagschicht",
    startTime: "06:00",
    endTime: "18:00",
    kind: "DAY" as const,
    color: "#0f766e",
    sortOrder: 1,
  },
  {
    name: "Nachtschicht",
    startTime: "18:00",
    endTime: "06:00",
    kind: "NIGHT" as const,
    color: "#1e3a5f",
    sortOrder: 2,
  },
  {
    name: "Teamleiter (9h)",
    startTime: "09:00",
    endTime: "18:00",
    kind: "INTERMEDIATE" as const,
    color: "#b45309",
    sortOrder: 3,
  },
  {
    name: "Teilzeit Tag",
    startTime: "09:00",
    endTime: "15:00",
    kind: "DAY" as const,
    color: "#0369a1",
    sortOrder: 4,
  },
] as const;

export const COMPANY_COMPETENCY_PRESETS = [
  { name: "Schichtleitung", color: "#0f766e", description: "Verantwortlich für die Schicht" },
  { name: "Teamleiter", color: "#b45309", description: "9h-Zwischendienst zwischen Tag und Nacht" },
  { name: "Produktion", color: "#0369a1", description: "Operativer Dienst" },
  { name: "System", color: "#7c3aed", description: "System-/Leitstand" },
] as const;

export type ApplyCompanyPresetsResult = {
  competenciesCreated: number;
  shiftsCreated: number;
  shiftsUpdated: number;
  message: string;
};

/**
 * Legt Firmen-Kompetenzen und Schichtvorlagen an (idempotent nach Name).
 * Bestehende Schichten mit gleichem Namen werden auf die Firmenzeiten aktualisiert.
 */
export async function applyCompanyShiftPresets(options?: {
  includeCompetencies?: boolean;
  defaultMinCounts?: Record<string, number>;
}): Promise<ApplyCompanyPresetsResult> {
  const includeCompetencies = options?.includeCompetencies ?? true;
  let competenciesCreated = 0;
  let shiftsCreated = 0;
  let shiftsUpdated = 0;

  if (includeCompetencies) {
    for (const c of COMPANY_COMPETENCY_PRESETS) {
      const existing = await prisma.competency.findUnique({ where: { name: c.name } });
      if (!existing) {
        await prisma.competency.create({ data: { ...c } });
        competenciesCreated += 1;
      }
    }
  }

  const competencies = await prisma.competency.findMany();
  const byName = new Map(competencies.map((c) => [c.name, c]));

  for (const preset of COMPANY_SHIFT_PRESETS) {
    const existing = await prisma.shiftTemplate.findFirst({
      where: { name: preset.name },
    });

    const requirements = buildDefaultRequirements(preset.name, byName, options?.defaultMinCounts);

    if (existing) {
      await prisma.shiftTemplate.update({
        where: { id: existing.id },
        data: {
          startTime: preset.startTime,
          endTime: preset.endTime,
          kind: preset.kind,
          color: preset.color,
          sortOrder: preset.sortOrder,
          active: true,
        },
      });
      // Anforderungen nur ergänzen, wenn noch keine da sind
      const reqCount = await prisma.shiftRequirement.count({
        where: { shiftTemplateId: existing.id },
      });
      if (reqCount === 0 && requirements.length > 0) {
        await prisma.shiftRequirement.createMany({
          data: requirements.map((r) => ({
            shiftTemplateId: existing.id,
            competencyId: r.competencyId,
            minCount: r.minCount,
          })),
        });
      }
      shiftsUpdated += 1;
    } else {
      await prisma.shiftTemplate.create({
        data: {
          name: preset.name,
          startTime: preset.startTime,
          endTime: preset.endTime,
          kind: preset.kind,
          color: preset.color,
          sortOrder: preset.sortOrder,
          requirements: {
            create: requirements,
          },
        },
      });
      shiftsCreated += 1;
    }
  }

  return {
    competenciesCreated,
    shiftsCreated,
    shiftsUpdated,
    message:
      `Firmen-Schichtsystem: Tag 06–18, Nacht 18–06, Teamleiter 09–18, Teilzeit 09–15. ` +
      `${shiftsCreated} neu, ${shiftsUpdated} aktualisiert` +
      (competenciesCreated ? `, ${competenciesCreated} Kompetenzen` : "") +
      ".",
  };
}

function buildDefaultRequirements(
  shiftName: string,
  byName: Map<string, { id: string; name: string }>,
  overrides?: Record<string, number>,
): { competencyId: string; minCount: number }[] {
  const req: { competencyId: string; minCount: number }[] = [];
  const add = (name: string, minCount: number) => {
    const c = byName.get(name);
    if (!c) return;
    const count = overrides?.[name] ?? minCount;
    if (count > 0) req.push({ competencyId: c.id, minCount: count });
  };

  if (shiftName === "Teamleiter (9h)") {
    add("Teamleiter", 1);
    add("Schichtleitung", 0);
    return req.filter((r) => r.minCount > 0);
  }
  if (shiftName === "Teilzeit Tag") {
    add("Produktion", 1);
    return req;
  }
  // Tag / Nacht
  add("Schichtleitung", 1);
  add("Produktion", 2);
  add("System", 1);
  return req;
}
