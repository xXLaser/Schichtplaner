import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateSchedule } from "@/lib/scheduler";
import { format, startOfDay } from "date-fns";

const schema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  note: z.string().optional().nullable(),
  compensate: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = schema.parse(await req.json());

  const absence = await prisma.absence.update({
    where: { id },
    data: {
      status: body.status,
      note: body.note === undefined ? undefined : body.note,
    },
    include: { employee: true },
  });

  let compensation = null;
  if (
    body.compensate !== false &&
    body.status === "APPROVED" &&
    absence.type === "VACATION"
  ) {
    const from = format(startOfDay(absence.startDate), "yyyy-MM-dd");
    const to = format(startOfDay(absence.endDate), "yyyy-MM-dd");
    compensation = await generateSchedule(from, to, { replaceExisting: true });
  }

  return NextResponse.json({ ...absence, compensation });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.absence.findUnique({ where: { id } });
  await prisma.absence.delete({ where: { id } });

  if (existing?.status === "APPROVED") {
    const from = format(startOfDay(existing.startDate), "yyyy-MM-dd");
    const to = format(startOfDay(existing.endDate), "yyyy-MM-dd");
    await generateSchedule(from, to, { replaceExisting: true });
  }

  return NextResponse.json({ ok: true });
}
