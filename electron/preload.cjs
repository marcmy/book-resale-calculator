const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bookResaleDesktop", {
  platform: process.platform,
  amazonEligibilityAvailable: false,
  credentials: {
    getStatus: () => ipcRenderer.invoke("credentials:getStatus"),
    save: (credentials) => ipcRenderer.invoke("credentials:save", credentials),
    clear: () => ipcRenderer.invoke("credentials:clear")
  },
  amazon: {
    checkEligibility: (request) => ipcRenderer.invoke("amazon:checkEligibility", request)
  }
});
