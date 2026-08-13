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

function userDir() {
  const dir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "Schichtwerk",
  );
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  return dir;
}

function readConfig() {
  const defaults = {
    dbMode: "sqlite",
    mysqlUrl: "",
    webAccess: false,
    port: 3847,
    holidayRegion: "AT",
  };
  const file = path.join(userDir(), "schichtwerk.config.json");
  try {
    if (!fs.existsSync(file)) return { ...defaults, file };
    return { ...defaults, ...JSON.parse(fs.readFileSync(file, "utf8")), file };
  } catch {
    return { ...defaults, file };
  }
}

function waitForHealth(host, port, attempts = 60) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      http
        .get(`http://127.0.0.1:${port}/api/health`, (res) => {
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

  const cfg = readConfig();
  const port = String(cfg.port || 3847);
  const host = cfg.webAccess ? "0.0.0.0" : "127.0.0.1";
  const dbFile = path.join(userDir(), "data", "dev.db").replace(/\\/g, "/");
  const databaseUrl =
    cfg.dbMode === "mysql" && cfg.mysqlUrl
      ? cfg.mysqlUrl
      : `file:${dbFile}`;

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: host,
    DATABASE_URL: databaseUrl,
    SCHICHTWERK_CONFIG: cfg.file,
  };

  if (cfg.dbMode !== "mysql") {
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
  }

  console.log("Server startet auf", `http://${host}:${port}`);
  const child = spawn(process.execPath, [path.join(root, "server.js")], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  await waitForHealth(host, port);
  const url = `http://127.0.0.1:${port}/`;
  exec(`start "" "${url}"`);

  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
