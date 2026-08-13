const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

let mainWindow = null;
let serverProcess = null;
let logStream = null;

function userDataDir() {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function userDataDbPath() {
  return path.join(userDataDir(), "dev.db").replace(/\\/g, "/");
}

function configPath() {
  return path.join(app.getPath("userData"), "schichtwerk.config.json");
}

function readConfig() {
  const defaults = {
    dbMode: "sqlite",
    mysqlUrl: "",
    webAccess: false,
    port: 3847,
    holidayRegion: "AT",
    companyName: "",
  };
  try {
    const file = configPath();
    if (!fs.existsSync(file)) return defaults;
    return { ...defaults, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return defaults;
  }
}

function logFilePath() {
  return path.join(app.getPath("userData"), "schichtwerk-start.log");
}

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  try {
    if (!logStream) {
      logStream = fs.createWriteStream(logFilePath(), { flags: "a" });
    }
    logStream.write(text);
  } catch {
    /* ignore */
  }
  console.log(line);
}

function appRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app");
  }
  const dist = path.join(__dirname, "..", "dist-windows-dienst");
  if (fs.existsSync(path.join(dist, "server.js"))) return dist;
  return path.join(__dirname, "..", ".next", "standalone");
}

function bundledNode(root) {
  const exe = process.platform === "win32" ? "node.exe" : "node";
  const candidate = path.join(root, exe);
  return fs.existsSync(candidate) ? candidate : null;
}

function waitForServer(url, attempts = 240) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(url, { timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("timeout", () => {
        req.destroy();
      });
      req.on("error", () => {
        left -= 1;
        if (left <= 0) {
          reject(
            new Error(
              "Server startete nicht rechtzeitig.\n\n" +
                `Protokoll: ${logFilePath()}`,
            ),
          );
        } else {
          setTimeout(tick, 500);
        }
      });
    };
    tick();
  });
}

function spawnNode(root, args, opts) {
  const nodePath = bundledNode(root);
  const env = { ...(opts.env || {}) };
  const command = nodePath || process.execPath;
  if (!nodePath) {
    env.ELECTRON_RUN_AS_NODE = "1";
    log("Hinweis: gebündelte node.exe fehlt, nutze Electron als Node.");
  } else {
    log(`Nutze gebündelte Runtime: ${command}`);
  }
  return spawn(command, args, {
    ...opts,
    env,
    windowsHide: true,
  });
}

function ensureDatabase(root, dbFile) {
  const dest = dbFile.replace(/\//g, path.sep);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    log(`Bestehende Datenbank: ${dest}`);
    return;
  }
  const template = path.join(root, "prisma", "template.db");
  if (fs.existsSync(template)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(template, dest);
    log(`Leere Vorlage kopiert nach ${dest}`);
    return;
  }
  log(
    "Keine Vorlagen-Datenbank gefunden – Prisma-Migration wird versuchen, sie anzulegen.",
  );
}

/**
 * Stellt node_modules bereit.
 * Im EXE-Build heißt der Ordner "vendor" (electron-builder streicht "node_modules").
 */
function ensureNodeModules(root) {
  const nm = path.join(root, "node_modules");
  const vendor = path.join(root, "vendor");
  const nextInNm = path.join(nm, "next", "package.json");
  const nextInVendor = path.join(vendor, "next", "package.json");

  if (fs.existsSync(nextInNm)) {
    log("Runtime-Check OK: node_modules/next vorhanden.");
    return nm;
  }

  if (fs.existsSync(nextInVendor)) {
    try {
      if (fs.existsSync(nm)) {
        // leerer/kaputter Ordner von electron-builder
        const entries = fs.readdirSync(nm);
        if (entries.length === 0) {
          fs.rmSync(nm, { recursive: true, force: true });
        }
      }
      if (!fs.existsSync(nm)) {
        // Windows: Junction; sonst Symlink
        const type = process.platform === "win32" ? "junction" : "dir";
        fs.symlinkSync(vendor, nm, type);
        log(`Junction/Symlink node_modules → vendor erstellt (${type}).`);
      }
    } catch (err) {
      log(
        `Hinweis: Symlink fehlgeschlagen (${err instanceof Error ? err.message : err}) – nutze NODE_PATH=vendor.`,
      );
    }
    if (fs.existsSync(nextInNm) || fs.existsSync(nextInVendor)) {
      log("Runtime-Check OK: vendor/next vorhanden.");
      return fs.existsSync(nm) ? nm : vendor;
    }
  }

  let listing = "(weder node_modules noch vendor)";
  try {
    if (fs.existsSync(nm)) {
      listing = "node_modules: " + (fs.readdirSync(nm).slice(0, 20).join(", ") || "(leer)");
    } else if (fs.existsSync(vendor)) {
      listing = "vendor: " + (fs.readdirSync(vendor).slice(0, 20).join(", ") || "(leer)");
    }
  } catch {
    /* ignore */
  }
  throw new Error(
    "Paket unvollständig: Modul „next“ fehlt.\n" +
      "Die EXE wurde fehlerhaft gebaut.\n\n" +
      `${listing}\n\n` +
      "Bitte neu bauen (npm run build:exe / GitHub Action).",
  );
}

function assertRuntimeFiles(root) {
  const serverJs = path.join(root, "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Installationsdateien fehlen (server.js).\nGesucht in:\n${root}`,
    );
  }
  return ensureNodeModules(root);
}

function runMigrate(root, env) {
  const prismaCli = path.join(
    root,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  if (!fs.existsSync(prismaCli)) {
    log("Prisma-CLI nicht im Paket – Migration übersprungen.");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    log("Starte Datenbank-Migration …");
    const mig = spawnNode(root, [prismaCli, "migrate", "deploy"], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      log("Migration dauert zu lange – wird übersprungen.");
      try {
        mig.kill();
      } catch {
        /* ignore */
      }
      resolve();
    }, 25000);

    mig.stdout?.on("data", (d) => log(`migrate: ${String(d).trim()}`));
    mig.stderr?.on("data", (d) => log(`migrate: ${String(d).trim()}`));
    mig.on("error", (err) => {
      clearTimeout(timer);
      log(`Migration Fehler: ${err.message}`);
      resolve();
    });
    mig.on("exit", (code) => {
      clearTimeout(timer);
      log(`Migration beendet (Code ${code}).`);
      resolve();
    });
  });
}

function startServer(root, env) {
  const serverJs = path.join(root, "server.js");
  const logPath = logFilePath();
  const out = fs.openSync(logPath, "a");
  serverProcess = spawnNode(root, [serverJs], {
    cwd: root,
    env,
    stdio: ["ignore", out, out],
  });

  serverProcess.on("error", (err) => {
    log(`Server-Prozess Fehler: ${err.message}`);
  });
  serverProcess.on("exit", (code, signal) => {
    log(`Server beendet: code=${code} signal=${signal}`);
  });
}

function createWindow() {
  if (!mainWindow) {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 960,
      minHeight: 640,
      title: "Schichtwerk",
      show: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  const splash = path.join(__dirname, "splash.html");
  if (fs.existsSync(splash)) {
    mainWindow.loadFile(splash);
  }
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {
      /* ignore */
    }
  }
  try {
    logStream?.end();
  } catch {
    /* ignore */
  }
}

async function boot() {
  const cfg = readConfig();
  const root = appRoot();
  const dbFile = userDataDbPath();
  const port = String(cfg.port || process.env.SCHICHTWERK_PORT || 3847);
  const host = cfg.webAccess ? "0.0.0.0" : "127.0.0.1";

  log(`Start. packaged=${app.isPackaged}`);
  log(`App-Root: ${root}`);
  log(`Datenbank: ${dbFile}`);
  log(`Bind: ${host}:${port} (webAccess=${Boolean(cfg.webAccess)})`);

  const modulesDir = assertRuntimeFiles(root);

  let databaseUrl = `file:${dbFile}`;
  if (cfg.dbMode === "mysql" && cfg.mysqlUrl) {
    databaseUrl = cfg.mysqlUrl;
  }

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: host,
    HOST: host,
    DATABASE_URL: databaseUrl,
    SCHICHTWERK_CONFIG: configPath(),
    NEXT_TELEMETRY_DISABLED: "1",
    // Fallback, falls Symlink nicht möglich ist
    NODE_PATH: [modulesDir, path.join(root, "vendor"), path.join(root, "node_modules")]
      .filter((p, i, arr) => fs.existsSync(p) && arr.indexOf(p) === i)
      .join(path.delimiter),
  };

  ensureDatabase(root, dbFile);
  if (cfg.dbMode !== "mysql") {
    await runMigrate(root, env);
  }
  startServer(root, env);

  const started = new Promise((resolve, reject) => {
    const onExit = (code) => {
      reject(
        new Error(
          `Der interne Server ist sofort beendet (Code ${code}).\n\n` +
            `Protokoll: ${logFilePath()}`,
        ),
      );
    };
    if (serverProcess) {
      serverProcess.once("exit", onExit);
    }
    waitForServer(`http://127.0.0.1:${port}/api/health`)
      .then(() => {
        serverProcess?.off("exit", onExit);
        resolve();
      })
      .catch(reject);
  });

  await started;
  log("Server erreichbar, öffne Oberfläche.");
  if (mainWindow) {
    mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    boot().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      log(`STARTFEHLER: ${message}`);
      dialog.showErrorBox("Schichtwerk Startfehler", message);
      stopServer();
      app.quit();
    });
  });

  app.on("window-all-closed", () => {
    stopServer();
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => stopServer());
}
