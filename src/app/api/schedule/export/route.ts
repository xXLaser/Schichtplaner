import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { exportSchedule, scheduleToCsv } from "@/lib/scheduleIO";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const format = req.nextUrl.searchParams.get("format") ?? "json";
    if (!from || !to) {
      return NextResponse.json(
        { error: "from und to sind erforderlich (YYYY-MM-DD)" },
        { status: 400 },
      );
    }
    const data = await exportSchedule(from, to, { includeAbsences: true });
    if (format === "csv") {
      const csv = scheduleToCsv(data);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="dienstplan-${from}-${to}.csv"`,
        },
      });
    }
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error, "Export fehlgeschlagen");
  }
}
