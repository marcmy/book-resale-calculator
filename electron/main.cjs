const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, Menu, net } = require("electron");
const { createRateService } = require("./usps-rates.cjs");

const GET_CURRENT_RATES = "usps-rates:get-current";
const RATES_UPDATED = "usps-rates:updated";
const REFRESH_POLL_INTERVAL_MS = 60 * 60 * 1000;
const APP_ENTRY_PATH = path.join(__dirname, "..", "index.html");
const APP_ENTRY_URL = pathToFileURL(APP_ENTRY_PATH).href;

let rateService;
let refreshTimer;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 780,
    height: 720,
    minWidth: 740,
    minHeight: 700,
    title: "Book Resale Calculator",
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    backgroundColor: "#f5f7fa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(APP_ENTRY_PATH);
}

function assertTrustedSender(event) {
  if (!event.senderFrame || event.senderFrame.url !== APP_ENTRY_URL) {
    throw new Error("Rejected USPS rate request from an untrusted page.");
  }
}

async function refreshRates() {
  const result = await rateService.refreshIfDue();

  if (!result.updated) {
    return;
  }

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(RATES_UPDATED, result.data);
    }
  });
}

app.whenReady().then(() => {
  rateService = createRateService({
    app,
    fetch: (url, options) => net.fetch(url, options)
  });

  ipcMain.handle(GET_CURRENT_RATES, (event) => {
    assertTrustedSender(event);
    return rateService.getCurrent();
  });

  createWindow();
  void refreshRates();
  refreshTimer = setInterval(() => void refreshRates(), REFRESH_POLL_INTERVAL_MS);
  refreshTimer.unref();

  if (process.env.BRC_SMOKE_TEST === "1") {
    setTimeout(() => app.quit(), 1500);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
