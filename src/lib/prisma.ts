import path from "path";
import { PrismaClient } from "@prisma/client";

/**
 * Auf Windows-Servern scheitert eine relative SQLite-URL leicht,
 * wenn der Prozess aus einem anderen Ordner gestartet wird.
 * Deshalb setzen wir bei Bedarf einen absoluten Pfad.
 */
function ensureDatabaseUrl() {
  const current = process.env.DATABASE_URL;
  if (!current || current.startsWith("file:./") || current.startsWith("file:prisma/")) {
    const absolute = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
    process.env.DATABASE_URL = `file:${absolute}`;
  }
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
