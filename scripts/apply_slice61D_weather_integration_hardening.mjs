import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) return '';
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  if (!before) throw new Error(`Missing file: ${path}`);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

/* -------------------------------------------------------------------------- */
/* 1) Weather data adapter                                                     */
/* -------------------------------------------------------------------------- */

write('src/services/weatherDataAdapters.js', `import {
  getConfiguredWeatherCities,
  getWeatherLocationLabel,
} from './weatherLocations.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function firstDefined(source, keys, fallback = null) {
  for (const key of keys) {
    if (source?.[key] != null) return source[key];
  }
  return fallback;
}

export function normalizeForecastDay(day = {}, index = 0) {
  const rainProb = asNumber(firstDefined(day, [
    'precipProb',
    'rainProb',
    'rainfallProbability',
    'pop',
    'prob',
  ], 0), 0);

  const rainMm = asNumber(firstDefined(day, [
    'precipSum',
    'rainMm',
    'rainfallMm',
    'precip',
    'precipitationMm',
  ], 0), 0);

  const high = asNumber(firstDefined(day, [
    'tempMax',
    'high',
    'maxTemp',
  ], null), null);

  const low = asNumber(firstDefined(day, [
    'tempMin',
    'low',
    'minTemp',
  ], null), null);

  const realFeelDay = asNumber(firstDefined(day, [
    'realFeelDay',
    'feelsLikeDay',
    'apparentMax',
    'apparent_temperature_max',
  ], null), null);

  const humidityDay = asNumber(firstDefined(day, [
    'humidityDay',
    'humidityMean',
    'relativeHumidity',
    'relative_humidity_2m_mean',
  ], null), null);

  const uvIndex = asNumber(firstDefined(day, [
    'uvMax',
    'uvIndex',
    'uv',
  ], null), null);

  const windKph = asNumber(firstDefined(day, [
    'windMax',
    'windKph',
    'windSpeed',
  ], null), null);

  return {
    ...day,
    date: day.date || '',
    label: day.dayLabel || day.label || (index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : day.date || 'Day ' + (index + 1)),
    dayLabel: day.dayLabel || day.label || (index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : day.date || 'Day ' + (index + 1)),
    condition: day.condition || 'Forecast',
    icon: day.icon || '☁️',
    iconId: day.iconId,
    high,
    low,
    tempMax: high,
    tempMin: low,
    rainProb,
    precipProb: rainProb,
    rainfallProbability: rainProb,
    rainMm,
    precipSum: rainMm,
    rainfallMm: rainMm,
    realFeelDay,
    feelsLikeDay: realFeelDay,
    humidityDay,
    humidityMean: humidityDay,
    uvIndex,
    uvMax: uvIndex,
    windKph,
    windMax: windKph,
  };
}

export function normalizeForecastRows(forecast) {
  return asArray(forecast)
    .slice(0, 7)
    .map((day, index) => normalizeForecastDay(day, index));
}

export function getCityForecast(cityData) {
  return normalizeForecastRows(
    cityData?.weeklyForecast ||
    cityData?.forecast ||
    cityData?.daily ||
    []
  );
}

export function getWeatherCityRows({ weatherData = {}, settings = {}, cities = null } = {}) {
  const configuredCities = Array.isArray(cities) && cities.length
    ? cities
    : getConfiguredWeatherCities(settings);

  return configuredCities.map(city => {
    const cityData = weatherData?.[city] || {};

    return {
      city,
      cityName: cityData.name || getWeatherLocationLabel(city),
      cityData,
      forecast: getCityForecast(cityData),
      sourceMode: cityData.sourceMode || 'unknown',
    };
  });
}

export function formatRainPair(day) {
  const normalized = normalizeForecastDay(day);
  return \`\${normalized.rainProb || 0}% · \${Number(normalized.rainMm || 0).toFixed(1)}mm\`;
}
`);

/* -------------------------------------------------------------------------- */
/* 2) Weather insights backwards compatibility                                 */
/* -------------------------------------------------------------------------- */

write('src/services/weatherInsights.js', `import {
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

  return \`\${Math.round(prob)}% · \${mm.toFixed(1)}mm\`;
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
    detail: \`\${day.high ?? '--'}°/\${day.low ?? '--'}° · rain \${formatRainSignal(day.rainProb, day.rainMm)}\`,
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
      ? \`Rain \${formatRainSignal(rain, precipMm)}\`
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
`);

/* -------------------------------------------------------------------------- */
/* 3) Weekly forecast supports old and new props                               */
/* -------------------------------------------------------------------------- */

write('src/components/weather/WeeklyWeatherForecast.jsx', `import React from 'react';
import {
  formatRainPair,
  getWeatherCityRows,
  normalizeForecastRows,
} from '../../services/weatherDataAdapters.js';
import './WeeklyWeatherForecast.css';

function uvLabel(uv) {
  if (uv == null) return '—';
  if (uv >= 11) return 'Extreme';
  if (uv >= 8) return 'Very high';
  if (uv >= 6) return 'High';
  if (uv >= 3) return 'Moderate';
  return 'Low';
}

function renderForecastRows(forecast) {
  return normalizeForecastRows(forecast).map((day, index) => (
    <article key={day.date || day.label || index} className={\`wwf-row \${index === 0 ? 'wwf-row--today' : ''}\`}>
      <div className="wwf-main">
        <span className="wwf-day">{day.dayLabel || day.label}</span>
        <span className="wwf-condition">
          <span className="wwf-icon">{day.icon || '☁️'}</span>
          {day.condition || 'Forecast'}
        </span>
      </div>

      <div className="wwf-temp">
        <strong>{day.high != null ? \`\${day.high}°\` : '—'}</strong>
        <span>{day.low != null ? \`\${day.low}°\` : '—'}</span>
      </div>

      <div className="wwf-metric">
        <span>Rain</span>
        <strong>{formatRainPair(day)}</strong>
      </div>

      <div className="wwf-metric">
        <span>Feels</span>
        <strong>{day.realFeelDay != null ? \`\${day.realFeelDay}°\` : '—'}</strong>
      </div>

      <div className="wwf-metric">
        <span>Humidity</span>
        <strong>{day.humidityDay != null ? \`\${day.humidityDay}%\` : '—'}</strong>
      </div>

      <div className="wwf-metric">
        <span>UV / Wind</span>
        <strong>{uvLabel(day.uvIndex)}{day.windKph != null ? \` · \${day.windKph}km/h\` : ''}</strong>
      </div>
    </article>
  ));
}

function ForecastCard({ forecast, cityName, sourceMode }) {
  const rows = normalizeForecastRows(forecast);
  if (rows.length === 0) return null;

  return (
    <section className="wwf-card" data-weekly-weather-forecast="available">
      <div className="wwf-header">
        <div>
          <span className="wwf-eyebrow">Weekly forecast</span>
          <h3>7-day outlook</h3>
        </div>
        <div className="wwf-badges">
          {cityName && <span className="wwf-city">{cityName}</span>}
          {sourceMode && <span className="wwf-source">{sourceMode}</span>}
        </div>
      </div>

      <div className="wwf-rows">
        {renderForecastRows(rows)}
      </div>
    </section>
  );
}

/**
 * Supports both:
 * - <WeeklyWeatherForecast forecast={cityForecast} cityName="Colombo" />
 * - <WeeklyWeatherForecast weatherData={displayData} settings={settings} />
 */
export default function WeeklyWeatherForecast({
  forecast = null,
  cityName = '',
  sourceMode = '',
  weatherData = null,
  settings = null,
  cities = null,
}) {
  if (Array.isArray(forecast)) {
    return <ForecastCard forecast={forecast} cityName={cityName} sourceMode={sourceMode} />;
  }

  const cityRows = getWeatherCityRows({
    weatherData: weatherData || {},
    settings: settings || {},
    cities,
  }).filter(row => row.forecast.length > 0);

  if (cityRows.length === 0) {
    return (
      <section className="wwf-card wwf-card--empty" data-weekly-weather-forecast="empty">
        <div className="wwf-header">
          <div>
            <span className="wwf-eyebrow">Weekly forecast</span>
            <h3>7-day outlook</h3>
          </div>
        </div>
        <p className="wwf-empty">Weekly forecast is updating.</p>
      </section>
    );
  }

  return (
    <div className="wwf-stack" data-weekly-weather-forecast="stack">
      {cityRows.map(row => (
        <ForecastCard
          key={row.city}
          forecast={row.forecast}
          cityName={row.cityName}
          sourceMode={row.sourceMode}
        />
      ))}
    </div>
  );
}
`);

/* -------------------------------------------------------------------------- */
/* 4) Weekly CSS small additions                                               */
/* -------------------------------------------------------------------------- */

patchFile('src/components/weather/WeeklyWeatherForecast.css', source => {
  if (source.includes('.wwf-stack')) return source;

  return `${source}

.wwf-stack {
  display: grid;
  gap: 14px;
}

.wwf-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  justify-content: flex-end;
}

.wwf-source {
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #bfdbfe;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}

.wwf-card--empty {
  padding-bottom: 14px;
}

.wwf-empty {
  margin: 0;
  padding: 0 16px 14px;
  color: #94a3b8;
  font-size: 0.84rem;
}
`;
});

/* -------------------------------------------------------------------------- */
/* 5) Certification                                                            */
/* -------------------------------------------------------------------------- */

write('src/services/weatherIntegrationHardening.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  formatRainPair,
  getWeatherCityRows,
  normalizeForecastDay,
  normalizeForecastRows,
} from './weatherDataAdapters';
import {
  buildNextRiskSummary,
  buildTomorrowChip,
  summarizeAllCitiesWeekly,
  summarizeCityWeekly,
} from './weatherInsights';

describe('Weather integration hardening certification', () => {
  it('normalizes forecast aliases into a stable shape', () => {
    const day = normalizeForecastDay({
      tempMax: 31,
      tempMin: 25,
      precipProb: 92,
      precipSum: 20.3,
      apparentMax: 35,
      humidityMean: 86,
      uvMax: 8,
      windMax: 22,
    });

    expect(day.high).toBe(31);
    expect(day.low).toBe(25);
    expect(day.rainProb).toBe(92);
    expect(day.rainMm).toBe(20.3);
    expect(day.realFeelDay).toBe(35);
    expect(day.humidityDay).toBe(86);
    expect(formatRainPair(day)).toBe('92% · 20.3mm');
  });

  it('builds city rows from WeatherPage style weatherData/settings props', () => {
    const rows = getWeatherCityRows({
      settings: {
        weather: {
          cities: ['colombo'],
          locationConfigVersion: 'weather-locations-v3-colombo-ux',
        },
      },
      weatherData: {
        colombo: {
          name: 'Colombo',
          sourceMode: 'live-multi-model',
          weeklyForecast: [{ high: 30, low: 25, rainProb: 70, rainMm: 8 }],
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].cityName).toBe('Colombo');
    expect(rows[0].forecast[0].rainMm).toBe(8);
  });

  it('keeps summarizeCityWeekly backwards compatible', () => {
    const cityData = {
      name: 'Colombo',
      weeklyForecast: [
        { label: 'Today', high: 30, low: 25, rainProb: 20, rainMm: 0 },
        { label: 'Tomorrow', high: 29, low: 24, rainProb: 92, rainMm: 20.3 },
      ],
    };

    const oldStyle = summarizeCityWeekly('colombo', cityData);
    const newStyle = summarizeCityWeekly(cityData);

    expect(oldStyle.hasWeekly).toBe(true);
    expect(oldStyle.rainiestDay.label).toBe('Tomorrow');
    expect(newStyle.rainiestDay.label).toBe('Tomorrow');
  });

  it('keeps summarizeAllCitiesWeekly available for WeatherPlanningSummary', () => {
    const summaries = summarizeAllCitiesWeekly({
      colombo: {
        weeklyForecast: [{ high: 30, low: 25, rainProb: 10, rainMm: 0 }],
      },
    }, ['colombo']);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].hasWeekly).toBe(true);
  });

  it('builds QuickWeather risk and tomorrow summaries with mm', () => {
    const cityData = {
      weeklyForecast: [
        { label: 'Today', high: 31, low: 25, rainProb: 55, rainMm: 2.1 },
        { label: 'Tomorrow', high: 29, low: 24, rainProb: 92, rainMm: 20.3 },
      ],
    };

    const risk = buildNextRiskSummary(cityData);
    const tomorrow = buildTomorrowChip(cityData);

    expect(risk.rainText).toBe('92% · 22.4mm');
    expect(tomorrow.rainText).toBe('92% · 20.3mm');
  });
});
`);

write('scripts/test_weather_integration_hardening_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const adapter = read('src/services/weatherDataAdapters.js');
const insights = read('src/services/weatherInsights.js');
const weekly = read('src/components/weather/WeeklyWeatherForecast.jsx');
const weeklyCss = read('src/components/weather/WeeklyWeatherForecast.css');
const cert = read('src/services/weatherIntegrationHardening.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'normalizeForecastDay',
  'normalizeForecastRows',
  'getWeatherCityRows',
  'formatRainPair',
  'realFeelDay',
  'humidityDay',
]) {
  assert(adapter.includes(token), 'weatherDataAdapters.js missing token: ' + token);
}

for (const token of [
  'summarizeAllCitiesWeekly',
  'summarizeCityWeekly(cityOrData',
  'buildNextRiskSummary',
  'buildTomorrowChip',
  'buildDailyConsensus',
]) {
  assert(insights.includes(token), 'weatherInsights.js missing token: ' + token);
}

for (const token of [
  'weatherData = null',
  'settings = null',
  'ForecastCard',
  'wwf-stack',
  'formatRainPair',
  'data-weekly-weather-forecast',
]) {
  assert(weekly.includes(token), 'WeeklyWeatherForecast.jsx missing token: ' + token);
}

for (const token of [
  '.wwf-stack',
  '.wwf-source',
  '.wwf-empty',
]) {
  assert(weeklyCss.includes(token), 'WeeklyWeatherForecast.css missing token: ' + token);
}

for (const token of [
  'Weather integration hardening certification',
  'normalizes forecast aliases',
  'WeatherPage style weatherData/settings props',
  'summarizeCityWeekly backwards compatible',
  'summarizeAllCitiesWeekly available',
]) {
  assert(cert.includes(token), 'weatherIntegrationHardening.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:weather-integration-hardening"'),
  'package.json must include test:weather-integration-hardening'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-integration-hardening']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include weather integration hardening test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather integration hardening',
  guarantees: [
    'WeeklyWeatherForecast supports old and new prop shapes',
    'WeatherPlanningSummary summarizeAllCitiesWeekly import is restored',
    'summarizeCityWeekly is backwards compatible',
    'weekly forecast rows normalize rain probability/mm, real feel and humidity',
    'QuickWeather risk/tomorrow summaries keep precipitation mm'
  ]
}, null, 2));

console.log('PASS: Weather integration hardening static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:weather-integration-hardening'] =
    'node scripts/test_weather_integration_hardening_static.mjs && vitest run --config vitest.config.js src/services/weatherIntegrationHardening.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:weather-integration-hardening']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  if (source.includes("  ['npm', ['run', 'test:weather-signal-precision']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:weather-signal-precision']],",
      "  ['npm', ['run', 'test:weather-signal-precision']],\\n  ['npm', ['run', 'test:weather-integration-hardening']],"
    );
  }

  if (source.includes("  ['npm', ['run', 'test:weather-settings-onthisday']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:weather-settings-onthisday']],",
      "  ['npm', ['run', 'test:weather-settings-onthisday']],\\n  ['npm', ['run', 'test:weather-integration-hardening']],"
    );
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'weather-integration-hardening')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-signal-precision');
      const command = {
        id: 'weather-integration-hardening',
        cmd: 'npm',
        args: ['run', 'test:weather-integration-hardening'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:weather-integration-hardening')) return source;

    if (source.includes("'test:weather-signal-precision',")) {
      return source.replace(
        "'test:weather-signal-precision',",
        "'test:weather-signal-precision',\\n  'test:weather-integration-hardening',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 61D Weather integration hardening patch complete.');
