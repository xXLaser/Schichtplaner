import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
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
    },
    include: { requirements: { include: { competency: true } } },
  });
  return NextResponse.json(shift);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.shiftTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
