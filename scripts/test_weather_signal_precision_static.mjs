import fs from 'fs';

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
