/**
 * Baut Next-Standalone + Electron portable EXE (release/Schichtwerk.exe).
 *
 * electron-builder entfernt nested "node_modules" aus extraResources.
 * Deshalb: node_modules → vendor umbenennen (prepare-exe-vendor.cjs).
 * desktop/main.js verknüpft beim Start wieder auf node_modules / setzt NODE_PATH.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist-windows-dienst");

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

function assertDistReady(expectVendor = false) {
  const serverJs = path.join(distDir, "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error("dist-windows-dienst/server.js fehlt nach dem Build.");
  }
  const nextPath = expectVendor
    ? path.join(distDir, "vendor", "next", "package.json")
    : path.join(distDir, "node_modules", "next", "package.json");
  if (!fs.existsSync(nextPath)) {
    throw new Error(
      `next fehlt unter ${expectVendor ? "vendor" : "node_modules"}.`,
    );
  }
  const dir = expectVendor
    ? path.join(distDir, "vendor")
    : path.join(distDir, "node_modules");
  console.log(
    `Paket-Check OK: server.js + next (${fs.readdirSync(dir).length} Einträge in ${path.basename(dir)}).`,
  );
}

function restoreVendorToNodeModules() {
  const nm = path.join(distDir, "node_modules");
  const vendor = path.join(distDir, "vendor");
  if (fs.existsSync(vendor) && !fs.existsSync(nm)) {
    fs.renameSync(vendor, nm);
    console.log("vendor → node_modules zurückbenannt (für Windows-Dienst-Paket).");
  }
}

function main() {
  const bundledDb = path.join(distDir, "prisma", "dev.db");
  const bak = bundledDb + ".bak-exclude-from-exe";
  let movedDb = false;

  try {
    console.log("1) Next/Windows-Dienst-Paket bauen …");
    run("node", ["scripts/build-windows-dienst-paket.cjs"]);
    assertDistReady(false);

    console.log("2) node_modules → vendor (electron-builder-Workaround) …");
    run("node", ["scripts/prepare-exe-vendor.cjs"]);
    assertDistReady(true);

    if (fs.existsSync(bundledDb)) {
      fs.renameSync(bundledDb, bak);
      movedDb = true;
      console.log("Produktions-DB aus EXE-Paket ausgeklammert (First-Run).");
    }

    console.log("3) Node.js-Runtime und Electron-Abhängigkeiten …");
    const nodeName = process.platform === "win32" ? "node.exe" : "node";
    const nodeDest = path.join(distDir, nodeName);
    try {
      fs.copyFileSync(process.execPath, nodeDest);
      console.log("Runtime kopiert:", nodeDest);
    } catch (err) {
      console.warn(
        "WARNUNG: Runtime konnte nicht kopiert werden:",
        err instanceof Error ? err.message : err,
      );
    }

    run("npm", ["install"], path.join(root, "desktop"));

    console.log("4) Portable EXE erzeugen …");
    run("npm", ["run", "pack"], path.join(root, "desktop"));

    const exe = path.join(root, "release", "Schichtwerk.exe");
    if (!fs.existsSync(exe)) {
      throw new Error("release/Schichtwerk.exe wurde nicht erzeugt.");
    }
    const sizeMb = fs.statSync(exe).size / (1024 * 1024);
    console.log(`\nFertig: ${exe} (${sizeMb.toFixed(1)} MB)`);
    // Mit Next+Deps erwartet ~80–200MB; unter 50MB ist verdächtig
    if (sizeMb < 50) {
      throw new Error(
        `EXE zu klein (${sizeMb.toFixed(1)} MB) – vendor/node_modules fehlen vermutlich im Paket.`,
      );
    }
    console.log(
      "Datenbank nach dem Start: %APPDATA%\\schichtwerk-desktop\\data\\dev.db",
    );
  } finally {
    if (movedDb && fs.existsSync(bak)) {
      fs.renameSync(bak, bundledDb);
      console.log("Produktions-DB wiederhergestellt.");
    }
    restoreVendorToNodeModules();
  }
}

main();
