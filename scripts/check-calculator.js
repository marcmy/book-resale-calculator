const assert = require("node:assert");
const calculator = require("../script.js");

const sample = calculator.calculate({
  sellPrice: 100,
  feePercent: 15,
  fixedFee: 1.8,
  materialsFee: 0.5,
  weightLbs: 1,
  weightOz: 8,
  shippingMode: "media-mail",
  customShipping: 0,
  buyCost: "",
  targetRoi: 100
});

assert.strictEqual(sample.billablePounds, 2);
assert.strictEqual(Number(sample.totalCosts.toFixed(2)), 22.52);
assert.strictEqual(Number(sample.netBeforeBookCost.toFixed(2)), 77.48);

console.log("calculation checks passed");
