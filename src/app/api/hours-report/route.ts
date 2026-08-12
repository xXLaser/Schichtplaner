import { NextRequest, NextResponse } from "next/server";
import { parseISO } from "date-fns";
import { getHoursReport } from "@/lib/shiftHours";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    const reference = dateParam ? parseISO(dateParam) : new Date();
    const entries = await getHoursReport(reference);
    return NextResponse.json({ reference: dateParam ?? null, entries });
  } catch (error) {
    return apiError(error, "Stunden-Übersicht konnte nicht berechnet werden");
  }
}
