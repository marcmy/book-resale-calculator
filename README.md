# Book Resale Calculator

A small standalone calculator for quick book resale math.

Open `index.html` in a browser and enter:

- Sell price
- ISBN or ASIN and book condition
- Percentage fee and fixed fee
- Shipping materials fee
- Book weight in pounds and ounces
- Optional buy cost and target ROI
- Auto, light, and dark themes

The shipping table uses USPS Media Mail retail rates from Notice 123. Any fraction of a pound is rounded up to the next billable pound.

## Rate updates

USPS Media Mail rates live in `rates.js`. The GitHub Actions workflow in `.github/workflows/update-usps-rates.yml` checks the official USPS Notice 123 page every Monday and commits an updated `rates.js` file when rates change.

Run the updater locally with:

```bash
node scripts/update-usps-media-mail-rates.js
```

## Desktop app

The v2 branch runs in Electron:

```bash
npm install
npm start
```

In the desktop app, use **Setup** next to Amazon credentials to save SP-API values through the operating system credential store. The app keeps those secrets out of browser local storage and out of committed files.

Amazon eligibility checks currently require a 10-character ASIN. ISBN lookup is planned next.

Build a Windows installer with:

```bash
npm run build:win
```
