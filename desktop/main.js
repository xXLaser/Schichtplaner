const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

let mainWindow = null;
let setupWindow = null;
let serverProcess = null;
let bootingAfterSetup = false;

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8");
}

function userDataDbPath() {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "dev.db").replace(/\\/g, "/");
}

function appRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app");
  }
  const dist = path.join(__dirname, "..", "dist-windows-dienst");
  if (fs.existsSync(path.join(dist, "server.js"))) return dist;
  return path.join(__dirname, "..", ".next", "standalone");
}

function waitForServer(url, attempts = 90) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        left -= 1;
        if (left <= 0) reject(new Error("Server startete nicht rechtzeitig."));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

function runNode(args, opts) {
  return spawn(process.execPath, args, {
    ...opts,
    env: {
      ...opts.env,
      ELECTRON_RUN_AS_NODE: "1",
    },
  });
}

function startServer(root, env) {
  const serverJs = path.join(root, "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error(`server.js nicht gefunden: ${serverJs}`);
  }

  serverProcess = runNode([serverJs], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  serverProcess.on("exit", (code) => {
    console.log("Server beendet:", code);
  });
}

function createWindow(host, port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Schichtwerk",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}/`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {
      /* ignore */
    }
  }
}

function showFirstRun() {
  setupWindow = new BrowserWindow({
    width: 560,
    height: 640,
    resizable: false,
    title: "Schichtwerk einrichten",
    webPreferences: {
      preload: path.join(__dirname, "first-run-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  setupWindow.loadFile(path.join(__dirname, "first-run.html"));
  setupWindow.on("closed", () => {
    setupWindow = null;
    if (!readConfig()) app.quit();
  });
}

async function boot(saved) {
  const root = appRoot();
  const webAccess = Boolean(saved.webAccess);
  const host = webAccess ? "0.0.0.0" : "127.0.0.1";
  const port = String(saved.port || 3847);
  const provider = saved.databaseProvider === "mysql" ? "mysql" : "sqlite";
  const sqliteUrl = `file:${userDataDbPath()}`;
  const databaseUrl =
    provider === "mysql" && saved.databaseUrl ? saved.databaseUrl : sqliteUrl;

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: host,
    SCHICHTWERK_WEB_ACCESS: webAccess ? "1" : "0",
    SCHICHTWERK_DB_PROVIDER: provider,
    SCHICHTWERK_CONFIG_PATH: configPath(),
    DATABASE_URL: databaseUrl,
    MYSQL_DATABASE_URL: provider === "mysql" ? databaseUrl : "mysql://root:root@127.0.0.1:3306/schichtwerk",
  };

  const schemaArg =
    provider === "mysql"
      ? ["--schema", path.join(root, "prisma", "schema.mysql.prisma")]
      : [];

  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(prismaCli)) {
    await new Promise((resolve, reject) => {
      const args =
        provider === "mysql"
          ? [prismaCli, "db", "push", "--accept-data-loss", ...schemaArg]
          : [prismaCli, "migrate", "deploy"];
      const mig = runNode(args, {
        cwd: root,
        env,
        stdio: "inherit",
      });
      mig.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error("Datenbank-Migration fehlgeschlagen")),
      );
    });
  }

  startServer(root, env);
  await waitForServer(`http://127.0.0.1:${port}/api/health`);
  createWindow(host, port);
}

ipcMain.handle("first-run-save", async (_event, incoming) => {
  if (!incoming || (incoming.databaseProvider === "mysql" && !incoming.databaseUrl)) {
    throw new Error("Bitte eine MySQL-Verbindung angeben.");
  }
  const config = {
    databaseProvider: incoming.databaseProvider === "mysql" ? "mysql" : "sqlite",
    databaseUrl: incoming.databaseUrl || "",
    webAccess: Boolean(incoming.webAccess),
    port: Number(incoming.port) || 3847,
    holidayRegion: "AT",
    planningDays: 14,
  };
  writeConfig(config);
  bootingAfterSetup = true;
  if (setupWindow) {
    setupWindow.close();
    setupWindow = null;
  }
  try {
    await boot(config);
  } finally {
    bootingAfterSetup = false;
  }
  return { ok: true };
});

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
    const saved = readConfig();
    if (!saved) {
      showFirstRun();
      return;
    }
    boot(saved).catch((err) => {
      dialog.showErrorBox(
        "Schichtwerk Startfehler",
        err instanceof Error ? err.message : String(err),
      );
      stopServer();
      app.quit();
    });
  });

  app.on("window-all-closed", () => {
    if (bootingAfterSetup) return;
    stopServer();
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => stopServer());
}
