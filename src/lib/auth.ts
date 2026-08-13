import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "schichtwerk_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 Tage

export type SessionUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: "ADMIN";
};

function sessionSecret(): string {
  return (
    process.env.SCHICHTWERK_SESSION_SECRET ||
    process.env.DATABASE_URL ||
    "schichtwerk-local-dev-secret"
  );
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

function signPayload(payload: string): string {
  return createHash("sha256")
    .update(`${payload}.${sessionSecret()}`)
    .digest("hex")
    .slice(0, 32);
}

export function createSessionToken(userId: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${signPayload(payload)}`;
}

export function parseSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const payload = `${userId}.${expStr}`;
  if (signPayload(payload) !== sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return userId;
}

export async function countAdmins(): Promise<number> {
  return prisma.user.count();
}

export async function createAdminUser(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<SessionUser> {
  const username = input.username.trim().toLowerCase();
  if (username.length < 3) {
    throw new Error("Benutzername muss mindestens 3 Zeichen haben.");
  }
  if (input.password.length < 6) {
    throw new Error("Passwort muss mindestens 6 Zeichen haben.");
  }
  const existing = await prisma.user.count();
  if (existing > 0) {
    throw new Error("Es existiert bereits ein Admin-Benutzer.");
  }
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(input.password),
      displayName: input.displayName?.trim() || null,
      role: "ADMIN",
    },
  });
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: "ADMIN",
  };
}

export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
  });
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: "ADMIN",
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const userId = parseSessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: "ADMIN",
  };
}

export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production" && process.env.SCHICHTWERK_SECURE_COOKIE === "1",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
