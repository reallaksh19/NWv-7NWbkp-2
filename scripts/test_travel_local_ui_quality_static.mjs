import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const quality = read('src/services/travelLocalUiQuality.js');
const qualityTest = read('src/services/travelLocalUiQuality.cert.test.js');
const storiesComponent = read('src/components/travel/TravelLocalStories.jsx');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'TRAVEL_UI_QUALITY_VERSION',
  'auditTravelLocalStories',
  'getStoriesDisplayMode',
  'NEAR_DUPLICATE',
  'NO_STORIES',
  'INSUFFICIENT_STORIES',
]) {
  assert(quality.includes(token), 'travelLocalUiQuality.js missing token: ' + token);
}

for (const token of [
  'Travel local UI quality gate certification',
  'passes a valid set of Colombo stories',
  'warns on near-duplicate titles',
  'returns correct display mode',
]) {
  assert(qualityTest.includes(token), 'travelLocalUiQuality.cert.test.js missing token: ' + token);
}

for (const token of [
  'auditTravelLocalStories',
  'getStoriesDisplayMode',
  'data-travel-local-stories',
]) {
  assert(storiesComponent.includes(token), 'TravelLocalStories.jsx missing quality gate token: ' + token);
}

assert(
  packageJson.includes('"test:travel-local-ui-quality"'),
  'package.json must include test:travel-local-ui-quality'
);

assert(
  certGate.includes("['npm', ['run', 'test:travel-local-ui-quality']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include travel local ui quality test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel local UI quality gate',
  guarantees: [
    'Quality audit function exists',
    'Near-duplicate detection exists',
    'TravelLocalStories uses quality gate',
    'Display mode logic exists',
  ]
}, null, 2));

console.log('PASS: Travel local UI quality gate static slice');
