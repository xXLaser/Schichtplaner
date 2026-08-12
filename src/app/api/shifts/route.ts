import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const shifts = await prisma.shiftTemplate.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        requirements: { include: { competency: true } },
      },
    });
    return NextResponse.json(shifts);
  } catch (error) {
    return apiError(error, "Schichten konnten nicht geladen werden");
  }
}

const schema = z.object({
  name: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
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

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const shift = await prisma.shiftTemplate.create({
      data: {
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        color: body.color,
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? 0,
        kind: body.kind ?? "DAY",
        requirements: body.requirements
          ? {
              create: body.requirements
                .filter((r) => r.minCount > 0)
                .map((r) => ({
                  competencyId: r.competencyId,
                  minCount: r.minCount,
                })),
            }
          : undefined,
      },
      include: { requirements: { include: { competency: true } } },
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    return apiError(error, "Schicht konnte nicht angelegt werden");
  }
}
