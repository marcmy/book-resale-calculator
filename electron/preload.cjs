const { contextBridge, ipcRenderer } = require("electron");

const GET_CURRENT_RATES = "usps-rates:get-current";
const RATES_UPDATED = "usps-rates:updated";

contextBridge.exposeInMainWorld("uspsRates", Object.freeze({
  getCurrent() {
    return ipcRenderer.invoke(GET_CURRENT_RATES);
  },
  onUpdated(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("USPS rate update callback must be a function.");
    }

    const listener = (_event, data) => callback(data);
    ipcRenderer.on(RATES_UPDATED, listener);

    return () => {
      ipcRenderer.removeListener(RATES_UPDATED, listener);
    };
  }
}));
