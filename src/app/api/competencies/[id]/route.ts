import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = schema.parse(await req.json());
  const competency = await prisma.competency.update({ where: { id }, data: body });
  return NextResponse.json(competency);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.competency.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
