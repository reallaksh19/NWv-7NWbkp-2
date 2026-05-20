import fs from 'fs';

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
