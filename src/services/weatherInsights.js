import {
  getCityForecast,
  normalizeForecastDay,
  normalizeForecastRows,
} from './weatherDataAdapters.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values) {
  const nums = values.map(value => asNumber(value)).filter(value => value != null);
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function firstNumber(day, keys, fallback = null) {
  for (const key of keys) {
    const value = asNumber(day?.[key], null);
    if (value != null) return value;
  }
  return fallback;
}

function maxFromDays(days, keys, fallback = null) {
  const values = asArray(days)
    .map(day => firstNumber(day, keys, null))
    .filter(value => value != null);

  if (values.length === 0) return fallback;
  return Math.max(...values);
}

function sumFromDays(days, keys, fallback = 0) {
  const values = asArray(days)
    .map(day => firstNumber(day, keys, null))
    .filter(value => value != null);

  if (values.length === 0) return fallback;
  return Number(values.reduce((sum, value) => sum + value, 0).toFixed(1));
}

function getDailyForecast(cityData) {
  return getCityForecast(cityData);
}

function getTodayTomorrow(cityData) {
  const forecast = getDailyForecast(cityData);

  return {
    today: forecast[0] || null,
    tomorrow: forecast[1] || null,
    days: forecast.slice(0, 2),
  };
}

export function formatRainSignal(probability, precipMm) {
  const prob = asNumber(probability, 0);
  const mm = asNumber(precipMm, 0);

  return `${Math.round(prob)}% · ${mm.toFixed(1)}mm`;
}

export function getWeatherRiskTone(risk) {
  const level = String(risk?.level || risk?.risk || '').toLowerCase();
  if (level === 'high') return 'bad';
  if (level === 'medium') return 'warn';
  if (level === 'low') return 'good';
  return 'unknown';
}

export function buildTomorrowChip(cityData) {
  const { tomorrow } = getTodayTomorrow(cityData);
  if (!tomorrow) return null;

  const day = normalizeForecastDay(tomorrow, 1);
  let risk = 'low';

  if (day.rainProb >= 70 || day.rainMm >= 12 || (day.high != null && day.high >= 38)) risk = 'high';
  else if (day.rainProb >= 35 || day.rainMm >= 2 || (day.high != null && day.high >= 33) || (day.uvIndex != null && day.uvIndex >= 7)) risk = 'medium';

  return {
    label: 'Tomorrow',
    temp: day.high,
    tempMax: day.high,
    tempMin: day.low,
    high: day.high,
    low: day.low,
    rain: day.rainProb,
    precipMm: day.rainMm,
    rainMm: day.rainMm,
    uv: day.uvIndex,
    uvIndex: day.uvIndex,
    risk,
    condition: day.condition,
    icon: day.icon,
    rainText: formatRainSignal(day.rainProb, day.rainMm),
    detail: `${day.high ?? '--'}°/${day.low ?? '--'}° · rain ${formatRainSignal(day.rainProb, day.rainMm)}`,
  };
}

export function buildOutdoorScore(day) {
  if (!day) return 0;

  const normalized = normalizeForecastDay(day);
  let score = 100;

  score -= Math.min(40, normalized.rainProb * 0.45);
  score -= Math.min(25, normalized.rainMm * 3);

  if (normalized.high > 38) score -= 20;
  else if (normalized.high > 35) score -= 10;

  if (normalized.uvIndex >= 10) score -= 15;
  else if (normalized.uvIndex >= 7) score -= 8;

  if (normalized.windKph >= 40) score -= 10;
  else if (normalized.windKph >= 25) score -= 5;

  if (normalized.humidityDay >= 85 && normalized.high >= 32) score -= 8;

  return Math.max(0, Math.round(score));
}

/**
 * Backward compatible:
 * - summarizeCityWeekly(cityData)
 * - summarizeCityWeekly(city, cityData)
 */
export function summarizeCityWeekly(cityOrData, maybeCityData = null) {
  const city = maybeCityData ? cityOrData : cityOrData?.city || '';
  const cityData = maybeCityData || cityOrData || {};
  const forecast = getDailyForecast(cityData);

  if (forecast.length === 0) {
    return {
      city,
      label: cityData?.name || city,
      hasWeekly: false,
      bestDay: null,
      bestOutdoorDay: null,
      rainiestDay: null,
      hottestDay: null,
      highestUvDay: null,
      weekly: [],
    };
  }

  const weekly = normalizeForecastRows(forecast).map(day => ({
    ...day,
    outdoorScore: buildOutdoorScore(day),
  }));

  const bestDay = [...weekly].sort((a, b) => b.outdoorScore - a.outdoorScore)[0] || null;
  const rainiestDay = [...weekly].sort((a, b) => (
    (b.rainMm * 10 + b.rainProb) - (a.rainMm * 10 + a.rainProb)
  ))[0] || null;
  const hottestDay = [...weekly].sort((a, b) => (b.high ?? -999) - (a.high ?? -999))[0] || null;
  const highestUvDay = [...weekly].sort((a, b) => (b.uvIndex ?? -999) - (a.uvIndex ?? -999))[0] || null;

  return {
    city,
    label: cityData?.name || city,
    hasWeekly: true,
    bestDay,
    bestOutdoorDay: bestDay,
    rainiestDay,
    hottestDay,
    highestUvDay,
    weekly,
  };
}

export function summarizeAllCitiesWeekly(weatherData = {}, cities = []) {
  return asArray(cities).map(city => summarizeCityWeekly(city, weatherData?.[city]));
}

export function buildNextRiskSummary(cityData) {
  const { today, tomorrow, days } = getTodayTomorrow(cityData);
  if (!today && !tomorrow) return null;

  const normalizedDays = normalizeForecastRows(days);

  const rain = maxFromDays(normalizedDays, ['rainProb', 'precipProb', 'rainfallProbability'], 0);
  const precipMm = sumFromDays(normalizedDays, ['rainMm', 'precipSum', 'rainfallMm'], 0);
  const heat = maxFromDays(normalizedDays, ['high', 'tempMax'], null);
  const uv = maxFromDays(normalizedDays, ['uvIndex', 'uvMax'], null);
  const wind = maxFromDays(normalizedDays, ['windKph', 'windMax'], null);
  const humidity = maxFromDays(normalizedDays, ['humidityDay', 'humidityMean'], null);

  let level = 'low';
  if (rain >= 70 || precipMm >= 10 || heat >= 38) level = 'high';
  else if (rain >= 35 || precipMm >= 1.5 || heat >= 33 || uv >= 7 || wind >= 25) level = 'medium';

  return {
    type: precipMm > 0 || rain > 20 ? 'rain' : 'stable',
    level,
    risk: level,
    label: level === 'high' ? 'Weather risk' : level === 'medium' ? 'Watch weather' : 'Stable',
    detail: precipMm > 0 || rain > 20
      ? `Rain ${formatRainSignal(rain, precipMm)}`
      : 'No significant rain expected.',
    icon: level === 'high' ? '⚠️' : precipMm > 0 || rain > 20 ? '🌧' : '✅',
    rain,
    precipMm,
    rainMm: precipMm,
    rainText: formatRainSignal(rain, precipMm),
    heat,
    uv,
    wind,
    humidity,
    stable: rain < 20 && precipMm < 0.5,
  };
}

export function buildDailyConsensus(modelData, dayIdx) {
  const daily = [
    modelData?.ecmwf?.daily,
    modelData?.gfs?.daily,
    modelData?.icon?.daily,
  ].filter(Boolean);

  function values(field) {
    return daily
      .map(model => model?.[field]?.[dayIdx])
      .filter(value => value != null && Number.isFinite(Number(value)))
      .map(Number);
  }

  function avg(field, decimals = 0) {
    const value = average(values(field));
    if (value == null) return null;
    return decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
  }

  function modeCode() {
    const codes = values('weather_code');
    if (codes.length === 0) return 0;
    const counts = new Map();
    codes.forEach(code => counts.set(code, (counts.get(code) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  return {
    code: modeCode(),
    high: avg('temperature_2m_max'),
    low: avg('temperature_2m_min'),
    rainProb: avg('precipitation_probability_max'),
    rainMm: avg('precipitation_sum', 1),
    realFeelDay: avg('apparent_temperature_max'),
    humidityDay: avg('relative_humidity_2m_mean'),
    uvIndex: avg('uv_index_max'),
    windKph: avg('wind_speed_10m_max'),
  };
}

export const __weatherInsightTestUtils = {
  firstNumber,
  formatRainSignal,
};
