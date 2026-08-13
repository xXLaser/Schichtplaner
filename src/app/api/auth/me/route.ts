import { NextResponse } from "next/server";
import { countAdmins, getSessionUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admins = await countAdmins();
    const user = await getSessionUser();
    return NextResponse.json({
      authRequired: admins > 0,
      user,
    });
  } catch (error) {
    return apiError(error, "Sitzung konnte nicht geladen werden");
  }
}
