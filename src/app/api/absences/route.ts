import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parseISO, startOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const absences = await prisma.absence.findMany({
    where:
      from && to
        ? {
            startDate: { lte: startOfDay(parseISO(to)) },
            endDate: { gte: startOfDay(parseISO(from)) },
          }
        : undefined,
    include: { employee: true },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json(absences);
}

const schema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["VACATION", "SICK", "OTHER"]),
  startDate: z.string(),
  endDate: z.string(),
  note: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const absence = await prisma.absence.create({
    data: {
      employeeId: body.employeeId,
      type: body.type,
      startDate: startOfDay(parseISO(body.startDate)),
      endDate: startOfDay(parseISO(body.endDate)),
      note: body.note || null,
    },
    include: { employee: true },
  });
  return NextResponse.json(absence, { status: 201 });
}
