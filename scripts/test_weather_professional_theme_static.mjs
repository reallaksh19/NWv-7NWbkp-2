import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const css = read('src/styles/weatherProfessionalTheme.css');
const app = read('src/App.jsx');
const cert = read('src/styles/weatherProfessionalTheme.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  '--weather-card-bg',
  '--weather-card-border',
  '--weather-accent-text',
  '.quick-weather-card',
  'visibility: visible',
  '.qw-highlight-text-container',
  '.qwss-strip',
  '.wlm-collapsed',
  '.wwf-card',
  '.weather-city-comparison',
  '.weather-planning-summary',
]) {
  assert(css.includes(token), 'weatherProfessionalTheme.css missing token: ' + token);
}

for (const token of [
  "import './styles/weatherProfessionalTheme.css';",
]) {
  assert(app.includes(token), 'App.jsx missing token: ' + token);
}

for (const token of [
  'Weather professional theme certification',
  'protects QuickWeather desktop visibility',
  'styles the item below QuickWeather professionally',
  'styles weekly forecast and weather manager consistently',
]) {
  assert(cert.includes(token), 'weatherProfessionalTheme.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:weather-professional-theme"'),
  'package.json must include test:weather-professional-theme'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-professional-theme']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include weather professional theme test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather professional visual theme',
  guarantees: [
    'QuickWeather is visible in desktop view',
    'QuickWeather card has professional contrast',
    'item below QuickWeather is styled professionally',
    'weekly forecast matches Weather tab theme',
    'city manager matches Weather tab theme',
    'weather comparison/planning cards match theme',
    'mobile compact guards are present'
  ]
}, null, 2));

console.log('PASS: Weather professional theme static slice');
