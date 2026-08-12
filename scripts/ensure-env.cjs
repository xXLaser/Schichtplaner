/**
 * Erstellt/aktualisiert .env mit absolutem SQLite-Pfad (wichtig unter Windows).
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dbPath = path.join(root, "prisma", "dev.db").replace(/\\/g, "/");
const envPath = path.join(root, ".env");
const line = `DATABASE_URL="file:${dbPath}"`;

let content = "";
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, "utf8");
  if (/^DATABASE_URL=.*/m.test(content)) {
    content = content.replace(/^DATABASE_URL=.*/m, line);
  } else {
    content = `${content.trim()}\n${line}\n`;
  }
} else {
  content = `${line}\n`;
}

fs.writeFileSync(envPath, content, "utf8");
console.log("OK: .env gesetzt ->", line);
