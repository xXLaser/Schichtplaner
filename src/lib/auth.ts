import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE = "schichtwerk_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  username: string;
  role: "ADMIN" | "PLANNER";
};

type SessionPayload = SessionUser & { exp: number };

function secret(): string {
  const fromEnv = process.env.SCHICHTWERK_AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  return "schichtwerk-local-dev-secret";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeSession(user: SessionUser): string {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + MAX_AGE_SEC * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined | null): SessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload?.id || !payload.exp || payload.exp < Date.now()) return null;
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role === "PLANNER" ? "PLANNER" : "ADMIN",
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export const SESSION_COOKIE = COOKIE;

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE)?.value);
}

export async function userCount(): Promise<number> {
  return prisma.user.count();
}

export async function authStatus(): Promise<{
  user: SessionUser | null;
  needsLogin: boolean;
  hasUsers: boolean;
}> {
  const hasUsers = (await userCount()) > 0;
  const user = await getSession();
  return {
    user,
    hasUsers,
    needsLogin: hasUsers && !user,
  };
}

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;

export function validateUsername(username: string): string {
  const trimmed = username.trim();
  if (!USERNAME_RE.test(trimmed)) {
    throw new Error(
      "Benutzername: 3–40 Zeichen, nur Buchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich.",
    );
  }
  return trimmed;
}

export function validatePassword(password: string): string {
  if (password.length < 8) {
    throw new Error("Passwort muss mindestens 8 Zeichen haben.");
  }
  if (password.length > 200) {
    throw new Error("Passwort ist zu lang.");
  }
  return password;
}

export async function createAdminUser(
  username: string,
  password: string,
): Promise<SessionUser> {
  const existing = await prisma.user.count();
  if (existing > 0) {
    throw new Error("Es existiert bereits ein Administratorkonto.");
  }
  const user = await prisma.user.create({
    data: {
      username: validateUsername(username),
      passwordHash: hashPassword(validatePassword(password)),
      role: "ADMIN",
    },
  });
  return { id: user.id, username: user.username, role: "ADMIN" };
}

export async function login(
  username: string,
  password: string,
): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Benutzername oder Passwort ist falsch.");
  }
  return {
    id: user.id,
    username: user.username,
    role: user.role === "PLANNER" ? "PLANNER" : "ADMIN",
  };
}
