import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  active: z.boolean().optional(),
  maxShifts: z.number().int().min(1).max(14).optional(),
  vacationDaysPerYear: z.number().int().min(0).max(60).optional(),
  competencyIds: z.array(z.string()).optional(),
  shiftPreference: z.enum(["ANY", "DAY_ONLY", "NIGHT_ONLY", "ROTATING"]).optional(),
  rotationWeeks: z.number().int().min(1).max(12).optional(),
  rotationStartDate: z.string().optional().nullable(),
  rotationStartKind: z.enum(["DAY", "NIGHT"]).optional(),
  targetHours: z.number().min(0).max(1000).optional().nullable(),
  hoursPeriod: z.enum(["MONTH", "QUARTER"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
        vacationDaysPerYear: body.vacationDaysPerYear,
        shiftPreference: body.shiftPreference,
        rotationWeeks: body.rotationWeeks,
        rotationStartDate:
          body.rotationStartDate === undefined
            ? undefined
            : body.rotationStartDate
              ? new Date(body.rotationStartDate)
              : null,
        rotationStartKind: body.rotationStartKind,
        targetHours:
          body.targetHours === undefined ? undefined : (body.targetHours ?? null),
        hoursPeriod: body.hoursPeriod,
      },
      include: { competencies: { include: { competency: true } } },
    });
    return NextResponse.json(employee);
  } catch (error) {
    return apiError(error, "Mitarbeiter konnte nicht gespeichert werden");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Mitarbeiter konnte nicht gelöscht werden");
  }
}
