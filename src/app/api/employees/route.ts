import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { name: "asc" },
      include: {
        competencies: { include: { competency: true } },
        absences: { orderBy: { startDate: "desc" }, take: 5 },
        _count: { select: { assignments: true } },
      },
    });
    return NextResponse.json(employees);
  } catch (error) {
    return apiError(error, "Mitarbeiter konnten nicht geladen werden");
  }
}

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable().or(z.literal("")),
  active: z.boolean().optional(),
  maxShifts: z.number().int().min(1).max(14).optional(),
  vacationDaysPerYear: z.number().int().min(0).max(60).optional(),
  competencyIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const employee = await prisma.employee.create({
      data: {
        name: body.name,
        email: body.email || null,
        active: body.active ?? true,
        maxShifts: body.maxShifts ?? 5,
        vacationDaysPerYear: body.vacationDaysPerYear ?? 30,
        competencies: body.competencyIds
          ? {
              create: body.competencyIds.map((competencyId) => ({
                competencyId,
              })),
            }
          : undefined,
      },
      include: { competencies: { include: { competency: true } } },
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return apiError(error, "Mitarbeiter konnte nicht angelegt werden");
  }
}
