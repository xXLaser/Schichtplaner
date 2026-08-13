import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  completeOnboarding,
  getOnboardingStatus,
  resetOnboarding,
  setOnboardingStep,
  type OnboardingStep,
} from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getOnboardingStatus();
    return NextResponse.json(status);
  } catch (error) {
    return apiError(error, "Onboarding-Status konnte nicht geladen werden");
  }
}

const bodySchema = z.object({
  action: z.enum(["step", "complete", "reset"]),
  step: z
    .enum([
      "welcome",
      "admin",
      "competencies",
      "shifts",
      "employees",
      "schedule",
      "apply",
      "done",
    ])
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    if (body.action === "step") {
      if (!body.step) {
        return NextResponse.json(
          { error: "step ist erforderlich." },
          { status: 400 },
        );
      }
      const status = await setOnboardingStep(body.step as OnboardingStep);
      return NextResponse.json(status);
    }
    if (body.action === "complete") {
      const status = await completeOnboarding();
      return NextResponse.json(status);
    }
    const status = await resetOnboarding();
    return NextResponse.json(status);
  } catch (error) {
    return apiError(error, "Onboarding konnte nicht aktualisiert werden");
  }
}
