const fs = require("node:fs");
const path = require("node:path");

const OFFICIAL_NOTICE_URL = "https://pe.usps.com/text/dmm300/notice123.htm";
const REMOTE_RATES_URL =
  "https://raw.githubusercontent.com/marcmy/book-resale-calculator/main/rates.json";
const EXPECTED_RATE_COUNT = 70;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const CACHE_SCHEMA_VERSION = 1;
const MONTHS = Object.freeze({
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11
});

function effectiveDateTimestamp(value) {
  if (typeof value !== "string") {
    throw new Error("USPS rate effective date must be a string.");
  }

  const match = value.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December) ([1-9]|[12]\d|3[01]), (\d{4})$/
  );

  if (!match) {
    throw new Error(`Invalid USPS rate effective date: ${value}.`);
  }

  const month = MONTHS[match[1]];
  const day = Number(match[2]);
  const year = Number(match[3]);
  const timestamp = Date.UTC(year, month, day);
  const parsedDate = new Date(timestamp);

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid USPS rate effective date: ${value}.`);
  }

  return timestamp;
}

function validateRateData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("USPS rate data must be an object.");
  }
  if (value.sourceUrl !== OFFICIAL_NOTICE_URL) {
    throw new Error("USPS rate data has an unexpected source URL.");
  }

  effectiveDateTimestamp(value.effectiveDate);

  if (!Array.isArray(value.rates) || value.rates.length !== EXPECTED_RATE_COUNT) {
    throw new Error(`USPS rate data must contain ${EXPECTED_RATE_COUNT} rates.`);
  }

  const rates = value.rates.map((rate, index) => {
    if (!Number.isFinite(rate) || rate <= 0 || rate >= 1000) {
      throw new Error(`Invalid USPS rate for ${index + 1} lb.`);
    }

    const cents = rate * 100;
    if (Math.abs(cents - Math.round(cents)) > 1e-7) {
      throw new Error(`USPS rate for ${index + 1} lb has more than two decimal places.`);
    }
    if (index > 0 && rate < value.rates[index - 1]) {
      throw new Error("USPS rates must not decrease as weight increases.");
    }

    return rate;
  });

  return Object.freeze({
    sourceUrl: value.sourceUrl,
    effectiveDate: value.effectiveDate,
    rates: Object.freeze(rates)
  });
}

function cloneRateData(value) {
  return {
    sourceUrl: value.sourceUrl,
    effectiveDate: value.effectiveDate,
    rates: Array.from(value.rates)
  };
}

function sameRateData(left, right) {
  return Boolean(
    left &&
    right &&
    left.sourceUrl === right.sourceUrl &&
    left.effectiveDate === right.effectiveDate &&
    left.rates.length === right.rates.length &&
    left.rates.every((rate, index) => rate === right.rates[index])
  );
}

function selectNewestRateData(values) {
  const candidates = values.filter(Boolean);

  if (candidates.length === 0) {
    throw new Error("No valid USPS rate data is available.");
  }

  return candidates.reduce((current, candidate) => {
    return effectiveDateTimestamp(candidate.effectiveDate) >=
      effectiveDateTimestamp(current.effectiveDate)
      ? candidate
      : current;
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readBundledRateData(filePath) {
  return validateRateData(readJson(filePath));
}

function readCachedRateData(filePath, logger) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const cache = readJson(filePath);

    if (cache.schemaVersion !== CACHE_SCHEMA_VERSION) {
      throw new Error("Unsupported cache schema version.");
    }

    const checkedAt = Date.parse(cache.checkedAt);
    if (!Number.isFinite(checkedAt)) {
      throw new Error("Invalid cache check time.");
    }

    return {
      checkedAt,
      data: validateRateData(cache.data)
    };
  } catch (error) {
    logger.warn(`Ignoring invalid USPS rate cache: ${error.message}`);
    return null;
  }
}

function writeCachedRateData(filePath, checkedAt, data) {
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  const cache = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    checkedAt: new Date(checkedAt).toISOString(),
    data: cloneRateData(data)
  };

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryPath, JSON.stringify(cache, null, 2) + "\n", "utf8");

  try {
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.rmSync(filePath, { force: true });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function createRateService(options) {
  const app = options.app;
  const fetchRates = options.fetch;
  const logger = options.logger || console;
  const now = options.now || Date.now;
  const remoteUrl = options.remoteUrl || REMOTE_RATES_URL;
  const checkIntervalMs = options.checkIntervalMs || CHECK_INTERVAL_MS;
  const requestTimeoutMs = options.requestTimeoutMs || REQUEST_TIMEOUT_MS;
  const bundledPath = path.join(app.getAppPath(), "rates.json");
  const cachePath = path.join(
    app.getPath("userData"),
    "rate-data",
    "usps-media-mail.json"
  );

  if (typeof fetchRates !== "function") {
    throw new Error("A fetch implementation is required for USPS rate updates.");
  }

  const bundled = readBundledRateData(bundledPath);
  const cached = readCachedRateData(cachePath, logger);
  let current = selectNewestRateData([bundled, cached && cached.data]);
  let lastCheckedAt = cached ? cached.checkedAt : 0;
  let refreshPromise = null;

  if (lastCheckedAt > now() + checkIntervalMs) {
    lastCheckedAt = 0;
  }

  async function performRefresh(force) {
    const startedAt = now();

    if (!force && startedAt - lastCheckedAt < checkIntervalMs) {
      return {
        checked: false,
        updated: false,
        data: cloneRateData(current)
      };
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

    try {
      const response = await fetchRates(remoteUrl, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Rate feed request failed with HTTP ${response.status}.`);
      }

      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
        throw new Error("Rate feed response is unexpectedly large.");
      }

      const remote = validateRateData(JSON.parse(body));
      const next = selectNewestRateData([current, remote]);
      const updated = !sameRateData(current, next);

      current = next;
      lastCheckedAt = now();
      writeCachedRateData(cachePath, lastCheckedAt, current);

      return {
        checked: true,
        updated,
        data: cloneRateData(current)
      };
    } catch (error) {
      logger.warn(`Could not refresh USPS rates: ${error.message}`);
      return {
        checked: true,
        updated: false,
        data: cloneRateData(current),
        error
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({
    getCurrent() {
      return cloneRateData(current);
    },
    getPaths() {
      return { bundledPath, cachePath };
    },
    refreshIfDue(options = {}) {
      if (!refreshPromise) {
        refreshPromise = performRefresh(Boolean(options.force)).finally(() => {
          refreshPromise = null;
        });
      }

      return refreshPromise;
    }
  });
}

module.exports = {
  CHECK_INTERVAL_MS,
  EXPECTED_RATE_COUNT,
  OFFICIAL_NOTICE_URL,
  REMOTE_RATES_URL,
  createRateService,
  effectiveDateTimestamp,
  sameRateData,
  selectNewestRateData,
  validateRateData
};
