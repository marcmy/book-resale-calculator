# Book Resale Calculator

A small standalone calculator for quick book resale math.

Open `index.html` in a browser and enter:

- Sell price
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
