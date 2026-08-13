/**
 * electron-builder entfernt nested Ordner namens "node_modules" aus extraResources.
 * Deshalb benennen wir sie vor dem Packen in "vendor" um. desktop/main.js
 * stellt beim Start einen Junction/Symlink node_modules → vendor her bzw. setzt NODE_PATH.
 */
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist-windows-dienst");
const nm = path.join(distDir, "node_modules");
const vendor = path.join(distDir, "vendor");

function main() {
  if (!fs.existsSync(nm)) {
    throw new Error("dist-windows-dienst/node_modules fehlt – Build zuerst ausführen.");
  }
  if (fs.existsSync(vendor)) {
    fs.rmSync(vendor, { recursive: true, force: true });
  }
  fs.renameSync(nm, vendor);

  const nextPkg = path.join(vendor, "next", "package.json");
  if (!fs.existsSync(nextPkg)) {
    throw new Error("vendor/next fehlt nach dem Umbenennen.");
  }
  console.log("node_modules → vendor umbenannt (electron-builder-sicher).");
}

main();
