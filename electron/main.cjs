const path = require("node:path");
const { app, BrowserWindow, Menu } = require("electron");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 920,
    minHeight: 680,
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
