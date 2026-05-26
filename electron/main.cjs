const path = require("node:path");
const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const keytar = require("keytar");
const { checkListingsEligibility, toSafeErrorResult } = require("./sp-api.cjs");

const CREDENTIAL_SERVICE = "Book Resale Calculator Amazon SP-API";
const CREDENTIAL_FIELDS = [
  ["lwaClientId", "LWA client ID"],
  ["lwaClientSecret", "LWA client secret"],
  ["lwaRefreshToken", "LWA refresh token"],
  ["sellerId", "Seller ID"],
  ["marketplaceId", "Marketplace ID"]
];

function normalizeCredentialValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getCredentialStatus() {
  const missing = [];

  for (const [key, label] of CREDENTIAL_FIELDS) {
    const value = await keytar.getPassword(CREDENTIAL_SERVICE, key);

    if (!value) {
      missing.push(label);
    }
  }

  return {
    available: true,
    configured: missing.length === 0,
    missing
  };
}

async function getStoredCredentials() {
  const credentials = {};

  for (const [key] of CREDENTIAL_FIELDS) {
    credentials[key] = await keytar.getPassword(CREDENTIAL_SERVICE, key);
  }

  return credentials;
}

function registerCredentialHandlers() {
  ipcMain.handle("credentials:getStatus", async () => getCredentialStatus());

  ipcMain.handle("credentials:save", async (_event, credentials) => {
    const normalized = {};
    const missing = [];

    for (const [key, label] of CREDENTIAL_FIELDS) {
      normalized[key] = normalizeCredentialValue(credentials && credentials[key]);

      if (!normalized[key]) {
        missing.push(label);
      }
    }

    if (missing.length > 0) {
      return {
        available: true,
        configured: false,
        missing,
        saved: false
      };
    }

    for (const [key] of CREDENTIAL_FIELDS) {
      await keytar.setPassword(CREDENTIAL_SERVICE, key, normalized[key]);
    }

    return {
      ...(await getCredentialStatus()),
      saved: true
    };
  });

  ipcMain.handle("credentials:clear", async () => {
    for (const [key] of CREDENTIAL_FIELDS) {
      await keytar.deletePassword(CREDENTIAL_SERVICE, key);
    }

    return getCredentialStatus();
  });

  ipcMain.handle("amazon:checkEligibility", async (_event, request) => {
    const status = await getCredentialStatus();

    if (!status.configured) {
      return {
        status: "setup_needed",
        severity: "warn",
        label: "Setup needed",
        message: "Save Amazon SP-API credentials before checking eligibility.",
        missing: status.missing
      };
    }

    try {
      return await checkListingsEligibility(await getStoredCredentials(), request || {});
    } catch (error) {
      return toSafeErrorResult(error);
    }
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 940,
    minWidth: 920,
    minHeight: 900,
    title: "Book Resale Calculator",
    backgroundColor: "#f5f7fa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  registerCredentialHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
