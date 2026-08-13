import path from "path";
import { PrismaClient } from "@prisma/client";
import { getAppConfig, isMysqlUrl } from "./appConfig";

/**
 * SQLite-URL relativ zum Prozessverzeichnis auflösen.
 * MySQL-URLs unverändert lassen.
 */
function ensureDatabaseUrl() {
  const current = process.env.DATABASE_URL;
  if (isMysqlUrl(current)) return;
  if (!current || current.startsWith("file:./") || current.startsWith("file:prisma/")) {
    const absolute = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
    process.env.DATABASE_URL = `file:${absolute}`;
  }
  if (!process.env.MYSQL_DATABASE_URL) {
    process.env.MYSQL_DATABASE_URL =
      "mysql://root:root@127.0.0.1:3306/schichtwerk";
  }
}

function createMysqlClient(url: string | undefined): PrismaClient {
  // Dynamisch, damit der SQLite-Standalone-Build nicht den MySQL-Client einpackt.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: MysqlClient } = require("@/generated/prisma-mysql") as {
    PrismaClient: new (opts?: ConstructorParameters<typeof PrismaClient>[0]) => PrismaClient;
  };
  return new MysqlClient({
    log: ["error", "warn"],
    datasources: url ? { db: { url } } : undefined,
  });
}

function createClient(): PrismaClient {
  const config = getAppConfig();
  const url = config.databaseUrl || process.env.DATABASE_URL;
  if (url) process.env.DATABASE_URL = url;

  if (config.databaseProvider === "mysql" || isMysqlUrl(url)) {
    if (url) process.env.MYSQL_DATABASE_URL = url;
    return createMysqlClient(url);
  }

  return new PrismaClient({
    log: ["error", "warn"],
    datasources: url ? { db: { url } } : undefined,
  });
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
