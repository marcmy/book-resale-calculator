const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const calculator = require("../script.js");
const rateServiceModule = require("../electron/usps-rates.cjs");
const updater = require("./update-usps-media-mail-rates.js");

async function checkRateService(rateData) {
  const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "book-resale-rates-"));
  const remoteRateData = {
    ...rateData,
    effectiveDate: "July 13, 2026",
    rates: rateData.rates.map((rate) => Number((rate + 0.01).toFixed(2)))
  };
  let fetchCalls = 0;
  let now = Date.UTC(2026, 6, 22, 12);
  const app = {
    getAppPath: () => path.join(__dirname, ".."),
    getPath: (name) => {
      assert.strictEqual(name, "userData");
      return testDirectory;
    }
  };
  const logger = {
    warn: () => {}
  };

  try {
    const service = rateServiceModule.createRateService({
      app,
      fetch: async () => {
        fetchCalls += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(remoteRateData)
        };
      },
      logger,
      now: () => now
    });

    assert.deepStrictEqual(service.getCurrent(), rateData);

    const refresh = await service.refreshIfDue({ force: true });
    assert.strictEqual(refresh.checked, true);
    assert.strictEqual(refresh.updated, true);
    assert.strictEqual(fetchCalls, 1);
    assert.deepStrictEqual(service.getCurrent(), remoteRateData);
    assert.strictEqual(fs.existsSync(service.getPaths().cachePath), true);

    now += 60 * 60 * 1000;
    const cachedService = rateServiceModule.createRateService({
      app,
      fetch: async () => {
        fetchCalls += 1;
        throw new Error("The cache should suppress this request.");
      },
      logger,
      now: () => now
    });
    const cachedRefresh = await cachedService.refreshIfDue();

    assert.deepStrictEqual(cachedService.getCurrent(), remoteRateData);
    assert.strictEqual(cachedRefresh.checked, false);
    assert.strictEqual(cachedRefresh.updated, false);
    assert.strictEqual(fetchCalls, 1);
  } finally {
    fs.rmSync(testDirectory, { recursive: true, force: true });
  }
}

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
  const currentTwoPoundRate = calculator.MEDIA_MAIL_RATES[1];
  const expectedTotalCosts =
    input.sellPrice * (input.feePercent / 100) +
    input.fixedFee +
    input.materialsFee +
    currentTwoPoundRate;

  assert.strictEqual(sample.billablePounds, 2);
  assert.strictEqual(sample.shippingCost, currentTwoPoundRate);
  assert.strictEqual(
    Number(sample.totalCosts.toFixed(2)),
    Number(expectedTotalCosts.toFixed(2))
  );
  assert.strictEqual(
    Number(sample.netBeforeBookCost.toFixed(2)),
    Number((input.sellPrice - expectedTotalCosts).toFixed(2))
  );

  const fixedShipping = calculator.calculate({
    ...input,
    shippingMode: "custom",
    customShipping: 5.22
  });
  assert.strictEqual(Number(fixedShipping.totalCosts.toFixed(2)), 22.52);
  assert.strictEqual(Number(fixedShipping.netBeforeBookCost.toFixed(2)), 77.48);

  const ratesJsonPath = path.join(__dirname, "..", "rates.json");
  const ratesJavaScriptPath = path.join(__dirname, "..", "rates.js");
  const ratesJsonText = fs.readFileSync(ratesJsonPath, "utf8");
  const rateData = JSON.parse(ratesJsonText);

  assert.deepStrictEqual(rateData, calculator.RATE_DATA);
  assert.strictEqual(updater.renderRatesJson(rateData), ratesJsonText);
  assert.strictEqual(
    updater.renderRatesFile(rateData),
    fs.readFileSync(ratesJavaScriptPath, "utf8")
  );
  assert.deepStrictEqual(
    rateServiceModule.validateRateData(rateData),
    rateData
  );
  assert.throws(
    () => rateServiceModule.validateRateData({
      ...rateData,
      rates: rateData.rates.slice(0, -1)
    }),
    /must contain 70 rates/
  );

  const correctedRateData = {
    ...rateData,
    rates: rateData.rates.map((rate, index) => {
      return index === rateData.rates.length - 1 ? rate + 0.01 : rate;
    })
  };
  assert.strictEqual(calculator.setRateData(correctedRateData), true);
  assert.deepStrictEqual(calculator.RATE_DATA, correctedRateData);
  assert.strictEqual(calculator.setRateData(rateData), true);
  assert.strictEqual(calculator.setRateData(rateData), false);

  await checkRateService(rateData);

  const roundedWeight = calculator.calculate({
    ...input,
    billableWeight: 2.1
  });
  assert.strictEqual(roundedWeight.billablePounds, 3);

  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /name="billableWeight"/);
  assert.doesNotMatch(html, /name="weightOz"/);
  assert.doesNotMatch(html, /id="billable-weight"/);

  assert.strictEqual(
    updater.toText("<script>hidden</script><style>hidden</style><p>A &amp; B&nbsp; C &bull; D &#8226; E &#x2022;</p>"),
    "A & B C D E"
  );
  assert.strictEqual(
    updater.toText("<p>&amp;bull;</p>"),
    "&bull;"
  );

  console.log("calculation and USPS rate update checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
