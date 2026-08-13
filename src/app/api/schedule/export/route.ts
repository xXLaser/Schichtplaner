import { NextRequest, NextResponse } from "next/server";
import {
  exportAssignments,
  exportBaseSchedule,
  scheduleToCsv,
} from "@/lib/scheduleImportExport";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const type = req.nextUrl.searchParams.get("type") ?? "assignments";
    const format = req.nextUrl.searchParams.get("format") ?? "json";

    if (!from || !to) {
      return NextResponse.json(
        { error: "from und to sind erforderlich." },
        { status: 400 },
      );
    }

    const data =
      type === "base"
        ? await exportBaseSchedule(from, to)
        : await exportAssignments(from, to);

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
