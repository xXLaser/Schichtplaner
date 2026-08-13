import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { exportPlan } from "@/lib/planIO";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const source =
      req.nextUrl.searchParams.get("source") === "base" ? "base" : "assignments";
    if (!from || !to) {
      return NextResponse.json(
        { error: "from und to sind erforderlich (YYYY-MM-DD)" },
        { status: 400 },
      );
    }
    const payload = await exportPlan({ from, to, source });
    const filename = `dienstplan-${from}_${to}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiError(error, "Export fehlgeschlagen");
  }
}
