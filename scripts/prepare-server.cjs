/**
 * Windows-Server Vorbereitung: .env, Migrationen, optional Seed.
 * Wird von starten-server.bat aufgerufen.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Befehl fehlgeschlagen: ${command} ${args.join(" ")}`);
  }
}

function ensureEnv() {
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
}

async function maybeSeed() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const count = await prisma.employee.count();
    console.log(`Mitarbeiter in DB: ${count}`);
    if (count === 0) {
      console.log("Datenbank leer -> Beispieldaten werden geladen ...");
      run("npm", ["run", "db:seed"]);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log("Schichtwerk Vorbereitung gestartet ...");
  console.log("Ordner:", process.cwd());

  if (!fs.existsSync(path.join(process.cwd(), "package.json"))) {
    throw new Error(
      "package.json nicht gefunden. Bitte starten-server.bat im Projektordner ausfuehren.",
    );
  }

  ensureEnv();

  if (!fs.existsSync(path.join(process.cwd(), "node_modules"))) {
    console.log("node_modules fehlt -> npm install ...");
    run("npm", ["install"]);
  }

  run("npx", ["prisma", "generate"]);
  run("npx", ["prisma", "migrate", "deploy"]);

  const dbFile = path.join(process.cwd(), "prisma", "dev.db");
  if (!fs.existsSync(dbFile)) {
    throw new Error("prisma/dev.db wurde nicht erstellt.");
  }

  await maybeSeed();

  const buildId = path.join(process.cwd(), ".next", "BUILD_ID");
  if (!fs.existsSync(buildId)) {
    console.log("Kein Build vorhanden -> npm run build (kann einige Minuten dauern) ...");
    run("npm", ["run", "build"]);
  }

  console.log("\nVorbereitung OK.");
}

main().catch((error) => {
  console.error("\nFEHLER:", error && error.message ? error.message : error);
  process.exit(1);
});
