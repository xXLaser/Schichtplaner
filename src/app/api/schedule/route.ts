import { NextRequest, NextResponse } from "next/server";
import { generateSchedule, getSchedule } from "@/lib/scheduler";
import { z } from "zod";
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
    const data = await getSchedule(from, to);
    const cfg = readRuntimeConfig();
    const holidays = holidaysInRange(from, to, cfg.holidayRegion);
    return NextResponse.json({
      ...data,
      holidays,
      holidayRegion: cfg.holidayRegion,
    });
  } catch (error) {
    return apiError(error, "Dienstplan konnte nicht geladen werden");
  }
}

const schema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  replaceExisting: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const result = await generateSchedule(body.startDate, body.endDate, {
      replaceExisting: body.replaceExisting ?? true,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Dienstplan konnte nicht erzeugt werden");
  }
}
