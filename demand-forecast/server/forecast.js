/**
 * Demand Forecasting Engine
 * ---------------------------------
 * Pure JS, no external ML libraries. Two methods are implemented:
 *
 * 1. Simple Moving Average (SMA)
 *    - Good baseline for flat, low-variance demand.
 *
 * 2. Holt's Double Exponential Smoothing
 *    - Tracks both a level and a trend component, so it adapts to
 *      products that are steadily growing or declining (most real
 *      inventory series look like this).
 *
 * Also included: standard deviation, safety stock, and reorder point,
 * using the classic formula:
 *
 *    safetyStock  = Z * stdDev(demand) * sqrt(leadTimeWeeks)
 *    reorderPoint = (avgWeeklyDemand * leadTimeWeeks) + safetyStock
 *
 * Z is the service-level factor (e.g. 1.65 ≈ 95%, 2.05 ≈ 98%).
 */

function movingAverage(series, windowSize = 3) {
  if (series.length < windowSize) {
    windowSize = series.length;
  }
  const lastN = series.slice(-windowSize);
  const avg = lastN.reduce((sum, v) => sum + v, 0) / lastN.length;
  return avg;
}

/**
 * Holt's linear trend method.
 * alpha = smoothing factor for level (0-1, higher = more reactive)
 * beta  = smoothing factor for trend (0-1, higher = more reactive)
 */
function holtDoubleExponentialSmoothing(series, alpha = 0.3, beta = 0.15, periodsAhead = 8) {
  if (series.length < 2) {
    throw new Error("Need at least 2 data points for Holt's method");
  }

  // Initialize level and trend from the first two points
  let level = series[0];
  let trend = series[1] - series[0];

  const fitted = [series[0]];

  for (let t = 1; t < series.length; t++) {
    const value = series[t];
    const prevLevel = level;
    level = alpha * value + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    fitted.push(prevLevel + trend);
  }

  // Project forward
  const forecast = [];
  for (let h = 1; h <= periodsAhead; h++) {
    forecast.push(Math.max(0, Math.round(level + h * trend)));
  }

  return { level, trend, fitted, forecast };
}

function standardDeviation(series) {
  const mean = series.reduce((sum, v) => sum + v, 0) / series.length;
  const variance = series.reduce((sum, v) => sum + (v - mean) ** 2, 0) / series.length;
  return Math.sqrt(variance);
}

// Common service-level Z-scores
const Z_SCORES = {
  90: 1.28,
  95: 1.65,
  98: 2.05,
  99: 2.33
};

function safetyStock(series, leadTimeWeeks, serviceLevel = 95) {
  const z = Z_SCORES[serviceLevel] || 1.65;
  const sd = standardDeviation(series);
  return Math.round(z * sd * Math.sqrt(leadTimeWeeks));
}

function reorderPoint(avgWeeklyDemand, leadTimeWeeks, safety) {
  return Math.round(avgWeeklyDemand * leadTimeWeeks + safety);
}

/**
 * Full forecast bundle for a single SKU's history.
 */
function buildForecast(historyUnits, { leadTimeWeeks = 2, serviceLevel = 95, periodsAhead = 8 } = {}) {
  const sma = movingAverage(historyUnits, 3);
  const holt = holtDoubleExponentialSmoothing(historyUnits, 0.3, 0.15, periodsAhead);
  const sd = standardDeviation(historyUnits);
  const safety = safetyStock(historyUnits, leadTimeWeeks, serviceLevel);

  // Use Holt's near-term forecast average as the expected weekly demand
  const nearTermAvg =
    holt.forecast.slice(0, leadTimeWeeks).reduce((s, v) => s + v, 0) / Math.max(1, leadTimeWeeks);

  const reorder = reorderPoint(nearTermAvg, leadTimeWeeks, safety);

  return {
    movingAverage: Math.round(sma),
    trendPerWeek: Math.round(holt.trend * 10) / 10,
    stdDev: Math.round(sd * 10) / 10,
    forecast: holt.forecast,
    safetyStock: safety,
    reorderPoint: reorder,
    serviceLevel
  };
}

module.exports = {
  movingAverage,
  holtDoubleExponentialSmoothing,
  standardDeviation,
  safetyStock,
  reorderPoint,
  buildForecast,
  Z_SCORES
};
