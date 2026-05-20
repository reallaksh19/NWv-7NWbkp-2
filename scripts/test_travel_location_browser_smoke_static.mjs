import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const smoke = read('scripts/test_travel_location_browser_smoke.mjs');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  "import { chromium } from 'playwright'",
  'setTravelLocationToColombo',
  'assertMainTravelContext',
  'assertWeatherCanDriveTravelLocation',
  'assertColumboAliasInRuntimeModules',
  'data-travel-location-settings',
  'data-travel-location-banner',
  'data-travel-local-stories',
  'weather_active_city',
  'Columbo',
  'Sri Lanka'
]) {
  assert(smoke.includes(token), 'test_travel_location_browser_smoke.mjs missing token: ' + token);
}

assert(
  packageJson.includes('"test:travel-location-browser-smoke:static"'),
  'package.json must include test:travel-location-browser-smoke:static'
);

assert(
  packageJson.includes('"test:travel-location-browser-smoke"'),
  'package.json must include test:travel-location-browser-smoke'
);

assert(
  certGate.includes("['npm', ['run', 'test:travel-location-browser-smoke:static']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include static travel-location browser-smoke guard or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel location browser smoke static guard',
  guarantees: [
    'Playwright travel-location browser smoke exists',
    'Settings travel-location browser check exists',
    'Colombo selection browser check exists',
    'Columbo alias browser check exists',
    'Main travel banner/local block browser check exists',
    'Weather active city travel fallback browser check exists'
  ],
}, null, 2));

console.log('PASS: Travel location browser smoke static guard');
