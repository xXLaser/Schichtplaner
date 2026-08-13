import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { authStatus } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/onboarding";
import { getAppConfig } from "@/lib/appConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [auth, onboarding] = await Promise.all([
      authStatus(),
      getOnboardingStatus(),
    ]);
    const config = getAppConfig();
    return NextResponse.json({
      ...auth,
      onboarding,
      config: {
        webAccess: config.webAccess,
        databaseProvider: config.databaseProvider,
        holidayRegion: config.holidayRegion,
        planningDays: config.planningDays,
        host: config.host,
        port: config.port,
      },
    });
  } catch (error) {
    return apiError(error, "Sitzung konnte nicht geladen werden");
  }
}
