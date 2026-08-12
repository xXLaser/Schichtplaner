import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parseISO, startOfDay, isWithinInterval } from "date-fns";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const schema = z.object({
  date: z.string(),
  shiftTemplateId: z.string().min(1),
  employeeId: z.string().min(1),
  competencyId: z.string().optional().nullable(),
  force: z.boolean().optional(),
});

/** Manuelles Hinzufügen einer Person zu einer Schicht (nachträgliche Anpassung). */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const date = startOfDay(parseISO(body.date));

    if (!body.force) {
      const absence = await prisma.absence.findFirst({
        where: {
          employeeId: body.employeeId,
          status: "APPROVED",
        },
      });
      if (
        absence &&
        isWithinInterval(date, {
          start: startOfDay(absence.startDate),
          end: startOfDay(absence.endDate),
        })
      ) {
        return NextResponse.json(
          {
            error:
              "Mitarbeiter ist an diesem Tag als abwesend (Urlaub/Krankenstand) eingetragen.",
            code: "ABSENT",
          },
          { status: 409 },
        );
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        date,
        shiftTemplateId: body.shiftTemplateId,
        employeeId: body.employeeId,
        competencyId: body.competencyId || null,
      },
      include: {
        employee: { include: { competencies: { include: { competency: true } } } },
        shiftTemplate: true,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Diese Person ist für diese Schicht an diesem Tag bereits eingetragen." },
        { status: 409 },
      );
    }
    return apiError(error, "Zuweisung konnte nicht gespeichert werden");
  }
}
