/**
 * Lokaler Starter ohne Electron: Server + Browser.
 * Nutzung: node scripts/local-launcher.cjs
 * Oder Doppelklick auf starten-lokal.bat
 */
const { spawn, exec } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const os = require("os");

const root = path.join(__dirname, "..", "dist-windows-dienst");
const PORT = process.env.SCHICHTWERK_PORT || "3847";
const HOST = "127.0.0.1";

function userDb() {
  const dir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "Schichtwerk",
    "data",
  );
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "dev.db").replace(/\\/g, "/");
}

function waitForHealth(attempts = 60) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      http
        .get(`http://${HOST}:${PORT}/api/health`, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          left -= 1;
          if (left <= 0) reject(new Error("Server startet nicht."));
          else setTimeout(tick, 500);
        });
    };
    tick();
  });
}

async function main() {
  if (!fs.existsSync(path.join(root, "server.js"))) {
    console.error("dist-windows-dienst fehlt. Bitte zuerst bauen:");
    console.error("  node scripts/build-windows-dienst-paket.cjs");
    process.exit(1);
  }

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: HOST,
    DATABASE_URL: `file:${userDb()}`,
  };

  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(prismaCli)) {
    console.log("Migrationen ...");
    await new Promise((resolve, reject) => {
      const mig = spawn(process.execPath, [prismaCli, "migrate", "deploy"], {
        cwd: root,
        env,
        stdio: "inherit",
      });
      mig.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("migrate"))));
    });
  }

  console.log("Server startet auf", `http://${HOST}:${PORT}`);
  const child = spawn(process.execPath, [path.join(root, "server.js")], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  await waitForHealth();
  const url = `http://${HOST}:${PORT}/`;
  exec(`start "" "${url}"`);

  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
