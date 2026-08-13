/**
 * Erstellt/aktualisiert .env mit Datenbank-URL.
 * SQLite: absoluter Dateipfad. MySQL: bestehende URL belassen.
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const envPath = path.join(root, ".env");
const configPath =
  process.env.SCHICHTWERK_CONFIG_PATH ||
  path.join(root, "schichtwerk.config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

const config = readConfig();
const isMysql =
  config.databaseProvider === "mysql" ||
  String(process.env.DATABASE_URL || "").startsWith("mysql");

let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

function upsert(key, value) {
  const line = `${key}="${value}"`;
  if (new RegExp(`^${key}=.*`, "m").test(content)) {
    content = content.replace(new RegExp(`^${key}=.*`, "m"), line);
  } else {
    content = `${content.trim()}\n${line}\n`;
  }
}

if (isMysql) {
  const url = process.env.DATABASE_URL || config.databaseUrl;
  if (url) {
    upsert("DATABASE_URL", url);
    upsert("MYSQL_DATABASE_URL", url);
  }
} else {
  const dbPath = path.join(root, "prisma", "dev.db").replace(/\\/g, "/");
  upsert("DATABASE_URL", `file:${dbPath}`);
}

if (!/^MYSQL_DATABASE_URL=.*/m.test(content)) {
  upsert("MYSQL_DATABASE_URL", "mysql://root:root@127.0.0.1:3306/schichtwerk");
}

fs.writeFileSync(envPath, content.endsWith("\n") ? content : content + "\n", "utf8");
console.log("OK: .env aktualisiert");
