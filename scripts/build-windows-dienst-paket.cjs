/**
 * Baut die App und kopiert eine eigenstaendige, startklare Version
 * nach .\dist-windows-dienst (ohne node_modules-Installationsschritt
 * auf dem Zielserver notwendig).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const distDir = path.join(root, "dist-windows-dienst");

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    cwd: root,
  });
  if (result.status !== 0) {
    throw new Error(`Befehl fehlgeschlagen: ${command} ${args.join(" ")}`);
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function main() {
  console.log("Schichtwerk: eigenstaendiges Paket fuer Windows-Dienst wird erstellt ...");

  run("npx", ["prisma", "generate"]);
  run("npm", ["run", "build"]);

  const standaloneDir = path.join(root, ".next", "standalone");
  if (!fs.existsSync(standaloneDir)) {
    throw new Error(
      "'.next/standalone' fehlt. Ist 'output: \"standalone\"' in next.config.ts gesetzt?",
    );
  }

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  console.log("Kopiere eigenstaendige Server-Dateien ...");
  copyRecursive(standaloneDir, distDir);
  copyRecursive(
    path.join(root, ".next", "static"),
    path.join(distDir, ".next", "static"),
  );
  copyRecursive(path.join(root, "public"), path.join(distDir, "public"));

  // Migrationen mitliefern (im Standalone-Trace nicht automatisch enthalten)
  copyRecursive(
    path.join(root, "prisma", "migrations"),
    path.join(distDir, "prisma", "migrations"),
  );
  copyRecursive(
    path.join(root, "prisma", "schema.prisma"),
    path.join(distDir, "prisma", "schema.prisma"),
  );

  // Prisma-CLI wird fuer "migrate deploy" auf dem Server benoetigt
  const prismaCliSrc = path.join(root, "node_modules", "prisma");
  const prismaCliDest = path.join(distDir, "node_modules", "prisma");
  copyRecursive(prismaCliSrc, prismaCliDest);

  // Seed-Skript + tsx fuer Erstbefuellung
  copyRecursive(
    path.join(root, "prisma", "seed.ts"),
    path.join(distDir, "prisma", "seed.ts"),
  );
  copyRecursive(
    path.join(root, "node_modules", "tsx"),
    path.join(distDir, "node_modules", "tsx"),
  );

  copyRecursive(
    path.join(root, "scripts", "windows-dienst-start.cjs"),
    path.join(distDir, "windows-dienst-start.cjs"),
  );

  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  fs.writeFileSync(
    path.join(distDir, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        private: true,
        scripts: {
          "db:seed": "node --import tsx prisma/seed.ts",
        },
        prisma: { seed: "node --import tsx prisma/seed.ts" },
      },
      null,
      2,
    ),
  );

  console.log(`\nFertig. Eigenstaendiges Paket liegt in:\n  ${distDir}`);
  console.log(
    "Dieser Ordner kann per Kopie/ZIP auf den Zielserver uebertragen werden.",
  );
}

main().catch((error) => {
  console.error("\nFEHLER:", error.message);
  process.exit(1);
});
