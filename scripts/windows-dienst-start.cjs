/**
 * Startpunkt fuer den Windows-Dienst: Migrationen anwenden, bei Bedarf
 * Beispieldaten laden, dann den Standalone-Server starten.
 * Wird von nssm als Dienst-Kommando aufgerufen (node windows-dienst-start.cjs).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = __dirname;
process.chdir(root);

if (!process.env.DATABASE_URL) {
  const dbPath = path.join(root, "prisma", "dev.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${dbPath}`;
}
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.PORT = process.env.PORT || "3000";
process.env.NODE_ENV = "production";

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    cwd: root,
    env: process.env,
  });
  return result.status === 0;
}

console.log("Schichtwerk-Dienst startet ...");
console.log("Ordner:", root);
console.log("DATABASE_URL:", process.env.DATABASE_URL);

const migrateOk = run("node", [
  path.join("node_modules", "prisma", "build", "index.js"),
  "migrate",
  "deploy",
]);
if (!migrateOk) {
  console.error("WARNUNG: Migrationen konnten nicht angewendet werden.");
}

try {
  const { PrismaClient } = require(path.join(root, "node_modules", "@prisma", "client"));
  const prisma = new PrismaClient();
  prisma.employee
    .count()
    .then((count) => {
      prisma.$disconnect();
      if (count === 0) {
        console.log("Datenbank leer -> Beispieldaten werden geladen ...");
        run("node", [
          "--import",
          "tsx",
          path.join("prisma", "seed.ts"),
        ]);
      }
      startServer();
    })
    .catch((err) => {
      console.error("Konnte Mitarbeiterzahl nicht prüfen:", err.message);
      startServer();
    });
} catch (err) {
  console.error("Seed-Prüfung übersprungen:", err.message);
  startServer();
}

function startServer() {
  console.log("Starte Server auf Port", process.env.PORT, "...");
  const child = require("child_process").spawn(
    process.execPath,
    [path.join(root, "server.js")],
    { stdio: "inherit", env: process.env, cwd: root },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}
