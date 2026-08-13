import fs from "fs";
import path from "path";
import os from "os";

export type DbMode = "sqlite" | "mysql";
export type HolidayRegion = "AT" | "DE" | "DE-BY" | "NONE";

export type RuntimeConfig = {
  /** Lokale SQLite-Datei (Standard) oder externe MySQL. */
  dbMode: DbMode;
  /** mysql://user:pass@host:3306/schichtwerk */
  mysqlUrl: string;
  /**
   * true = Server hört auf 0.0.0.0 (LAN/Web).
   * false = nur localhost (empfohlen für Desktop-EXE).
   */
  webAccess: boolean;
  port: number;
  holidayRegion: HolidayRegion;
  /** Anzeigename der Firma (optional). */
  companyName: string;
};

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  dbMode: "sqlite",
  mysqlUrl: "",
  webAccess: false,
  port: 3847,
  holidayRegion: "AT",
  companyName: "",
};

function configCandidates(): string[] {
  const envPath = process.env.SCHICHTWERK_CONFIG;
  if (envPath) return [envPath];

  const cwd = process.cwd();
  const list = [
    path.join(cwd, "data", "schichtwerk.config.json"),
    path.join(cwd, "schichtwerk.config.json"),
  ];

  if (process.env.LOCALAPPDATA) {
    list.unshift(
      path.join(process.env.LOCALAPPDATA, "schichtwerk-desktop", "schichtwerk.config.json"),
      path.join(process.env.LOCALAPPDATA, "Schichtwerk", "schichtwerk.config.json"),
    );
  }

  // Linux/mac Fallbacks
  list.push(
    path.join(os.homedir(), ".schichtwerk", "schichtwerk.config.json"),
  );

  return list;
}

export function resolveConfigPath(): string {
  for (const p of configCandidates()) {
    if (fs.existsSync(p)) return p;
  }
  // Bevorzugt data/ neben der App
  const preferred = path.join(process.cwd(), "data", "schichtwerk.config.json");
  return preferred;
}

function normalize(raw: Partial<RuntimeConfig> | null | undefined): RuntimeConfig {
  const base = { ...DEFAULT_RUNTIME_CONFIG, ...(raw ?? {}) };
  if (base.dbMode !== "sqlite" && base.dbMode !== "mysql") {
    base.dbMode = "sqlite";
  }
  if (!["AT", "DE", "DE-BY", "NONE"].includes(base.holidayRegion)) {
    base.holidayRegion = "AT";
  }
  base.port = Number(base.port) > 0 ? Number(base.port) : 3847;
  base.webAccess = Boolean(base.webAccess);
  base.mysqlUrl = typeof base.mysqlUrl === "string" ? base.mysqlUrl : "";
  base.companyName = typeof base.companyName === "string" ? base.companyName : "";
  return base;
}

export function readRuntimeConfig(): RuntimeConfig {
  const file = resolveConfigPath();
  try {
    if (!fs.existsSync(file)) return { ...DEFAULT_RUNTIME_CONFIG };
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<RuntimeConfig>;
    return normalize(raw);
  } catch {
    return { ...DEFAULT_RUNTIME_CONFIG };
  }
}

export function writeRuntimeConfig(patch: Partial<RuntimeConfig>): RuntimeConfig {
  const current = readRuntimeConfig();
  const next = normalize({ ...current, ...patch });
  const file = resolveConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

/** Baut DATABASE_URL aus der Runtime-Config (für Launcher/Desktop). */
export function databaseUrlFromConfig(
  cfg: RuntimeConfig,
  sqliteFileAbsolute: string,
): string {
  if (cfg.dbMode === "mysql" && cfg.mysqlUrl.trim()) {
    return cfg.mysqlUrl.trim();
  }
  const normalized = sqliteFileAbsolute.replace(/\\/g, "/");
  return normalized.startsWith("file:") ? normalized : `file:${normalized}`;
}

export function hostnameFromConfig(cfg: RuntimeConfig): string {
  return cfg.webAccess ? "0.0.0.0" : "127.0.0.1";
}
