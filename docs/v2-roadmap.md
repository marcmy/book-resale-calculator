# v2 Roadmap

The v1 release stays as a static browser calculator.

v2 is the path for:

- A Windows desktop app build.
- Secure local storage for Amazon SP-API credentials.
- ISBN or ASIN lookup input.
- Amazon listing eligibility checks with the Listings Restrictions API.
- Clear result language such as "Amazon currently reports" instead of absolute sell/no-sell claims.

## Amazon integration notes

Douglas has a Professional Seller account, so a private SP-API application is viable. The app should keep the LWA client secret and refresh token out of browser JavaScript. For a personal desktop tool, store credentials in the operating system credential store or an encrypted local config, then call Amazon from a local backend process.

The first eligibility check should use `getListingsRestrictions` with:

- ASIN
- Seller ID
- Marketplace ID
- Condition type

The UI should show the checked marketplace, condition, timestamp, and any restriction reason Amazon returns.
