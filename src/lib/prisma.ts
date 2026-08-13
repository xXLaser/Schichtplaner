import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  databaseUrlFromConfig,
  readRuntimeConfig,
} from "./runtime-config";

/**
 * Auf Windows-Servern scheitert eine relative SQLite-URL leicht,
 * wenn der Prozess aus einem anderen Ordner gestartet wird.
 * Deshalb setzen wir bei Bedarf einen absoluten Pfad.
 * Runtime-Config (SQLite/MySQL) hat Vorrang, wenn gesetzt.
 */
function ensureDatabaseUrl() {
  let cfg;
  try {
    cfg = readRuntimeConfig();
  } catch {
    cfg = null;
  }

  if (cfg?.dbMode === "mysql" && cfg.mysqlUrl.trim()) {
    process.env.DATABASE_URL = cfg.mysqlUrl.trim();
    return;
  }

  const current = process.env.DATABASE_URL;
  if (!current || current.startsWith("file:./") || current.startsWith("file:prisma/")) {
    const absolute = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
    process.env.DATABASE_URL = databaseUrlFromConfig(
      { dbMode: "sqlite", mysqlUrl: "", webAccess: false, port: 3847, holidayRegion: "AT", companyName: "" },
      absolute,
    );
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
