import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const smoke = read('scripts/test_weather_browser_smoke.mjs');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  "import { chromium } from 'playwright'",
  'assertNoVisibleOnThisDay',
  'assertWeatherLocationManager',
  'assertQuickWeather',
  'assertWeeklyForecast',
  'data-weather-add-colombo',
  'data-weather-delete-city',
  'QuickWeather does not show precipitation',
  'Weekly forecast is missing token',
]) {
  assert(smoke.includes(token), 'test_weather_browser_smoke.mjs missing token: ' + token);
}

assert(
  packageJson.includes('"test:weather-browser-smoke"'),
  'package.json must include test:weather-browser-smoke'
);

assert(
  packageJson.includes('"test:weather-browser-smoke:static"'),
  'package.json must include test:weather-browser-smoke:static'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-browser-smoke:static']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include static browser-smoke guard or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather browser smoke static guard',
  guarantees: [
    'Playwright smoke script exists',
    'On This Day hidden-by-default browser check exists',
    'Weather location manager browser check exists',
    'QuickWeather desktop visibility browser check exists',
    'QuickWeather precipitation mm browser check exists',
    'Weekly forecast browser check exists'
  ],
}, null, 2));

console.log('PASS: Weather browser smoke static guard');
