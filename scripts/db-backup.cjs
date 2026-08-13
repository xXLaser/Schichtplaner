/**
 * Kopiert prisma/dev.db nach prisma/backups/dev-YYYYMMDD-HHMMSS.db
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const src = path.join(root, "prisma", "dev.db");
const backupDir = path.join(root, "prisma", "backups");

if (!fs.existsSync(src)) {
  console.error("Keine Datenbank gefunden:", src);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .replace("T", "_")
  .slice(0, 19);
const dest = path.join(backupDir, `dev-${stamp}.db`);

fs.copyFileSync(src, dest);

const journal = `${src}-journal`;
if (fs.existsSync(journal)) {
  fs.copyFileSync(journal, `${dest}-journal`);
}

console.log("Backup gespeichert:", dest);
console.log("Wiederherstellen: npm run db:restore --", path.basename(dest));
