import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { importPlan, type PlanExportPayload } from "@/lib/planIO";

export const dynamic = "force-dynamic";

const schema = z.object({
  payload: z.any(),
  target: z.enum(["assignments", "base"]).optional(),
  replaceRange: z.boolean().optional(),
  createMissing: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const result = await importPlan(body.payload as PlanExportPayload, {
      target: body.target,
      replaceRange: body.replaceRange,
      createMissing: body.createMissing,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Import fehlgeschlagen");
  }
}
