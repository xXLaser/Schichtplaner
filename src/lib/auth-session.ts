import { createHmac, timingSafeEqual } from "crypto";

export function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    process.env.DATABASE_URL ??
    "schichtwerk-local-dev-secret"
  );
}

export function parseSessionToken(
  token: string,
): { userId: string; username?: string; exp: number } | null {
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
    ) as { userId: string; username?: string; exp: number };
    if (!payload.userId || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
