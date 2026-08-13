const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("schichtwerk", {
  saveFirstRun: (config) => ipcRenderer.invoke("first-run-save", config),
});
