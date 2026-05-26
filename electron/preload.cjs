const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("bookResaleDesktop", {
  platform: process.platform,
  amazonEligibilityAvailable: false
});
