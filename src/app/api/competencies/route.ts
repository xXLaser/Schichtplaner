import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const competencies = await prisma.competency.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true, requirements: true } } },
  });
  return NextResponse.json(competencies);
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const competency = await prisma.competency.create({ data: body });
  return NextResponse.json(competency, { status: 201 });
}
