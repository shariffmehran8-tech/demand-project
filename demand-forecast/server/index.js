const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { buildForecast } = require("./forecast");

const app = express();
const PORT = process.env.PORT || 4010;

app.use(cors());
app.use(express.json());

function loadData() {
  const raw = fs.readFileSync(path.join(__dirname, "data.json"), "utf-8");
  return JSON.parse(raw);
}

// GET /api/skus — list all SKUs with basic info
app.get("/api/skus", (req, res) => {
  const data = loadData();
  const skus = data.skus.map((s) => ({
    sku: s.sku,
    name: s.name,
    leadTimeWeeks: s.leadTimeWeeks,
    currentStock: s.currentStock,
    weeksOfHistory: s.history.length
  }));
  res.json(skus);
});

// GET /api/forecast/:sku — full forecast for one SKU
// Optional query params: serviceLevel (90|95|98|99), periodsAhead (int)
app.get("/api/forecast/:sku", (req, res) => {
  const data = loadData();
  const item = data.skus.find((s) => s.sku === req.params.sku);

  if (!item) {
    return res.status(404).json({ error: `SKU '${req.params.sku}' not found` });
  }

  const serviceLevel = parseInt(req.query.serviceLevel) || 95;
  const periodsAhead = parseInt(req.query.periodsAhead) || 8;
  const units = item.history.map((h) => h.units);

  const result = buildForecast(units, {
    leadTimeWeeks: item.leadTimeWeeks,
    serviceLevel,
    periodsAhead
  });

  const lastWeek = new Date(item.history[item.history.length - 1].week);
  const forecastWeeks = result.forecast.map((units, i) => {
    const d = new Date(lastWeek);
    d.setDate(d.getDate() + 7 * (i + 1));
    return { week: d.toISOString().slice(0, 10), units };
  });

  res.json({
    sku: item.sku,
    name: item.name,
    leadTimeWeeks: item.leadTimeWeeks,
    currentStock: item.currentStock,
    history: item.history,
    forecast: forecastWeeks,
    stats: {
      movingAverage: result.movingAverage,
      trendPerWeek: result.trendPerWeek,
      stdDev: result.stdDev,
      safetyStock: result.safetyStock,
      reorderPoint: result.reorderPoint,
      serviceLevel: result.serviceLevel
    },
    stockStatus:
      item.currentStock <= result.reorderPoint
        ? "reorder_now"
        : item.currentStock <= result.reorderPoint * 1.3
        ? "watch"
        : "healthy"
  });
});

app.listen(PORT, () => {
  console.log(`Demand Forecast API running on http://localhost:${PORT}`);
});
