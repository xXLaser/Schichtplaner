const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = process.env.SCHICHTWERK_PORT || "3847";
const HOST = "127.0.0.1";

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
  log("Keine Vorlagen-Datenbank gefunden – Prisma-Migration wird versuchen, sie anzulegen.");
}

function runMigrate(root, env) {
  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
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
  if (!fs.existsSync(serverJs)) {
    throw new Error(`server.js nicht gefunden:\n${serverJs}`);
  }

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
  const root = appRoot();
  const dbFile = userDataDbPath();
  log(`Start. packaged=${app.isPackaged}`);
  log(`App-Root: ${root}`);
  log(`Datenbank: ${dbFile}`);

  if (!fs.existsSync(path.join(root, "server.js"))) {
    throw new Error(
      `Installationsdateien fehlen (server.js).\nGesucht in:\n${root}`,
    );
  }

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: HOST,
    HOST,
    DATABASE_URL: `file:${dbFile}`,
    NEXT_TELEMETRY_DISABLED: "1",
  };

  ensureDatabase(root, dbFile);
  await runMigrate(root, env);
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
    waitForServer(`http://${HOST}:${PORT}/api/health`)
      .then(() => {
        serverProcess?.off("exit", onExit);
        resolve();
      })
      .catch(reject);
  });

  await started;
  log("Server erreichbar, öffne Oberfläche.");
  if (mainWindow) {
    mainWindow.loadURL(`http://${HOST}:${PORT}/`);
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
