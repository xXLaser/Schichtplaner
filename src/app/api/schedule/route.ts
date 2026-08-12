import { NextRequest, NextResponse } from "next/server";
import { generateSchedule, getSchedule } from "@/lib/scheduler";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json(
      { error: "from und to sind erforderlich (YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  const data = await getSchedule(from, to);
  return NextResponse.json(data);
}

const schema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  replaceExisting: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const result = await generateSchedule(body.startDate, body.endDate, {
    replaceExisting: body.replaceExisting ?? true,
  });
  return NextResponse.json(result);
}
