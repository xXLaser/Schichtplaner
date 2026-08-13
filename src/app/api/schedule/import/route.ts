import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { importSchedule, SCHEDULE_EXPORT_VERSION } from "@/lib/scheduleIO";

export const dynamic = "force-dynamic";

const schema = z.object({
  version: z.number(),
  exportedAt: z.string().optional(),
  from: z.string(),
  to: z.string(),
  assignments: z.array(
    z.object({
      date: z.string(),
      employeeName: z.string(),
      employeeId: z.string(),
      shiftName: z.string(),
      shiftTemplateId: z.string(),
      competencyId: z.string().nullable().optional(),
    }),
  ),
  absences: z
    .array(
      z.object({
        employeeName: z.string(),
        type: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        note: z.string().nullable().optional(),
      }),
    )
    .optional(),
  replaceExisting: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    if (body.version !== SCHEDULE_EXPORT_VERSION) {
      return NextResponse.json(
        { error: "Unbekannte Export-Version." },
        { status: 400 },
      );
    }
    const result = await importSchedule(
      {
        version: body.version,
        exportedAt: body.exportedAt,
        from: body.from,
        to: body.to,
        assignments: body.assignments,
        absences: body.absences,
      },
      {
        replaceExisting: body.replaceExisting ?? true,
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Import fehlgeschlagen");
  }
}
