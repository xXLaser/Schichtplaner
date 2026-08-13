import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./auth-constants";
import { prisma } from "./prisma";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    process.env.DATABASE_URL ??
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
  const hashVerify = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(hashVerify));
  } catch {
    return false;
  }
}

type SessionPayload = {
  userId: string;
  username: string;
  exp: number;
};

function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function parseSession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionSecret())
    .update(body)
    .digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.userId || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, username: string) {
  const token = signSession({
    userId,
    username,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = parseSession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, displayName: true },
  });
  return user;
}

export async function hasAnyUser(): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}

export async function createAdminUser(
  username: string,
  password: string,
  displayName?: string,
) {
  const existing = await prisma.user.count();
  if (existing > 0) {
    throw new Error("Ein Administrator existiert bereits.");
  }
  if (password.length < 8) {
    throw new Error("Passwort muss mindestens 8 Zeichen haben.");
  }
  return prisma.user.create({
    data: {
      username: username.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      displayName: displayName?.trim() || null,
    },
    select: { id: true, username: true, displayName: true },
  });
}

export async function authenticateUser(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}

export function parseSessionToken(token: string): { userId: string; exp: number } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const secret =
    process.env.SESSION_SECRET ??
    process.env.DATABASE_URL ??
    "schichtwerk-local-dev-secret";
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as { userId: string; exp: number };
    if (!payload.userId || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
