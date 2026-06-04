const path = require("node:path");
const { app, BrowserWindow, Menu } = require("electron");

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
      nodeIntegration: false
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
