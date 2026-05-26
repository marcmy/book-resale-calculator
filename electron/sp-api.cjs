const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const USER_AGENT = "BookResaleCalculator/2.0 (Language=JavaScript)";

const CONDITION_LABELS = {
  new_new: "New",
  used_like_new: "Used - Like New",
  used_very_good: "Used - Very Good",
  used_good: "Used - Good",
  used_acceptable: "Used - Acceptable",
  collectible_like_new: "Collectible - Like New",
  collectible_very_good: "Collectible - Very Good",
  collectible_good: "Collectible - Good",
  collectible_acceptable: "Collectible - Acceptable"
};

const MARKETPLACE_ENDPOINTS = {
  A2EUQ1WTGCTBG2: "https://sellingpartnerapi-na.amazon.com",
  ATVPDKIKX0DER: "https://sellingpartnerapi-na.amazon.com",
  A1AM78C64UM0Y8: "https://sellingpartnerapi-na.amazon.com",
  A2Q3Y263D00KWC: "https://sellingpartnerapi-na.amazon.com",
  A1RKKUPIHCS9HS: "https://sellingpartnerapi-eu.amazon.com",
  A1F83G8C2ARO7P: "https://sellingpartnerapi-eu.amazon.com",
  A13V1IB3VIYZZH: "https://sellingpartnerapi-eu.amazon.com",
  A1PA6795UKMFR9: "https://sellingpartnerapi-eu.amazon.com",
  APJ6JRA9NG5V4: "https://sellingpartnerapi-eu.amazon.com",
  A1805IZSGTT6HS: "https://sellingpartnerapi-eu.amazon.com",
  A2NODRKZP88ZB9: "https://sellingpartnerapi-eu.amazon.com",
  A1C3SOZRARQ6R3: "https://sellingpartnerapi-eu.amazon.com",
  ARBP9OOSHTCHU: "https://sellingpartnerapi-eu.amazon.com",
  A33AVAJ2PDY3EV: "https://sellingpartnerapi-eu.amazon.com",
  A17E79C6D8DWNP: "https://sellingpartnerapi-eu.amazon.com",
  A2VIGQ35RCS4UG: "https://sellingpartnerapi-eu.amazon.com",
  A1VC38T7YXB528: "https://sellingpartnerapi-fe.amazon.com",
  A39IBJ37TRP1C6: "https://sellingpartnerapi-fe.amazon.com",
  A19VAU5U5O7RUS: "https://sellingpartnerapi-fe.amazon.com"
};

class SpApiError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "SpApiError";
    this.details = details || {};
  }
}

function normalizeAsin(value) {
  const normalized = String(value || "").trim().toUpperCase();

  return /^[A-Z0-9]{10}$/.test(normalized) ? normalized : null;
}

function normalizeCondition(value) {
  return Object.prototype.hasOwnProperty.call(CONDITION_LABELS, value) ? value : "used_good";
}

function getEndpointForMarketplace(marketplaceId) {
  return MARKETPLACE_ENDPOINTS[String(marketplaceId || "").trim()] || MARKETPLACE_ENDPOINTS.ATVPDKIKX0DER;
}

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text };
  }
}

function getErrorMessage(body, fallback) {
  if (!body) {
    return fallback;
  }

  if (body.error_description) {
    return body.error_description;
  }

  if (body.message) {
    return body.message;
  }

  if (Array.isArray(body.errors) && body.errors[0]) {
    return body.errors[0].message || body.errors[0].code || fallback;
  }

  return fallback;
}

async function getAccessToken(credentials, fetchImpl) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: credentials.lwaRefreshToken,
    client_id: credentials.lwaClientId,
    client_secret: credentials.lwaClientSecret
  });
  const response = await fetchImpl(LWA_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": USER_AGENT
    },
    body
  });
  const responseBody = await readResponseBody(response);

  if (!response.ok || !responseBody || !responseBody.access_token) {
    throw new SpApiError(getErrorMessage(responseBody, "Could not get an Amazon access token."), {
      phase: "token",
      status: response.status
    });
  }

  return responseBody.access_token;
}

function buildRestrictionsUrl(credentials, request) {
  const endpoint = getEndpointForMarketplace(credentials.marketplaceId);
  const url = new URL("/listings/2021-08-01/restrictions", endpoint);

  url.searchParams.set("asin", request.asin);
  url.searchParams.set("sellerId", credentials.sellerId);
  url.searchParams.set("marketplaceIds", credentials.marketplaceId);
  url.searchParams.set("conditionType", request.conditionType);
  url.searchParams.set("reasonLocale", "en_US");

  return url;
}

function flattenReasons(restrictions) {
  return restrictions.flatMap((restriction) => {
    const reasons = Array.isArray(restriction.reasons) ? restriction.reasons : [];

    if (reasons.length === 0) {
      return [{
        reasonCode: "UNKNOWN_RESTRICTION",
        message: "Amazon returned a restriction without a reason."
      }];
    }

    return reasons.map((reason) => ({
      reasonCode: reason.reasonCode || "UNKNOWN_RESTRICTION",
      message: reason.message || "Amazon returned a listing restriction.",
      links: Array.isArray(reason.links)
        ? reason.links.map((link) => ({
          title: link.title || "",
          resource: link.resource || "",
          type: link.type || "",
          verb: link.verb || ""
        }))
        : []
    }));
  });
}

function interpretRestrictions(body, context) {
  const restrictions = Array.isArray(body && body.restrictions) ? body.restrictions : [];
  const base = {
    asin: context.asin,
    conditionType: context.conditionType,
    conditionLabel: CONDITION_LABELS[context.conditionType],
    marketplaceId: context.marketplaceId,
    checkedAt: new Date().toISOString()
  };

  if (restrictions.length === 0) {
    return {
      ...base,
      status: "eligible",
      severity: "good",
      label: "Eligible",
      message: "Amazon returned no listing restrictions for this ASIN and condition.",
      reasons: []
    };
  }

  const reasons = flattenReasons(restrictions);
  const codes = new Set(reasons.map((reason) => reason.reasonCode));
  let status = "restricted";
  let severity = "negative";
  let label = "Restricted";

  if (codes.has("APPROVAL_REQUIRED")) {
    status = "approval_required";
    severity = "warn";
    label = "Approval required";
  } else if (codes.has("ASIN_NOT_FOUND")) {
    status = "asin_not_found";
    severity = "warn";
    label = "ASIN not found";
  } else if (codes.has("NOT_ELIGIBLE")) {
    status = "not_eligible";
    severity = "negative";
    label = "Not eligible";
  }

  return {
    ...base,
    status,
    severity,
    label,
    message: reasons[0] ? reasons[0].message : "Amazon returned listing restrictions.",
    reasons
  };
}

async function checkListingsEligibility(credentials, request, options) {
  const fetchImpl = (options && options.fetch) || fetch;
  const asin = normalizeAsin(request.productId);

  if (!asin) {
    return {
      status: "asin_required",
      severity: "warn",
      label: "ASIN needed",
      message: "Eligibility checks currently require a 10-character ASIN. ISBN lookup is next."
    };
  }

  const conditionType = normalizeCondition(request.conditionType);
  const accessToken = await getAccessToken(credentials, fetchImpl);
  const url = buildRestrictionsUrl(credentials, { asin, conditionType });
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT,
      "x-amz-access-token": accessToken
    }
  });
  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new SpApiError(getErrorMessage(responseBody, "Amazon could not verify eligibility."), {
      phase: "listingsRestrictions",
      status: response.status
    });
  }

  return interpretRestrictions(responseBody, {
    asin,
    conditionType,
    marketplaceId: credentials.marketplaceId
  });
}

function toSafeErrorResult(error) {
  if (error instanceof SpApiError) {
    return {
      status: "api_error",
      severity: "warn",
      label: "Could not verify",
      message: error.message,
      phase: error.details.phase || "unknown",
      httpStatus: error.details.status || null,
      checkedAt: new Date().toISOString()
    };
  }

  return {
    status: "api_error",
    severity: "warn",
    label: "Could not verify",
    message: "The Amazon eligibility check failed before Amazon returned a usable response.",
    phase: "unknown",
    httpStatus: null,
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  CONDITION_LABELS,
  MARKETPLACE_ENDPOINTS,
  buildRestrictionsUrl,
  checkListingsEligibility,
  interpretRestrictions,
  normalizeAsin,
  normalizeCondition,
  toSafeErrorResult
};
