import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { authenticate, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const user = await authenticate(body.username, body.password);
    if (!user) {
      return NextResponse.json(
        { error: "Benutzername oder Passwort falsch." },
        { status: 401 },
      );
    }
    await setSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error, "Login fehlgeschlagen");
  }
}
