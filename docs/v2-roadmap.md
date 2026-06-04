# v2 Roadmap

The v1 release stays as a static browser calculator.

v2 is the path for:

- A Windows desktop app build.
- A compact local calculator UI that avoids unnecessary form width.
- Auto, light, and dark theme controls.
- USPS Media Mail rate updates.

## Deferred Amazon integration

Amazon seller eligibility checks are intentionally out of scope for this version. The shipped app should not ask for seller credentials, create authorization flows, store marketplace tokens, or call Amazon SP-API.

If eligibility checks come back later, they should be designed as a separate opt-in feature after the account-risk and authorization questions are settled.
