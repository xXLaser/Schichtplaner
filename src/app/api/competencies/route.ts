import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const competencies = await prisma.competency.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true, requirements: true } } },
    });
    return NextResponse.json(competencies);
  } catch (error) {
    return apiError(error, "Kompetenzen konnten nicht geladen werden");
  }
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const competency = await prisma.competency.create({ data: body });
    return NextResponse.json(competency, { status: 201 });
  } catch (error) {
    return apiError(error, "Kompetenz konnte nicht angelegt werden");
  }
}
