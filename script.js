(function () {
  "use strict";

  var MEDIA_MAIL_RATES = [
    4.47, 5.22, 5.97, 6.72, 7.47, 8.22, 8.97, 9.72, 10.47, 11.22,
    11.97, 12.72, 13.47, 14.22, 14.97, 15.72, 16.47, 17.22, 17.97, 18.72,
    19.47, 20.22, 20.97, 21.72, 22.47, 23.22, 23.97, 24.72, 25.47, 26.22,
    26.97, 27.72, 28.47, 29.22, 29.97, 30.72, 31.47, 32.22, 32.97, 33.72,
    34.47, 35.22, 35.97, 36.72, 37.47, 38.22, 38.97, 39.72, 40.47, 41.22,
    41.97, 42.72, 43.47, 44.22, 44.97, 45.72, 46.47, 47.22, 47.97, 48.72,
    49.47, 50.22, 50.97, 51.72, 52.47, 53.22, 53.97, 54.72, 55.47, 56.22
  ];

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
      copyButton: document.getElementById("copy-summary")
    };
    var lastResult = calculate(DEFAULTS);

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

      setTone(output.netValue, result.netBeforeBookCost);
      setTone(output.targetBuy, result.targetBuyPrice);
      setTone(output.profit, values.buyCost === "" ? NaN : result.profit);
    }

    form.addEventListener("input", render);
    form.addEventListener("change", render);
    form.addEventListener("reset", function () {
      window.setTimeout(render, 0);
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
    window.BookMarginCalculator = {
      MEDIA_MAIL_RATES: MEDIA_MAIL_RATES,
      calculate: calculate,
      getBillablePounds: getBillablePounds,
      getMediaMailCost: getMediaMailCost
    };

    window.addEventListener("DOMContentLoaded", init);
  }

  if (typeof module !== "undefined") {
    module.exports = {
      MEDIA_MAIL_RATES: MEDIA_MAIL_RATES,
      calculate: calculate,
      getBillablePounds: getBillablePounds,
      getMediaMailCost: getMediaMailCost
    };
  }
})();
