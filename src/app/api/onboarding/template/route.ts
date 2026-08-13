import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  COMPANY_COMPETENCIES,
  COMPANY_SHIFT_TEMPLATES,
} from "@/lib/companyDefaults";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = z
      .object({
        action: z.enum(["loadCompanyTemplate"]),
        replace: z.boolean().optional(),
      })
      .parse(await req.json());

    if (body.action !== "loadCompanyTemplate") {
      return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
    }

    if (body.replace) {
      await prisma.shiftRequirement.deleteMany();
      await prisma.shiftTemplate.deleteMany();
      await prisma.competency.deleteMany();
    }

    const existingComps = await prisma.competency.findMany();
    if (existingComps.length > 0 && !body.replace) {
      return NextResponse.json(
        {
          error:
            "Es existieren bereits Kompetenzen. Nutzen Sie replace=true zum Überschreiben.",
        },
        { status: 409 },
      );
    }

    const compMap = new Map<string, string>();
    for (const c of COMPANY_COMPETENCIES) {
      const row = await prisma.competency.upsert({
        where: { name: c.name },
        create: {
          name: c.name,
          color: c.color,
          description: c.description,
        },
        update: {
          color: c.color,
          description: c.description,
        },
      });
      compMap.set(c.name, row.id);
    }

    const createdShifts = [];
    for (const tpl of COMPANY_SHIFT_TEMPLATES) {
      const existing = await prisma.shiftTemplate.findFirst({
        where: { name: tpl.name },
      });
      if (existing && !body.replace) continue;

      const shift = existing
        ? await prisma.shiftTemplate.update({
            where: { id: existing.id },
            data: {
              startTime: tpl.startTime,
              endTime: tpl.endTime,
              kind: tpl.kind,
              color: tpl.color,
              sortOrder: tpl.sortOrder,
              active: true,
            },
          })
        : await prisma.shiftTemplate.create({
            data: {
              name: tpl.name,
              startTime: tpl.startTime,
              endTime: tpl.endTime,
              kind: tpl.kind,
              color: tpl.color,
              sortOrder: tpl.sortOrder,
            },
          });

      await prisma.shiftRequirement.deleteMany({
        where: { shiftTemplateId: shift.id },
      });

      for (const req of tpl.requirements) {
        const competencyId = compMap.get(req.competencyName);
        if (!competencyId || req.minCount <= 0) continue;
        await prisma.shiftRequirement.create({
          data: {
            shiftTemplateId: shift.id,
            competencyId,
            minCount: req.minCount,
          },
        });
      }
      createdShifts.push(shift);
    }

    return NextResponse.json({
      competencies: compMap.size,
      shifts: createdShifts.length,
    });
  } catch (error) {
    return apiError(error, "Vorlage konnte nicht geladen werden");
  }
}
