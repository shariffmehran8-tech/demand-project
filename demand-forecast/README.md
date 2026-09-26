# Demand Forecast — Standalone

A self-contained inventory demand forecasting tool. has its own server, its own port, its own `data.json`.

## What it does

- Takes weekly historical sales per SKU
- Forecasts the next 8 weeks using **Holt's double exponential smoothing** (tracks both level and trend, so it adapts to products that are growing or declining, not just flat)
- Computes **safety stock** and **reorder point** at a chosen service level (90/95/98/99%)
- Flags each SKU as `healthy`, `watch`, or `reorder_now` based on current stock vs. reorder point

## Run it

```bash
cd server
npm install
npm start
```

Server runs at `http://localhost:4010`.

Then open `client/index.html` directly in a browser (no build step — it's plain HTML with React/Recharts loaded from CDN).

## API

- `GET /api/skus` — list all SKUs with lead time and current stock
- `GET /api/forecast/:sku?serviceLevel=95&periodsAhead=8` — full forecast, stats, and reorder recommendation for one SKU

## Files

```
server/
  data.json     — sample historical sales (3 SKUs, 56 weeks each)
  forecast.js   — forecasting engine (moving average, Holt's smoothing, safety stock)
  index.js      — Express API
client/
  index.html    — dashboard (SKU list, forecast chart, reorder runway)
```

## Swapping in your real data

Replace `server/data.json` with your own SKUs. Each entry needs:

```json
{
  "sku": "STRING",
  "name": "STRING",
  "leadTimeWeeks": NUMBER,
  "currentStock": NUMBER,
  "history": [{ "week": "YYYY-MM-DD", "units": NUMBER }, ...]
}
```

Minimum ~8-10 weeks of history for Holt's method to be meaningful; more is better, especially across a seasonal peak (like the sample candle SKU, which shows a holiday spike then a sharp pullback — the forecast correctly picks up the downward trend).

## Notes

- No external ML libraries, no API dependencies — matches  "keep it lightweight" preference
- If you later want to wire this into the main dashboard, `forecast.js` is dependency-free and can drop straight into your `insights.js` module pattern with minimal changes
