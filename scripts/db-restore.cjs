/**
 * Stellt ein Backup wieder her.
 * Nutzung: npm run db:restore -- dev-2026-08-12_14-30-00.db
 * Ohne Argument: neuestes Backup in prisma/backups/
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const backupDir = path.join(root, "prisma", "backups");
const dest = path.join(root, "prisma", "dev.db");
const arg = process.argv[2];

if (!fs.existsSync(backupDir)) {
  console.error("Kein Backup-Ordner:", backupDir);
  process.exit(1);
}

let src;
if (arg) {
  src = path.isAbsolute(arg) ? arg : path.join(backupDir, arg);
} else {
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".db") && !f.includes("-journal"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) {
    console.error("Keine Backups gefunden in", backupDir);
    process.exit(1);
  }
  src = path.join(backupDir, files[0].name);
  console.log("Neuestes Backup:", files[0].name);
}

if (!fs.existsSync(src)) {
  console.error("Backup nicht gefunden:", src);
  process.exit(1);
}

// Sicherheitskopie der aktuellen DB vor dem Überschreiben
if (fs.existsSync(dest)) {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const safety = path.join(backupDir, `vor-restore-${stamp}.db`);
  fs.copyFileSync(dest, safety);
  console.log("Aktuelle DB gesichert als:", path.basename(safety));
}

fs.copyFileSync(src, dest);
const journal = `${src}-journal`;
if (fs.existsSync(journal)) {
  fs.copyFileSync(journal, `${dest}-journal`);
} else {
  const oldJournal = `${dest}-journal`;
  if (fs.existsSync(oldJournal)) fs.unlinkSync(oldJournal);
}

console.log("Wiederhergestellt aus:", src);
console.log("Fertig. Server ggf. neu starten.");
