import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { createAdminUser, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  displayName: z.string().optional(),
});

/** Admin nur während der Ersteinrichtung anlegen. */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const user = await createAdminUser(body);
    await setSessionCookie(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return apiError(error, "Admin konnte nicht angelegt werden");
  }
}
