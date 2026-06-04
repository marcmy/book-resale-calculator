const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const calculator = require("../script.js");

async function main() {
  const input = {
    sellPrice: 100,
    feePercent: 15,
    fixedFee: 1.8,
    materialsFee: 0.5,
    billableWeight: 2,
    shippingMode: "media-mail",
    customShipping: 0,
    buyCost: "",
    targetRoi: 100
  };
  const sample = calculator.calculate(input);

  assert.strictEqual(sample.billablePounds, 2);
  assert.strictEqual(Number(sample.totalCosts.toFixed(2)), 22.52);
  assert.strictEqual(Number(sample.netBeforeBookCost.toFixed(2)), 77.48);

  const roundedWeight = calculator.calculate({
    ...input,
    billableWeight: 2.1
  });

  assert.strictEqual(roundedWeight.billablePounds, 3);

  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /name="billableWeight"/);
  assert.doesNotMatch(html, /name="weightOz"/);
  assert.doesNotMatch(html, /id="billable-weight"/);

  console.log("calculation checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
