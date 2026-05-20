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
/* 1) Weather insight precision: rain probability + rain mm                    */
/* -------------------------------------------------------------------------- */

write('src/services/weatherInsights.js', `/**
 * Weather planning insights derived from daily / weekly forecast.
 * Pure functions only.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
  return asArray(cityData?.weeklyForecast || cityData?.forecast || cityData?.daily);
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

/**
 * Build a compact tomorrow chip: summary text + risk level.
 */
export function buildTomorrowChip(cityData) {
  const { tomorrow } = getTodayTomorrow(cityData);
  if (!tomorrow) return null;

  const rain = firstNumber(tomorrow, ['precipProb', 'rainProb', 'rainfallProbability', 'pop'], 0);
  const precipMm = firstNumber(tomorrow, ['precipSum', 'rainMm', 'rainfallMm', 'precip', 'precipitationMm'], 0);
  const tempMax = firstNumber(tomorrow, ['tempMax', 'high', 'maxTemp']);
  const tempMin = firstNumber(tomorrow, ['tempMin', 'low', 'minTemp']);
  const uv = firstNumber(tomorrow, ['uvMax', 'uvIndex']);
  const condition = tomorrow.condition || 'Forecast';

  let risk = 'low';
  if (rain >= 70 || precipMm >= 12 || (tempMax != null && tempMax >= 38)) risk = 'high';
  else if (rain >= 35 || precipMm >= 2 || (tempMax != null && tempMax >= 33) || (uv != null && uv >= 7)) risk = 'medium';

  return {
    label: 'Tomorrow',
    temp: tempMax,
    tempMax,
    tempMin,
    rain,
    precipMm,
    uv,
    risk,
    condition,
    rainText: formatRainSignal(rain, precipMm),
  };
}

/**
 * Build a simple outdoor planning score (0–100).
 * Higher = better for outdoor activity.
 */
export function buildOutdoorScore(day) {
  if (!day) return null;

  let score = 100;
  const rain = firstNumber(day, ['precipProb', 'rainProb', 'rainfallProbability', 'pop'], 0);
  const precipMm = firstNumber(day, ['precipSum', 'rainMm', 'rainfallMm', 'precip', 'precipitationMm'], 0);
  const temp = firstNumber(day, ['tempMax', 'high', 'maxTemp'], 28);
  const uv = firstNumber(day, ['uvMax', 'uvIndex'], 5);
  const wind = firstNumber(day, ['windMax', 'windKph', 'windSpeed'], 10);
  const humidity = firstNumber(day, ['humidityDay', 'humidityMean'], 55);

  score -= Math.min(40, rain * 0.45);
  score -= Math.min(25, precipMm * 3);

  if (temp > 38) score -= 20;
  else if (temp > 35) score -= 10;

  if (uv >= 10) score -= 15;
  else if (uv >= 7) score -= 8;

  if (wind >= 40) score -= 10;
  else if (wind >= 25) score -= 5;

  if (humidity >= 85 && temp >= 32) score -= 8;

  return Math.max(0, Math.round(score));
}

/**
 * Summarize a city's weekly forecast into planning highlights.
 */
export function summarizeCityWeekly(cityData) {
  const forecast = getDailyForecast(cityData);
  if (forecast.length === 0) return null;

  const days = forecast.slice(0, 7);

  const bestDay = days.reduce((best, day) => {
    const score = buildOutdoorScore(day);
    return score > (buildOutdoorScore(best) ?? 0) ? day : best;
  }, days[0]);

  const rainiestDay = days.reduce((rainiest, day) => {
    const dayRain = firstNumber(day, ['precipSum', 'rainMm', 'rainfallMm'], 0);
    const currentRain = firstNumber(rainiest, ['precipSum', 'rainMm', 'rainfallMm'], 0);
    const dayProb = firstNumber(day, ['precipProb', 'rainProb', 'rainfallProbability'], 0);
    const currentProb = firstNumber(rainiest, ['precipProb', 'rainProb', 'rainfallProbability'], 0);

    return (dayRain * 10 + dayProb) > (currentRain * 10 + currentProb) ? day : rainiest;
  }, days[0]);

  const hottestDay = days.reduce((hottest, day) => (
    firstNumber(day, ['tempMax', 'high'], 0) > firstNumber(hottest, ['tempMax', 'high'], 0) ? day : hottest
  ), days[0]);

  const highestUvDay = days.reduce((uvDay, day) => (
    firstNumber(day, ['uvMax', 'uvIndex'], 0) > firstNumber(uvDay, ['uvMax', 'uvIndex'], 0) ? day : uvDay
  ), days[0]);

  return {
    bestDay,
    rainiestDay,
    hottestDay,
    highestUvDay,
  };
}

/**
 * Build next-risk summary: rain %, rain mm, heat, UV, wind signals.
 */
export function buildNextRiskSummary(cityData) {
  const { today, tomorrow, days } = getTodayTomorrow(cityData);
  if (!today && !tomorrow) return null;

  const rain = maxFromDays(days, ['precipProb', 'rainProb', 'rainfallProbability', 'pop'], 0);
  const precipMm = sumFromDays(days, ['precipSum', 'rainMm', 'rainfallMm', 'precip', 'precipitationMm'], 0);
  const heat = maxFromDays(days, ['tempMax', 'high', 'maxTemp'], null);
  const uv = maxFromDays(days, ['uvMax', 'uvIndex'], null);
  const wind = maxFromDays(days, ['windMax', 'windKph', 'windSpeed'], null);
  const humidity = maxFromDays(days, ['humidityDay', 'humidityMean'], null);

  return {
    rain,
    precipMm,
    rainText: formatRainSignal(rain, precipMm),
    heat,
    uv,
    wind,
    humidity,
    stable: rain < 20 && precipMm < 0.5,
  };
}

export const __weatherInsightTestUtils = {
  firstNumber,
  formatRainSignal,
};
`);

/* -------------------------------------------------------------------------- */
/* 2) Professional QuickWeather signal strip                                   */
/* -------------------------------------------------------------------------- */

write('src/components/weather/QuickWeatherSignalStrip.jsx', `import React from 'react';
import {
  buildNextRiskSummary,
  buildTomorrowChip,
  formatRainSignal,
} from '../../services/weatherInsights.js';
import './QuickWeatherSignalStrip.css';

function riskClass(level) {
  if (level === 'high') return 'qwss-chip--high';
  if (level === 'medium') return 'qwss-chip--medium';
  return 'qwss-chip--low';
}

function rainRiskLevel(probability, precipMm) {
  if (probability >= 70 || precipMm >= 10) return 'high';
  if (probability >= 35 || precipMm >= 1.5) return 'medium';
  return 'low';
}

function heatRiskLevel(temp) {
  if (temp >= 38) return 'high';
  if (temp >= 33) return 'medium';
  return 'low';
}

function uvRiskLevel(uv) {
  if (uv >= 10) return 'high';
  if (uv >= 7) return 'medium';
  return 'low';
}

function windRiskLevel(wind) {
  if (wind >= 40) return 'high';
  if (wind >= 25) return 'medium';
  return 'low';
}

export default function QuickWeatherSignalStrip({
  cityData,
  riskSummary,
  tomorrowChip,
}) {
  const resolvedRisk = riskSummary || buildNextRiskSummary(cityData);
  const resolvedTomorrow = tomorrowChip || buildTomorrowChip(cityData);

  if (!resolvedRisk && !resolvedTomorrow) return null;

  const signals = [];

  if (resolvedRisk) {
    const rain = Number(resolvedRisk.rain ?? 0);
    const precipMm = Number(resolvedRisk.precipMm ?? resolvedRisk.rainMm ?? 0);

    signals.push({
      key: 'rain',
      icon: '🌧',
      label: formatRainSignal(rain, precipMm),
      title: 'Rain probability · expected precipitation',
      level: rainRiskLevel(rain, precipMm),
    });

    if (resolvedRisk.heat != null) {
      signals.push({
        key: 'heat',
        icon: '🌡',
        label: \`\${Math.round(resolvedRisk.heat)}°\`,
        title: 'Max temperature',
        level: heatRiskLevel(resolvedRisk.heat),
      });
    }

    if (resolvedRisk.uv != null) {
      signals.push({
        key: 'uv',
        icon: '☀',
        label: \`UV \${Math.round(resolvedRisk.uv)}\`,
        title: 'UV index',
        level: uvRiskLevel(resolvedRisk.uv),
      });
    }

    if (resolvedRisk.wind != null) {
      signals.push({
        key: 'wind',
        icon: '💨',
        label: \`\${Math.round(resolvedRisk.wind)}km/h\`,
        title: 'Max wind',
        level: windRiskLevel(resolvedRisk.wind),
      });
    }

    if (resolvedRisk.humidity != null) {
      signals.push({
        key: 'humidity',
        icon: '💦',
        label: \`\${Math.round(resolvedRisk.humidity)}%\`,
        title: 'Humidity',
        level: resolvedRisk.humidity >= 85 ? 'medium' : 'low',
      });
    }

    if (resolvedRisk.stable) {
      signals.push({
        key: 'stable',
        icon: '✅',
        label: 'Stable',
        title: 'No significant rain expected',
        level: 'low',
      });
    }
  }

  if (resolvedTomorrow) {
    const tempPart = resolvedTomorrow.tempMax != null
      ? \`\${Math.round(resolvedTomorrow.tempMax)}°\`
      : resolvedTomorrow.temp != null
        ? \`\${Math.round(resolvedTomorrow.temp)}°\`
        : resolvedTomorrow.condition;

    const rainPart = resolvedTomorrow.rainText ||
      formatRainSignal(resolvedTomorrow.rain ?? 0, resolvedTomorrow.precipMm ?? 0);

    signals.push({
      key: 'tomorrow',
      icon: '📅',
      label: \`Tmr \${tempPart} · \${rainPart}\`,
      title: \`Tomorrow: \${resolvedTomorrow.condition || 'Forecast'}\`,
      level: resolvedTomorrow.risk || 'low',
    });
  }

  if (signals.length === 0) return null;

  return (
    <div className="qwss-strip" data-quick-weather-signal-strip="professional">
      {signals.map(signal => (
        <span key={signal.key} className={\`qwss-chip \${riskClass(signal.level)}\`} title={signal.title}>
          <span className="qwss-chip__icon">{signal.icon}</span>
          <span className="qwss-chip__label">{signal.label}</span>
        </span>
      ))}
    </div>
  );
}
`);

write('src/components/weather/QuickWeatherSignalStrip.css', `.qwss-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 12px;
}

.qwss-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 9px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.42);
  color: #e2e8f0;
  font-size: 0.76rem;
  font-weight: 850;
  line-height: 1;
  white-space: nowrap;
}

.qwss-chip__icon {
  flex: 0 0 auto;
  font-size: 0.94rem;
}

.qwss-chip__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qwss-chip--low {
  border-color: rgba(45, 212, 191, 0.22);
  background: rgba(20, 184, 166, 0.12);
  color: #ccfbf1;
}

.qwss-chip--medium {
  border-color: rgba(245, 158, 11, 0.30);
  background: rgba(120, 53, 15, 0.20);
  color: #fde68a;
}

.qwss-chip--high {
  border-color: rgba(248, 113, 113, 0.34);
  background: rgba(127, 29, 29, 0.24);
  color: #fecaca;
}

@media (min-width: 900px) {
  .qwss-strip {
    margin-top: 12px;
  }

  .qwss-chip {
    min-height: 32px;
    padding-inline: 10px;
  }
}

@media (max-width: 520px) {
  .qwss-strip {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .qwss-chip {
    justify-content: center;
  }
}
`);

/* -------------------------------------------------------------------------- */
/* 3) Tests                                                                    */
/* -------------------------------------------------------------------------- */

write('src/services/weatherSignalPrecision.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  buildNextRiskSummary,
  buildTomorrowChip,
  buildOutdoorScore,
  formatRainSignal,
  summarizeCityWeekly,
} from './weatherInsights';

describe('Weather signal precision certification', () => {
  it('formats rain probability and precipitation mm together', () => {
    expect(formatRainSignal(55, 2.1)).toBe('55% · 2.1mm');
    expect(formatRainSignal(null, null)).toBe('0% · 0.0mm');
  });

  it('builds next risk summary with precipitation mm', () => {
    const summary = buildNextRiskSummary({
      weeklyForecast: [
        { precipProb: 55, precipSum: 2.1, tempMax: 32, uvMax: 9, windMax: 18, humidityDay: 76 },
        { precipProb: 35, precipSum: 1.4, tempMax: 31, uvMax: 8, windMax: 22, humidityDay: 82 },
      ],
    });

    expect(summary.rain).toBe(55);
    expect(summary.precipMm).toBe(3.5);
    expect(summary.rainText).toBe('55% · 3.5mm');
    expect(summary.uv).toBe(9);
    expect(summary.humidity).toBe(82);
  });

  it('builds tomorrow chip with rain mm and risk', () => {
    const chip = buildTomorrowChip({
      weeklyForecast: [
        { precipProb: 10, precipSum: 0, tempMax: 30 },
        { precipProb: 80, precipSum: 12.4, tempMax: 29, condition: 'Rain' },
      ],
    });

    expect(chip.rain).toBe(80);
    expect(chip.precipMm).toBe(12.4);
    expect(chip.rainText).toBe('80% · 12.4mm');
    expect(chip.risk).toBe('high');
  });

  it('reduces outdoor score for rain mm and humidity', () => {
    const good = buildOutdoorScore({ precipProb: 5, precipSum: 0, tempMax: 29, uvMax: 4, humidityDay: 60 });
    const bad = buildOutdoorScore({ precipProb: 90, precipSum: 18, tempMax: 36, uvMax: 10, humidityDay: 90 });

    expect(good).toBeGreaterThan(bad);
  });

  it('uses rain mm to identify rainiest day', () => {
    const summary = summarizeCityWeekly({
      weeklyForecast: [
        { label: 'Today', precipProb: 60, precipSum: 1.0, tempMax: 31 },
        { label: 'Tomorrow', precipProb: 55, precipSum: 12.0, tempMax: 30 },
      ],
    });

    expect(summary.rainiestDay.label).toBe('Tomorrow');
  });
});
`);

write('scripts/test_weather_signal_precision_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const insights = read('src/services/weatherInsights.js');
const signal = read('src/components/weather/QuickWeatherSignalStrip.jsx');
const signalCss = read('src/components/weather/QuickWeatherSignalStrip.css');
const cert = read('src/services/weatherSignalPrecision.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'formatRainSignal',
  'precipMm',
  'rainText',
  'humidity',
  'buildNextRiskSummary',
  'buildTomorrowChip',
]) {
  assert(insights.includes(token), 'weatherInsights.js missing token: ' + token);
}

for (const token of [
  'data-quick-weather-signal-strip',
  'formatRainSignal',
  'precipMm',
  'Tmr',
  'Humidity',
]) {
  assert(signal.includes(token), 'QuickWeatherSignalStrip.jsx missing token: ' + token);
}

for (const token of [
  '.qwss-strip',
  '.qwss-chip',
  '.qwss-chip--low',
  '.qwss-chip--medium',
  '.qwss-chip--high',
]) {
  assert(signalCss.includes(token), 'QuickWeatherSignalStrip.css missing token: ' + token);
}

for (const token of [
  'Weather signal precision certification',
  'formats rain probability and precipitation mm together',
  'builds next risk summary with precipitation mm',
  'builds tomorrow chip with rain mm and risk',
]) {
  assert(cert.includes(token), 'weatherSignalPrecision.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:weather-signal-precision"'),
  'package.json must include test:weather-signal-precision'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-signal-precision']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include weather signal precision test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather signal precision',
  guarantees: [
    'QuickWeather signal strip shows rain probability and precipitation mm',
    'Tomorrow chip includes rain mm',
    'Weather insight risk summary carries precipitation mm',
    'Humidity can be shown as a compact chip',
    'QuickWeather signal strip uses professional dark weather styling'
  ]
}, null, 2));

console.log('PASS: Weather signal precision static slice');
`);

/* -------------------------------------------------------------------------- */
/* 4) package.json + certification                                             */
/* -------------------------------------------------------------------------- */

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:weather-signal-precision'] =
    'node scripts/test_weather_signal_precision_static.mjs && vitest run --config vitest.config.js src/services/weatherSignalPrecision.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:weather-signal-precision']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  if (source.includes("  ['npm', ['run', 'test:weather-settings-onthisday']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:weather-settings-onthisday']],",
      "  ['npm', ['run', 'test:weather-settings-onthisday']],\\n  ['npm', ['run', 'test:weather-signal-precision']],"
    );
  }

  if (source.includes("  ['npm', ['run', 'test:weather-ux-closeout']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:weather-ux-closeout']],",
      "  ['npm', ['run', 'test:weather-ux-closeout']],\\n  ['npm', ['run', 'test:weather-signal-precision']],"
    );
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'weather-signal-precision')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-settings-onthisday');
      const command = {
        id: 'weather-signal-precision',
        cmd: 'npm',
        args: ['run', 'test:weather-signal-precision'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:weather-signal-precision')) return source;

    if (source.includes("'test:weather-settings-onthisday',")) {
      return source.replace(
        "'test:weather-settings-onthisday',",
        "'test:weather-settings-onthisday',\\n  'test:weather-signal-precision',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 61C Weather signal precision patch complete.');
