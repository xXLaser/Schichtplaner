import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** Entfernt eine einzelne Zuweisung (nachträgliche Anpassung des Dienstplans). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.assignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Zuweisung konnte nicht gelöscht werden");
  }
}
