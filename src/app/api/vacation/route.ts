import { NextRequest, NextResponse } from "next/server";
import { getVacationPlanner, calendarDaysOfMonth } from "@/lib/vacation";

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const monthParam = req.nextUrl.searchParams.get("month");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Ungültiges Jahr" }, { status: 400 });
  }

  const data = await getVacationPlanner(year);

  if (monthParam) {
    const month = Number(monthParam);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Ungültiger Monat" }, { status: 400 });
    }
    return NextResponse.json({
      ...data,
      calendar: calendarDaysOfMonth(year, month),
      month,
    });
  }

  return NextResponse.json(data);
}
