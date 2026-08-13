import fs from "fs";
import path from "path";

export type DatabaseProvider = "sqlite" | "mysql";
export type HolidayRegion = "AT" | "DE";

export type AppConfig = {
  databaseProvider: DatabaseProvider;
  databaseUrl: string;
  webAccess: boolean;
  host: string;
  port: number;
  holidayRegion: HolidayRegion;
  planningDays: number;
};

export const DEFAULT_PLANNING_DAYS = 14;
export const LOCAL_HOST = "127.0.0.1";
export const LAN_HOST = "0.0.0.0";

const DEFAULTS: AppConfig = {
  databaseProvider: "sqlite",
  databaseUrl: "",
  webAccess: false,
  host: LOCAL_HOST,
  port: 3000,
  holidayRegion: "AT",
  planningDays: DEFAULT_PLANNING_DAYS,
};

function configPath(): string {
  return (
    process.env.SCHICHTWERK_CONFIG_PATH ||
    path.join(process.cwd(), "schichtwerk.config.json")
  );
}

function parseJsonFile(file: string): Partial<AppConfig> {
  try {
    if (!fs.existsSync(file)) return {};
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<
      string,
      unknown
    >;
    const out: Partial<AppConfig> = {};
    if (raw.databaseProvider === "sqlite" || raw.databaseProvider === "mysql") {
      out.databaseProvider = raw.databaseProvider;
    }
    if (typeof raw.databaseUrl === "string") out.databaseUrl = raw.databaseUrl;
    if (typeof raw.webAccess === "boolean") out.webAccess = raw.webAccess;
    if (typeof raw.host === "string") out.host = raw.host;
    if (typeof raw.port === "number" && Number.isFinite(raw.port)) {
      out.port = raw.port;
    }
    if (raw.holidayRegion === "AT" || raw.holidayRegion === "DE") {
      out.holidayRegion = raw.holidayRegion;
    }
    if (typeof raw.planningDays === "number" && raw.planningDays > 0) {
      out.planningDays = Math.round(raw.planningDays);
    }
    return out;
  } catch {
    return {};
  }
}

function sqliteFallbackUrl(): string {
  const absolute = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
  return `file:${absolute}`;
}

function envProvider(): DatabaseProvider | undefined {
  const fromEnv = (process.env.SCHICHTWERK_DB_PROVIDER || "").toLowerCase();
  if (fromEnv === "mysql" || fromEnv === "sqlite") return fromEnv;
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("mysql")) return "mysql";
  if (url.startsWith("file:")) return "sqlite";
  return undefined;
}

/** Liest Datei + Umgebung. Kein Prisma-Import (wird von prisma.ts genutzt). */
export function getAppConfig(): AppConfig {
  const file = parseJsonFile(configPath());
  const provider = envProvider() ?? file.databaseProvider ?? DEFAULTS.databaseProvider;
  const webAccess =
    process.env.SCHICHTWERK_WEB_ACCESS === "1"
      ? true
      : process.env.SCHICHTWERK_WEB_ACCESS === "0"
        ? false
        : (file.webAccess ?? DEFAULTS.webAccess);
  const host =
    process.env.HOSTNAME ||
    process.env.SCHICHTWERK_HOST ||
    file.host ||
    (webAccess ? LAN_HOST : LOCAL_HOST);
  const port = Number(
    process.env.PORT || process.env.SCHICHTWERK_PORT || file.port || DEFAULTS.port,
  );
  const databaseUrl =
    process.env.DATABASE_URL ||
    file.databaseUrl ||
    (provider === "sqlite" ? sqliteFallbackUrl() : "");

  return {
    databaseProvider: provider,
    databaseUrl,
    webAccess,
    host,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULTS.port,
    holidayRegion: file.holidayRegion ?? DEFAULTS.holidayRegion,
    planningDays: file.planningDays ?? DEFAULTS.planningDays,
  };
}

export function saveAppConfig(partial: Partial<AppConfig>): AppConfig {
  const current = { ...getAppConfig(), ...partial };
  if (current.webAccess) {
    current.host = current.host === LOCAL_HOST ? LAN_HOST : current.host;
  } else {
    current.host = LOCAL_HOST;
  }
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const serializable = {
    databaseProvider: current.databaseProvider,
    databaseUrl: current.databaseUrl,
    webAccess: current.webAccess,
    host: current.host,
    port: current.port,
    holidayRegion: current.holidayRegion,
    planningDays: current.planningDays,
  };
  fs.writeFileSync(file, JSON.stringify(serializable, null, 2), "utf8");
  return current;
}

export function isMysqlUrl(url: string | undefined): boolean {
  return Boolean(url?.startsWith("mysql"));
}
