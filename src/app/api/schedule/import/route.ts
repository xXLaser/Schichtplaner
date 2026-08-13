import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  exportAssignments,
  exportBaseSchedule,
  importAssignments,
  importBaseSchedule,
  parseCsvSchedule,
  type ScheduleExport,
} from "@/lib/scheduleImportExport";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  type: z.enum(["assignments", "base"]).default("assignments"),
  replaceRange: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["json", "csv"]).default("json"),
  data: z.union([z.string(), z.custom<ScheduleExport>()]).optional(),
  rows: z
    .array(
      z.object({
        date: z.string(),
        shiftName: z.string(),
        employeeName: z.string(),
        competencyName: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = importSchema.parse(await req.json());
    let rows = body.rows ?? [];

    if (body.format === "csv" && typeof body.data === "string") {
      rows = parseCsvSchedule(body.data);
    } else if (body.format === "json") {
      const payload = body.data as ScheduleExport | undefined;
      if (payload?.rows) rows = payload.rows;
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Einträge zum Importieren." },
        { status: 400 },
      );
    }

    const result =
      body.type === "base"
        ? await importBaseSchedule(rows, {
            replaceRange: body.replaceRange,
            from: body.from,
            to: body.to,
          })
        : await importAssignments(rows, {
            replaceRange: body.replaceRange,
            from: body.from,
            to: body.to,
          });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Import fehlgeschlagen");
  }
}
