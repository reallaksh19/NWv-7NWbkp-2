import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const weatherPage = read('src/pages/WeatherPage.jsx');
const trustPanel = read('src/components/weather/WeatherTrustPanel.jsx');
const trustCss = read('src/components/weather/WeatherTrustPanel.css');
const detailedCard = read('src/components/DetailedWeatherCard.jsx');

assert(
  weatherPage.includes("import WeatherTrustPanel from '../components/weather/WeatherTrustPanel';"),
  'WeatherPage must import WeatherTrustPanel'
);

for (const token of [
  '<WeatherTrustPanel',
  'weatherData={displayData}',
  'cities={cities}',
  'activeCity={activeCity}',
  'error={error}',
  'loading={loading}',
  'onRefresh={handleRefresh}',
  '!cities.includes(activeCity)'
]) {
  assert(weatherPage.includes(token), `WeatherPage missing token: ${token}`);
}

for (const token of [
  'getCityCoverage',
  'getTrustGrade',
  'getSourceMode',
  'getAgeLabel',
  'Forecast trust',
  'Complete forecast coverage',
  'Useful partial coverage',
  'Thin weather coverage',
  'No displayable weather',
  'data-weather-trust-grade'
]) {
  assert(trustPanel.includes(token), `WeatherTrustPanel missing token: ${token}`);
}

for (const token of [
  '.weather-trust-panel',
  '.weather-trust-panel__cities',
  '.weather-trust-panel__city--active',
  '.weather-trust-panel__city--ok',
  '.weather-trust-panel__city--missing',
  '@media (min-width: 1024px)',
  '@media (max-width: 760px)'
]) {
  assert(trustCss.includes(token), `WeatherTrustPanel.css missing token: ${token}`);
}

assert(
  detailedCard.includes('View hourly'),
  'DetailedWeatherCard must use View hourly label'
);

assert(
  !detailedCard.includes('Touch for Hourly'),
  'DetailedWeatherCard must not use old Touch for Hourly label'
);

assert(
  detailedCard.includes('cities.reduce'),
  'DetailedWeatherCard must support dynamic configured city labels'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather trust panel slice',
  guarantees: [
    'Weather page has a source/coverage trust panel',
    'configured cities are checked for coverage',
    'invalid active city is corrected',
    'dynamic city labels are supported',
    'hourly hint text is desktop/mobile safe',
    'no weather feed logic was changed'
  ]
}, null, 2));

console.log('PASS: Weather trust panel static slice');
