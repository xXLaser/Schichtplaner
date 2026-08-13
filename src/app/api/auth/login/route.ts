import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  encodeSession,
  login,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const user = await login(body.username, body.password);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions());
    return res;
  } catch (error) {
    return apiError(error, "Anmeldung fehlgeschlagen");
  }
}
