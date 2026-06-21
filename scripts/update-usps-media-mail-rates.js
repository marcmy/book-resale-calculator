const fs = require("node:fs");
const path = require("node:path");

const NOTICE_URL = "https://pe.usps.com/text/dmm300/notice123.htm";
const RATES_FILE = path.join(__dirname, "..", "rates.js");
const EXPECTED_MAX_WEIGHT = 70;

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("This updater requires Node.js 18 or newer.");
  }

  const response = await fetch(NOTICE_URL);

  if (!response.ok) {
    throw new Error(`USPS Notice 123 request failed with HTTP ${response.status}.`);
  }

  const html = await response.text();
  const effectiveDate = extractEffectiveDate(html);
  const rates = extractRetailMediaMailRates(html);
  const nextFile = renderRatesFile({
    sourceUrl: NOTICE_URL,
    effectiveDate,
    rates
  });
  const currentFile = fs.existsSync(RATES_FILE)
    ? fs.readFileSync(RATES_FILE, "utf8")
    : "";

  if (currentFile === nextFile) {
    console.log(`USPS Media Mail rates are already current: ${effectiveDate}.`);
    return;
  }

  fs.writeFileSync(RATES_FILE, nextFile);
  console.log(`Updated USPS Media Mail rates: ${effectiveDate}.`);
}

function extractEffectiveDate(html) {
  const pageText = toText(html);
  const match = pageText.match(/Notice 123\s*[^\w]+\s*Effective\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/);

  if (!match) {
    throw new Error("Could not find the Notice 123 effective date.");
  }

  return match[1];
}

function extractRetailMediaMailRates(html) {
  const sectionStart = html.indexOf('<div id="_c059"');

  if (sectionStart === -1) {
    throw new Error("Could not find the retail Media Mail section.");
  }

  const mediaMailStart = html.indexOf("<h3>Media Mail", sectionStart);
  const libraryMailStart = html.indexOf("<h3>Library Mail", mediaMailStart);

  if (mediaMailStart === -1 || libraryMailStart === -1) {
    throw new Error("Could not isolate the retail Media Mail rate table.");
  }

  const mediaMailHtml = html.slice(mediaMailStart, libraryMailStart);
  const ratesByWeight = new Map();
  const rowPattern = /<tr>\s*<td>\s*(\d+)\s*<\/td>\s*<td>\s*<span\b[^>]*>\s*\$?([0-9]+(?:\.[0-9]+)?)\s*<\/span>\s*<\/td>\s*<\/tr>/gi;
  let match;

  while ((match = rowPattern.exec(mediaMailHtml))) {
    ratesByWeight.set(Number(match[1]), Number(match[2]));
  }

  const rates = [];

  for (let weight = 1; weight <= EXPECTED_MAX_WEIGHT; weight += 1) {
    if (!ratesByWeight.has(weight)) {
      throw new Error(`Missing Media Mail rate for ${weight} lb.`);
    }

    rates.push(ratesByWeight.get(weight));
  }

  return rates;
}

function toText(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const text = (doc.body && doc.body.textContent) || "";

  return text.replace(/\s+/g, " ").trim();
}

function renderRatesFile(data) {
  const rateLines = [];

  for (let index = 0; index < data.rates.length; index += 10) {
    rateLines.push(
      "      " + data.rates.slice(index, index + 10).map((rate) => rate.toFixed(2)).join(", ")
    );
  }

  return `(function (root) {
  "use strict";

  var USPS_MEDIA_MAIL = {
    sourceUrl: ${JSON.stringify(data.sourceUrl)},
    effectiveDate: ${JSON.stringify(data.effectiveDate)},
    rates: [
${rateLines.join(",\n")}
    ]
  };

  root.USPS_MEDIA_MAIL = USPS_MEDIA_MAIL;

  if (typeof module !== "undefined") {
    module.exports = USPS_MEDIA_MAIL;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
`;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
