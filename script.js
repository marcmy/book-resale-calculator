(function () {
  "use strict";

  var root = typeof globalThis !== "undefined" ? globalThis : window;
  var MEDIA_MAIL_RATE_DATA = getRateData();
  var MEDIA_MAIL_RATES = MEDIA_MAIL_RATE_DATA.rates;

  var DEFAULTS = {
    sellPrice: 100,
    feePercent: 15,
    fixedFee: 1.8,
    materialsFee: 0.5,
    weightLbs: 1,
    weightOz: 8,
    shippingMode: "media-mail",
    customShipping: 0,
    buyCost: null,
    targetRoi: 100
  };

  function getRateData() {
    var rateData = root.USPS_MEDIA_MAIL;

    if (!rateData && typeof require !== "undefined") {
      rateData = require("./rates.js");
    }

    if (!rateData || !Array.isArray(rateData.rates) || rateData.rates.length === 0) {
      throw new Error("USPS Media Mail rates are not available.");
    }

    return rateData;
  }

  function money(value) {
    var normalized = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(normalized);
  }

  function percent(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 1
    }).format(value) + "%";
  }

  function formatEffectiveDate(value) {
    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value || "Rates unavailable";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  function getSavedThemeChoice() {
    try {
      return localStorage.getItem("bookResaleTheme") || "auto";
    } catch (error) {
      return "auto";
    }
  }

  function resolveTheme(choice) {
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

    return choice === "auto" ? (prefersDark ? "dark" : "light") : choice;
  }

  function applyThemeChoice(choice) {
    var normalizedChoice = choice === "light" || choice === "dark" ? choice : "auto";

    document.documentElement.dataset.themeChoice = normalizedChoice;
    document.documentElement.dataset.theme = resolveTheme(normalizedChoice);

    try {
      localStorage.setItem("bookResaleTheme", normalizedChoice);
    } catch (error) {
      // Theme preference still works for the current session if storage is unavailable.
    }
  }

  function getDesktopCredentials() {
    return window.bookResaleDesktop && window.bookResaleDesktop.credentials
      ? window.bookResaleDesktop.credentials
      : null;
  }

  function setStatusTone(element, tone) {
    element.classList.toggle("is-warn", tone === "warn");
    element.classList.toggle("is-negative", tone === "negative");
  }

  function setCredentialStatus(output, status) {
    if (!output.credentialStatus) {
      return;
    }

    if (!getDesktopCredentials()) {
      output.credentialStatus.textContent = "Desktop app only";
      setStatusTone(output.credentialStatus, "warn");
      return;
    }

    if (status && status.configured) {
      output.credentialStatus.textContent = "Saved";
      setStatusTone(output.credentialStatus, null);
      return;
    }

    output.credentialStatus.textContent = "Setup needed";
    setStatusTone(output.credentialStatus, "warn");
  }

  async function refreshCredentialStatus(output) {
    var credentials = getDesktopCredentials();

    if (!credentials) {
      setCredentialStatus(output, null);
      return null;
    }

    try {
      var status = await credentials.getStatus();
      setCredentialStatus(output, status);
      return status;
    } catch (error) {
      output.credentialStatus.textContent = "Storage error";
      setStatusTone(output.credentialStatus, "negative");
      return null;
    }
  }

  function collectCredentialValues(output) {
    return {
      lwaClientId: output.credentialLwaClientId.value,
      lwaClientSecret: output.credentialLwaClientSecret.value,
      lwaRefreshToken: output.credentialLwaRefreshToken.value,
      sellerId: output.credentialSellerId.value,
      marketplaceId: output.credentialMarketplaceId.value
    };
  }

  function clearCredentialInputs(output) {
    output.credentialLwaClientId.value = "";
    output.credentialLwaClientSecret.value = "";
    output.credentialLwaRefreshToken.value = "";
    output.credentialSellerId.value = "";
    output.credentialMarketplaceId.value = "ATVPDKIKX0DER";
  }

  function initCredentialControls(output) {
    output.credentialOpenButton.addEventListener("click", function () {
      output.credentialMessage.textContent = getDesktopCredentials()
        ? "Enter the SP-API values from Seller Central."
        : "Open the Electron desktop app to save credentials securely.";
      output.credentialDialog.showModal();
    });

    output.credentialCloseButton.addEventListener("click", function () {
      output.credentialDialog.close();
    });

    output.credentialSaveButton.addEventListener("click", async function () {
      var credentials = getDesktopCredentials();

      if (!credentials) {
        output.credentialMessage.textContent = "Credential storage is only available in the desktop app.";
        return;
      }

      output.credentialMessage.textContent = "Saving...";

      try {
        var status = await credentials.save(collectCredentialValues(output));

        if (!status.configured) {
          output.credentialMessage.textContent = "Missing: " + status.missing.join(", ");
          setCredentialStatus(output, status);
          return;
        }

        clearCredentialInputs(output);
        output.credentialMessage.textContent = "Credentials saved.";
        setCredentialStatus(output, status);
        window.setTimeout(function () {
          output.credentialDialog.close();
        }, 500);
      } catch (error) {
        output.credentialMessage.textContent = "Could not save credentials.";
      }
    });

    output.credentialClearButton.addEventListener("click", async function () {
      var credentials = getDesktopCredentials();

      if (!credentials) {
        output.credentialMessage.textContent = "Credential storage is only available in the desktop app.";
        return;
      }

      output.credentialMessage.textContent = "Clearing...";

      try {
        var status = await credentials.clear();
        clearCredentialInputs(output);
        output.credentialMessage.textContent = "Saved credentials cleared.";
        setCredentialStatus(output, status);
      } catch (error) {
        output.credentialMessage.textContent = "Could not clear credentials.";
      }
    });

    refreshCredentialStatus(output);
  }

  function initThemeControls() {
    var controls = Array.prototype.slice.call(document.querySelectorAll("input[name='theme']"));
    var savedChoice = getSavedThemeChoice();
    var systemPreference = window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

    controls.forEach(function (control) {
      control.checked = control.value === savedChoice;
      control.addEventListener("change", function () {
        if (control.checked) {
          applyThemeChoice(control.value);
        }
      });
    });

    if (systemPreference && systemPreference.addEventListener) {
      systemPreference.addEventListener("change", function () {
        if (getSavedThemeChoice() === "auto") {
          applyThemeChoice("auto");
        }
      });
    }
  }

  function toNumber(value, fallback) {
    var number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getBillablePounds(weightLbs, weightOz) {
    var pounds = Math.max(0, toNumber(weightLbs, 0));
    var ounces = Math.max(0, toNumber(weightOz, 0));
    var totalPounds = pounds + ounces / 16;

    if (totalPounds <= 0) {
      return 0;
    }

    return clamp(Math.ceil(totalPounds), 1, MEDIA_MAIL_RATES.length);
  }

  function getMediaMailCost(billablePounds) {
    if (billablePounds <= 0) {
      return 0;
    }

    return MEDIA_MAIL_RATES[clamp(billablePounds, 1, MEDIA_MAIL_RATES.length) - 1];
  }

  function calculate(values) {
    var sellPrice = Math.max(0, toNumber(values.sellPrice, DEFAULTS.sellPrice));
    var feePercent = Math.max(0, toNumber(values.feePercent, DEFAULTS.feePercent));
    var fixedFee = Math.max(0, toNumber(values.fixedFee, DEFAULTS.fixedFee));
    var materialsFee = Math.max(0, toNumber(values.materialsFee, DEFAULTS.materialsFee));
    var targetRoi = Math.max(0, toNumber(values.targetRoi, DEFAULTS.targetRoi));
    var buyCost = values.buyCost === "" || values.buyCost === null || values.buyCost === undefined
      ? null
      : Math.max(0, toNumber(values.buyCost, 0));
    var billablePounds = getBillablePounds(values.weightLbs, values.weightOz);
    var customShipping = Math.max(0, toNumber(values.customShipping, DEFAULTS.customShipping));
    var shippingCost = values.shippingMode === "custom"
      ? customShipping
      : getMediaMailCost(billablePounds);
    var percentageFee = sellPrice * (feePercent / 100);
    var totalCosts = percentageFee + fixedFee + materialsFee + shippingCost;
    var netBeforeBookCost = sellPrice - totalCosts;
    var targetBuyPrice = netBeforeBookCost / (1 + targetRoi / 100);
    var profit = buyCost === null ? null : netBeforeBookCost - buyCost;
    var roi = buyCost && buyCost > 0 ? (profit / buyCost) * 100 : null;

    return {
      sellPrice: sellPrice,
      feePercent: feePercent,
      fixedFee: fixedFee,
      materialsFee: materialsFee,
      targetRoi: targetRoi,
      buyCost: buyCost,
      billablePounds: billablePounds,
      shippingCost: shippingCost,
      percentageFee: percentageFee,
      totalCosts: totalCosts,
      netBeforeBookCost: netBeforeBookCost,
      targetBuyPrice: targetBuyPrice,
      breakEvenBuyPrice: netBeforeBookCost,
      profit: profit,
      roi: roi
    };
  }

  function formValues(form) {
    var data = new FormData(form);
    return {
      productId: data.get("productId"),
      conditionType: data.get("conditionType"),
      sellPrice: data.get("sellPrice"),
      feePercent: data.get("feePercent"),
      fixedFee: data.get("fixedFee"),
      materialsFee: data.get("materialsFee"),
      weightLbs: data.get("weightLbs"),
      weightOz: data.get("weightOz"),
      shippingMode: data.get("shippingMode"),
      customShipping: data.get("customShipping"),
      buyCost: data.get("buyCost"),
      targetRoi: data.get("targetRoi")
    };
  }

  function setTone(element, value) {
    element.classList.toggle("is-negative", Number.isFinite(value) && value < 0);
    element.classList.toggle("is-warn", Number.isFinite(value) && value === 0);
  }

  function buildSummary(result) {
    var profitText = result.profit === null ? "N/A" : money(result.profit);

    return [
      "Sell price: " + money(result.sellPrice),
      "Percentage fee: " + money(result.percentageFee),
      "Fixed fee: " + money(result.fixedFee),
      "Shipping materials: " + money(result.materialsFee),
      "Shipping: " + money(result.shippingCost) + " (" + result.billablePounds + " lb billable)",
      "Total fees and costs: " + money(result.totalCosts),
      "Net before book cost: " + money(result.netBeforeBookCost),
      "Max buy at target ROI: " + money(result.targetBuyPrice),
      "Profit after buy cost: " + profitText,
      "ROI after buy cost: " + percent(result.roi)
    ].join("\n");
  }

  function init() {
    initThemeControls();

    var form = document.getElementById("calculator-form");
    var customShipping = document.querySelector("[data-custom-shipping]");
    var output = {
      netValue: document.getElementById("net-value"),
      targetBuy: document.getElementById("target-buy"),
      totalCosts: document.getElementById("total-costs"),
      profit: document.getElementById("profit-value"),
      roi: document.getElementById("roi-value"),
      percentageFee: document.getElementById("percentage-fee"),
      fixedFee: document.getElementById("fixed-fee-output"),
      materialsFee: document.getElementById("materials-fee-output"),
      shippingCost: document.getElementById("shipping-cost"),
      billableWeight: document.getElementById("billable-weight"),
      mediaMailEffective: document.querySelector("[data-media-mail-effective]"),
      credentialStatus: document.getElementById("credential-status"),
      credentialOpenButton: document.getElementById("open-credentials"),
      credentialDialog: document.getElementById("credential-dialog"),
      credentialMessage: document.getElementById("credential-message"),
      credentialSaveButton: document.getElementById("save-credentials"),
      credentialClearButton: document.getElementById("clear-credentials"),
      credentialCloseButton: document.getElementById("close-credentials"),
      credentialLwaClientId: document.getElementById("credential-lwa-client-id"),
      credentialLwaClientSecret: document.getElementById("credential-lwa-client-secret"),
      credentialLwaRefreshToken: document.getElementById("credential-lwa-refresh-token"),
      credentialSellerId: document.getElementById("credential-seller-id"),
      credentialMarketplaceId: document.getElementById("credential-marketplace-id"),
      eligibilityValue: document.getElementById("eligibility-value"),
      eligibilityButton: document.getElementById("check-eligibility"),
      copyButton: document.getElementById("copy-summary")
    };
    var lastResult = calculate(DEFAULTS);

    initCredentialControls(output);

    function render() {
      var values = formValues(form);
      var result = calculate(values);
      lastResult = result;

      customShipping.hidden = values.shippingMode !== "custom";

      output.netValue.value = money(result.netBeforeBookCost);
      output.netValue.textContent = money(result.netBeforeBookCost);
      output.targetBuy.textContent = money(result.targetBuyPrice);
      output.totalCosts.textContent = money(result.totalCosts);
      output.profit.textContent = values.buyCost === "" ? "N/A" : money(result.profit);
      output.roi.textContent = percent(result.roi);
      output.percentageFee.textContent = money(result.percentageFee);
      output.fixedFee.textContent = money(result.fixedFee);
      output.materialsFee.textContent = money(result.materialsFee);
      output.shippingCost.textContent = money(result.shippingCost);
      output.billableWeight.textContent = result.billablePounds + " lb";

      if (output.mediaMailEffective) {
        output.mediaMailEffective.textContent = formatEffectiveDate(MEDIA_MAIL_RATE_DATA.effectiveDate);
      }

      setTone(output.netValue, result.netBeforeBookCost);
      setTone(output.targetBuy, result.targetBuyPrice);
      setTone(output.profit, values.buyCost === "" ? NaN : result.profit);
    }

    form.addEventListener("input", render);
    form.addEventListener("change", render);
    form.addEventListener("reset", function () {
      window.setTimeout(render, 0);
    });

    output.eligibilityButton.addEventListener("click", async function () {
      var values = formValues(form);
      var productId = (values.productId || "").trim();

      setStatusTone(output.eligibilityValue, null);

      if (!productId) {
        output.eligibilityValue.textContent = "Enter ISBN/ASIN";
        setStatusTone(output.eligibilityValue, "warn");
        return;
      }

      var status = await refreshCredentialStatus(output);

      if (!status || !status.configured) {
        output.eligibilityValue.textContent = getDesktopCredentials() ? "Setup needed" : "Desktop required";
        setStatusTone(output.eligibilityValue, "warn");
        return;
      }

      output.eligibilityValue.textContent = "API pending";
    });

    output.copyButton.addEventListener("click", function () {
      var summary = buildSummary(lastResult);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summary).then(function () {
          output.copyButton.textContent = "Copied";
          window.setTimeout(function () {
            output.copyButton.textContent = "Copy summary";
          }, 1200);
        });
      }
    });

    render();
  }

  if (typeof window !== "undefined") {
    var api = {
      RATE_DATA: MEDIA_MAIL_RATE_DATA,
      MEDIA_MAIL_RATES: MEDIA_MAIL_RATES,
      calculate: calculate,
      getBillablePounds: getBillablePounds,
      getMediaMailCost: getMediaMailCost
    };

    window.BookResaleCalculator = api;
    window.BookMarginCalculator = api;
    window.addEventListener("DOMContentLoaded", init);
  }

  if (typeof module !== "undefined") {
    module.exports = {
      RATE_DATA: MEDIA_MAIL_RATE_DATA,
      MEDIA_MAIL_RATES: MEDIA_MAIL_RATES,
      calculate: calculate,
      getBillablePounds: getBillablePounds,
      getMediaMailCost: getMediaMailCost
    };
  }
})();
