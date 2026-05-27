const assert = require("node:assert");
const calculator = require("../script.js");
const spApi = require("../electron/sp-api.cjs");

async function main() {
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

  assert.strictEqual(spApi.normalizeAsin("b000123456"), "B000123456");
  assert.strictEqual(spApi.normalizeIsbn("978-0143127741"), "9780143127741");
  assert.strictEqual(spApi.normalizeCondition("used_good"), "used");
  assert.strictEqual(spApi.toAmazonConditionType("used"), "used_good");
  assert.strictEqual(spApi.toAmazonConditionType("collectible"), "collectible_good");

  const eligible = spApi.interpretRestrictions({ restrictions: [] }, {
    asin: "B000123456",
    conditionType: "used",
    marketplaceId: "ATVPDKIKX0DER"
  });

  assert.strictEqual(eligible.status, "eligible");
  assert.strictEqual(eligible.label, "Eligible");

  const approvalRequired = spApi.interpretRestrictions({
    restrictions: [{
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "used_good",
      reasons: [{
        reasonCode: "APPROVAL_REQUIRED",
        message: "Approval is required."
      }]
    }]
  }, {
    asin: "B000123456",
    conditionType: "used",
    marketplaceId: "ATVPDKIKX0DER"
  });

  assert.strictEqual(approvalRequired.status, "approval_required");
  assert.strictEqual(approvalRequired.label, "Approval required");

  const calls = [];
  const apiResult = await spApi.checkListingsEligibility({
    lwaClientId: "client-id",
    lwaClientSecret: "client-secret",
    lwaRefreshToken: "refresh-token",
    sellerId: "seller-id",
    marketplaceId: "ATVPDKIKX0DER",
  }, {
    productId: "B000123456",
    conditionType: "used"
  }, {
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });

      if (String(url).includes("api.amazon.com/auth/o2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      }

      return new Response(JSON.stringify({ restrictions: [] }), { status: 200 });
    }
  });

  assert.strictEqual(apiResult.status, "eligible");
  assert.strictEqual(calls.length, 2);
  assert.ok(calls[1].url.includes("asin=B000123456"));
  assert.ok(calls[1].url.includes("conditionType=used_good"));
  assert.strictEqual(calls[1].options.headers["x-amz-access-token"], "access-token");

  calls.length = 0;

  const isbnResult = await spApi.checkListingsEligibility({
    lwaClientId: "client-id",
    lwaClientSecret: "client-secret",
    lwaRefreshToken: "refresh-token",
    sellerId: "seller-id",
    marketplaceId: "ATVPDKIKX0DER",
  }, {
    productId: "9780143127741",
    conditionType: "collectible"
  }, {
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });

      if (String(url).includes("api.amazon.com/auth/o2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      }

      if (String(url).includes("/catalog/2022-04-01/items")) {
        return new Response(JSON.stringify({
          items: [{
            asin: "B00TEST123",
            summaries: [{ itemName: "Test Book" }]
          }]
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ restrictions: [] }), { status: 200 });
    }
  });

  assert.strictEqual(isbnResult.status, "eligible");
  assert.strictEqual(isbnResult.asin, "B00TEST123");
  assert.strictEqual(isbnResult.sourceIdentifier, "9780143127741");
  assert.strictEqual(isbnResult.sourceIdentifierType, "ISBN");
  assert.strictEqual(calls.length, 3);
  assert.ok(calls[1].url.includes("identifiers=9780143127741"));
  assert.ok(calls[1].url.includes("identifiersType=ISBN"));
  assert.ok(calls[2].url.includes("conditionType=collectible_good"));

  console.log("calculation checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
