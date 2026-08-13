import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { applyCompanyShiftPresets } from "@/lib/companyPresets";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await applyCompanyShiftPresets({ includeCompetencies: true });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Firmen-Schichtsystem konnte nicht angewendet werden");
  }
}
