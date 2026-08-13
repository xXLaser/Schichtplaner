import { prisma } from "./prisma";

export const CONFIG_KEYS = {
  databaseMode: "config.database.mode",
  mysqlUrl: "config.database.mysqlUrl",
  webAccess: "config.network.webAccess",
  federalState: "config.region.federalState",
} as const;

export type DatabaseMode = "local" | "mysql";
export type WebAccessMode = "local" | "network";

export type AppConfig = {
  databaseMode: DatabaseMode;
  mysqlUrl: string | null;
  webAccess: WebAccessMode;
  federalState: string;
};

const DEFAULTS: AppConfig = {
  databaseMode: "local",
  mysqlUrl: null,
  webAccess: "local",
  federalState: "DE",
};

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getAppConfig(): Promise<AppConfig> {
  const [mode, mysqlUrl, webAccess, state] = await Promise.all([
    getSetting(CONFIG_KEYS.databaseMode),
    getSetting(CONFIG_KEYS.mysqlUrl),
    getSetting(CONFIG_KEYS.webAccess),
    getSetting(CONFIG_KEYS.federalState),
  ]);

  return {
    databaseMode: mode === "mysql" ? "mysql" : "local",
    mysqlUrl: mysqlUrl || null,
    webAccess: webAccess === "network" ? "network" : "local",
    federalState: state || DEFAULTS.federalState,
  };
}

export async function updateAppConfig(
  patch: Partial<AppConfig>,
): Promise<AppConfig> {
  if (patch.databaseMode !== undefined) {
    await setSetting(CONFIG_KEYS.databaseMode, patch.databaseMode);
  }
  if (patch.mysqlUrl !== undefined) {
    if (patch.mysqlUrl) {
      await setSetting(CONFIG_KEYS.mysqlUrl, patch.mysqlUrl);
    } else {
      await prisma.appSetting.deleteMany({
        where: { key: CONFIG_KEYS.mysqlUrl },
      });
    }
  }
  if (patch.webAccess !== undefined) {
    await setSetting(CONFIG_KEYS.webAccess, patch.webAccess);
  }
  if (patch.federalState !== undefined) {
    await setSetting(CONFIG_KEYS.federalState, patch.federalState);
  }
  return getAppConfig();
}

/** Effektive Datenbank-URL aus Umgebung oder gespeicherter Konfiguration. */
export function resolveDatabaseUrl(config: AppConfig): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (config.databaseMode === "mysql" && config.mysqlUrl) {
    return config.mysqlUrl;
  }
  return null;
}

export function effectiveHostname(config: AppConfig): string {
  if (process.env.HOSTNAME) return process.env.HOSTNAME;
  return config.webAccess === "network" ? "0.0.0.0" : "127.0.0.1";
}
