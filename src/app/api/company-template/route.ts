import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { applyCompanyTemplate } from "@/lib/companyTemplate";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await applyCompanyTemplate();
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Betriebsvorlage konnte nicht eingespielt werden");
  }
}
