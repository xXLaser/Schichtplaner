import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  kind: z.enum(["DAY", "NIGHT", "INTERMEDIATE"]).optional(),
  requirements: z
    .array(
      z.object({
        competencyId: z.string(),
        minCount: z.number().int().min(0).max(20),
      }),
    )
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = schema.parse(await req.json());

    if (body.requirements) {
      await prisma.shiftRequirement.deleteMany({ where: { shiftTemplateId: id } });
      await prisma.shiftRequirement.createMany({
        data: body.requirements
          .filter((r) => r.minCount > 0)
          .map((r) => ({
            shiftTemplateId: id,
            competencyId: r.competencyId,
            minCount: r.minCount,
          })),
      });
    }

    const shift = await prisma.shiftTemplate.update({
      where: { id },
      data: {
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        color: body.color,
        active: body.active,
        sortOrder: body.sortOrder,
        kind: body.kind,
      },
      include: { requirements: { include: { competency: true } } },
    });
    return NextResponse.json(shift);
  } catch (error) {
    return apiError(error, "Schicht konnte nicht gespeichert werden");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.shiftTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Schicht konnte nicht gelöscht werden");
  }
}
