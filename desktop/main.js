const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = process.env.SCHICHTWERK_PORT || "3847";
const HOST = "127.0.0.1";

let mainWindow = null;
let serverProcess = null;

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

function createWindow() {
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

  mainWindow.loadURL(`http://${HOST}:${PORT}/`);
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

async function boot() {
  const root = appRoot();
  const dbFile = userDataDbPath();
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: HOST,
    DATABASE_URL: `file:${dbFile}`,
  };

  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(prismaCli)) {
    await new Promise((resolve, reject) => {
      const mig = runNode([prismaCli, "migrate", "deploy"], {
        cwd: root,
        env,
        stdio: "inherit",
      });
      mig.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error("Migration fehlgeschlagen")),
      );
    });
  }

  startServer(root, env);
  await waitForServer(`http://${HOST}:${PORT}/api/health`);
  createWindow();
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
    boot().catch((err) => {
      dialog.showErrorBox(
        "Schichtwerk Startfehler",
        err instanceof Error ? err.message : String(err),
      );
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
