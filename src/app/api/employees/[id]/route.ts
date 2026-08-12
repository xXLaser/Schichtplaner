import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  active: z.boolean().optional(),
  maxShifts: z.number().int().min(1).max(14).optional(),
  competencyIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = schema.parse(await req.json());

  if (body.competencyIds) {
    await prisma.employeeCompetency.deleteMany({ where: { employeeId: id } });
    await prisma.employeeCompetency.createMany({
      data: body.competencyIds.map((competencyId) => ({
        employeeId: id,
        competencyId,
      })),
    });
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      name: body.name,
      email: body.email === "" ? null : body.email,
      active: body.active,
      maxShifts: body.maxShifts,
    },
    include: { competencies: { include: { competency: true } } },
  });
  return NextResponse.json(employee);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.employee.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
