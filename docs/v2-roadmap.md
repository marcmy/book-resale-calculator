# v2 Roadmap

The v1 release stays as a static browser calculator.

v2 is the path for:

- A Windows desktop app build.
- Credential setup that asks for Amazon SP-API values once.
- Secure local storage for Amazon SP-API secrets.
- ASIN and ISBN eligibility checks with Catalog Items and Listings Restrictions APIs.
- Clear result language such as "Amazon currently reports" instead of absolute sell/no-sell claims.

## Amazon integration notes

Douglas has a Professional Seller account, so a private SP-API application is viable. The app should keep the LWA client secret and refresh token out of browser JavaScript. For a personal desktop tool, store credentials in the operating system credential store through the Electron main process, then call Amazon from that native process.

The setup screen should ask for:

- LWA client ID
- LWA client secret
- LWA refresh token
- Seller ID
- Marketplace ID

The setup screen should explain that these are app/API values, not the seller's Amazon login. Keep the credential fields behind an "I already have the Amazon API app values" section so the app remains usable before Amazon authorization is complete.

The client secret and refresh token must not be stored in `localStorage`, committed files, logs, or renderer-side JavaScript state.

The first eligibility check should use `getListingsRestrictions` with:

- ASIN
- Seller ID
- Marketplace ID
- Condition type

The UI should show the checked marketplace, condition, timestamp, and any restriction reason Amazon returns.
