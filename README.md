<img width="383" height="356" alt="image" src="https://github.com/user-attachments/assets/828fd8a6-11cb-471f-a599-839f8f604bbd" />

# Book Resale Calculator

A small standalone calculator for quick book resale math.

Open `index.html` in a browser and enter:

- Asking price
- Percentage fee and fixed fee
- Shipping materials fee
- Billable shipping weight in whole pounds
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

The desktop app is a local calculator. It does not ask for seller account credentials or call marketplace APIs.

Build a Windows installer with:

```bash
npm run build:win
```
