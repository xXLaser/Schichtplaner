import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { holidaysInRange } from "@/lib/holidays";
import { readRuntimeConfig } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json(
        { error: "from und to sind erforderlich (YYYY-MM-DD)" },
        { status: 400 },
      );
    }
    const cfg = readRuntimeConfig();
    const regionParam = req.nextUrl.searchParams.get("region");
    const region =
      regionParam === "AT" ||
      regionParam === "DE" ||
      regionParam === "DE-BY" ||
      regionParam === "NONE"
        ? regionParam
        : cfg.holidayRegion;
    const holidays = holidaysInRange(from, to, region);
    return NextResponse.json({ region, holidays });
  } catch (error) {
    return apiError(error, "Feiertage konnten nicht geladen werden");
  }
}
