import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateUser,
  clearSession,
  createAdminUser,
  createSession,
  getSessionUser,
  hasAnyUser,
} from "@/lib/auth";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    const hasUser = await hasAnyUser();
    return NextResponse.json({
      authenticated: Boolean(user),
      user,
      needsSetup: !hasUser,
    });
  } catch (error) {
    return apiError(error, "Auth-Status konnte nicht geladen werden");
  }
}

const loginSchema = z.object({
  action: z.literal("login"),
  username: z.string().min(1),
  password: z.string().min(1),
});

const adminSchema = z.object({
  action: z.literal("createAdmin"),
  username: z.string().min(2).max(64),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

const logoutSchema = z.object({
  action: z.literal("logout"),
});

const bodySchema = z.discriminatedUnion("action", [
  loginSchema,
  adminSchema,
  logoutSchema,
]);

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());

    if (body.action === "logout") {
      await clearSession();
      return NextResponse.json({ ok: true });
    }

    if (body.action === "createAdmin") {
      const user = await createAdminUser(
        body.username,
        body.password,
        body.displayName,
      );
      await createSession(user.id, user.username);
      return NextResponse.json({ user, created: true }, { status: 201 });
    }

    const user = await authenticateUser(body.username, body.password);
    if (!user) {
      return NextResponse.json(
        { error: "Benutzername oder Passwort ungültig." },
        { status: 401 },
      );
    }
    await createSession(user.id, user.username);
    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error, "Anmeldung fehlgeschlagen");
  }
}
