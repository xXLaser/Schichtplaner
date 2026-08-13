import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  createAdminUser,
  encodeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  userCount,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const user = await createAdminUser(body.username, body.password);
    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions());
    return res;
  } catch (error) {
    return apiError(error, "Administratorkonto konnte nicht angelegt werden");
  }
}

export async function GET() {
  try {
    const count = await userCount();
    return NextResponse.json({ count, exists: count > 0 });
  } catch (error) {
    return apiError(error, "Admin-Status unbekannt");
  }
}
