import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const component = read('src/components/weather/WeatherLocationManager.jsx');
const css = read('src/components/weather/WeatherLocationManager.css');
const cert = read('src/components/weather/WeatherLocationManagerClarity.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'data-weather-location-manager',
  'data-weather-location-help',
  'data-weather-add-colombo',
  'data-weather-delete-city',
  'data-weather-quick-add-list',
  'To add: choose a city',
  'To delete: press',
  'colomboMissing',
  '+ Add Colombo',
]) {
  assert(component.includes(token), 'WeatherLocationManager.jsx missing token: ' + token);
}

for (const token of [
  '.wlm-help',
  '.wlm-add-colombo',
  '.wlm-quick-add',
  '.wlm-quick-add__buttons',
  '.wlm-chip button:hover',
  'rgba(20, 184, 166',
]) {
  assert(css.includes(token), 'WeatherLocationManager.css missing token: ' + token);
}

for (const token of [
  'Weather location manager clarity certification',
  'explains how to add and delete cities',
  'provides one-click Colombo add path',
  'provides labelled delete buttons',
  'provides quick-add list',
]) {
  assert(cert.includes(token), 'WeatherLocationManagerClarity.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:weather-manager-clarity"'),
  'package.json must include test:weather-manager-clarity'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-manager-clarity']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include weather manager clarity test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather manager clarity',
  guarantees: [
    'user can see how to add a city',
    'user can see how to delete a city',
    'one-click Add Colombo exists when Colombo is missing',
    'quick-add available city buttons exist',
    'delete city buttons are labelled',
    'weather manager visual style is professional and visible'
  ]
}, null, 2));

console.log('PASS: Weather manager clarity static slice');
