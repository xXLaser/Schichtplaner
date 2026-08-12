/**
 * Baut Next-Standalone + Electron portable EXE (release/Schichtwerk.exe).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(`Befehl fehlgeschlagen: ${command} ${args.join(" ")}`);
  }
}

function main() {
  const bundledDb = path.join(root, "dist-windows-dienst", "prisma", "dev.db");
  const bak = bundledDb + ".bak-exclude-from-exe";
  let movedDb = false;

  try {
    console.log("1) Next/Windows-Dienst-Paket bauen (Dienst bitte gestoppt) ...");
    run("node", ["scripts/build-windows-dienst-paket.cjs"]);

    // Leere First-Run-DB in der EXE: Produktions-DB kurz aus dem Paket nehmen
    if (fs.existsSync(bundledDb)) {
      fs.renameSync(bundledDb, bak);
      movedDb = true;
      console.log("Produktions-DB aus EXE-Paket ausgeklammert (First-Run).");
    }

    console.log("2) Electron-Abhängigkeiten ...");
    run("npm", ["install"], path.join(root, "desktop"));

    console.log("3) Portable EXE erzeugen ...");
    run("npm", ["run", "pack"], path.join(root, "desktop"));

    console.log("\nFertig: release/Schichtwerk.exe");
    console.log(
      "Datenbank nach dem Start: %LOCALAPPDATA%\\schichtwerk-desktop\\data\\dev.db",
    );
  } finally {
    if (movedDb && fs.existsSync(bak)) {
      fs.renameSync(bak, bundledDb);
      console.log("Produktions-DB wiederhergestellt.");
    }
  }
}

main();
